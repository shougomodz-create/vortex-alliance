require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const database = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Confiar no primeiro proxy (Cloudflare)
app.set('trust proxy', 1);

// Segurança — headers HTTP
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));

// Rate limiting contra DDoS
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 requests por minuto por IP
  message: { error: 'Muitas requisições. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Limite de API atingido.' }
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 tentativas de login por 15 min
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  skipSuccessfulRequests: true
});

const visitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 registros de visita por hora por IP
  message: { error: 'Limite de visitas atingido.' }
});

app.use(globalLimiter);
app.use('/api/', apiLimiter);
app.use('/admin/login', adminLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Headers de segurança extras
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Cloudflare: detectar.request legítimo
  if (req.headers['cf-ray']) {
    res.setHeader('X-Proxy-Cloudflare', 'true');
  }
  next();
});

// Segurança apenas para requests externos suspeitos (não bloqueia navegador)
app.use((req, res, next) => {
  const ua = (req.get('User-Agent') || '').toLowerCase();
  
  // Bloquear só requests sem User-Agent ou explicitamente maliciosos
  if (!ua && req.path !== '/api/visit') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  // Bloquear ferramentas de automação óbvias (não browsers)
  const blockList = ['postman', 'insomnia', 'httpie'];
  if (blockList.some(b => ua.includes(b))) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  next();
});

// Proteção CSRF para admin — verificar header customizado em mutations
app.use('/admin/api', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.get('Origin') || req.get('Referer') || '';
    const xRequestedWith = req.get('X-Requested-With');
    
    // Permitir se vier do próprio site ou tiver header de identificação
    const isSameOrigin = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('onrender.com') || origin.includes('vortex-alliance');
    if (!isSameOrigin && !xRequestedWith) {
      return res.status(403).json({ error: 'Requisição bloqueada' });
    }
  }
  next();
});

// Arquivos estáticos
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Rotas
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const authMiddleware = require('./middleware/auth');

app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// Rota principal
app.get('/', async (req, res) => {
  try {
    // Registrar visita apenas 1 vez por sessão
    const hasVisited = req.cookies?.vvisited;
    if (!hasVisited) {
      // Cloudflare: usar CF-Connecting-IP se disponível
      const ip = req.headers['cf-connecting-ip'] || req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || '';
      
      // Verificar se já existe visita deste IP hoje
      const existingVisit = await database.get(
        "SELECT id FROM visits WHERE ip = $1 AND date(created_at) = CURRENT_DATE",
        [ip]
      );
      
      if (!existingVisit) {
        await database.run('INSERT INTO visits (ip, user_agent) VALUES ($1, $2)', [ip, userAgent]);
      }
      
      // Cookie de 24 horas
      res.cookie('vvisited', '1', { 
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
      });
    }
    
    // Buscar configurações
    const settingsRows = await database.all('SELECT * FROM settings');
    const settings = {};
    settingsRows.forEach(row => { settings[row.key] = row.value; });
    
    // Buscar contagens
    const oficiaisCount = (await database.get('SELECT COUNT(*) as count FROM oficiais'))?.count || 0;
    const parceriasCount = (await database.get('SELECT COUNT(*) as count FROM parcerias'))?.count || 0;
    const afiliadosCount = (await database.get('SELECT COUNT(*) as count FROM afiliados'))?.count || 0;
    const visitsTotal = (await database.get('SELECT COUNT(*) as count FROM visits'))?.count || 0;
    const visitsToday = (await database.get("SELECT COUNT(*) as count FROM visits WHERE date(created_at) = CURRENT_DATE"))?.count || 0;
    
    // Buscar dados para as seções
    const oficiais = await database.all('SELECT * FROM oficiais WHERE ativo = 1 ORDER BY ordem ASC LIMIT 6');
    const parcerias = await database.all('SELECT * FROM parcerias WHERE ativo = 1 ORDER BY vip DESC, ordem ASC LIMIT 6');
    const allAfiliados = await database.all('SELECT * FROM afiliados WHERE ativo = 1 ORDER BY vip DESC, ordem ASC');
    
    // Agrupar afiliados por categoria (case-insensitive)
    const afiliadosByCat = {};
    const catDisplayMap = {};
    allAfiliados.forEach(a => {
      const raw = (a.categoria || a.tipo || 'Grupos Afiliados').trim();
      const key = raw.toLowerCase();
      if (!afiliadosByCat[key]) {
        afiliadosByCat[key] = [];
        catDisplayMap[key] = raw;
      }
      afiliadosByCat[key].push(a);
    });
    
    // Ordem das categorias conhecidas + qualquer outra que tenha items
    const catOrder = ['grupos afiliados', 'canais de zap', 'canais afiliados', 'sites'];
    const knownCats = catOrder.filter(c => afiliadosByCat[c] && afiliadosByCat[c].length > 0);
    const extraCats = Object.keys(afiliadosByCat).filter(c => catOrder.indexOf(c) === -1 && afiliadosByCat[c].length > 0);
    const afiliadosCatKeys = knownCats.concat(extraCats);
    
    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="theme-color" content="#0a0a0a">
      <meta name="description" content="${settings.description || 'Aliança VORTEX — Força, Honra e União.'}">
      <title>${settings.site_title || 'ALIANÇA VORTEX'}</title>
      
      <!-- Favicon -->
      <link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
      <link rel="apple-touch-icon" href="/images/logo-vortex.svg">
      
      <!-- Open Graph / Facebook -->
      <meta property="og:type" content="website">
      <meta property="og:url" content="https://vortex-alliance.onrender.com/">
      <meta property="og:title" content="${settings.site_title || 'ALIANÇA VORTEX'}">
      <meta property="og:description" content="${settings.description || 'Aliança VORTEX — Força, Honra e União.'}">
      <meta property="og:image" content="${settings.logo || 'https://vortex-alliance.onrender.com/images/logo-vortex.svg'}">
      
      <!-- Twitter -->
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:url" content="https://vortex-alliance.onrender.com/">
      <meta name="twitter:title" content="${settings.site_title || 'ALIANÇA VORTEX'}">
      <meta name="twitter:description" content="${settings.description || 'Aliança VORTEX — Força, Honra e União.'}">
      <meta name="twitter:image" content="${settings.logo || 'https://vortex-alliance.onrender.com/images/logo-vortex.svg'}">
      
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Cinzel+Decorative:wght@400;700;900&family=Raleway:wght@300;400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
      <nav class="navbar">
        <a href="#inicio" class="logo">
          <svg class="logo-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c41e3a" stroke-width="1.5"><path d="M14.5 2L20 7.5L9.5 18L4 18L4 12.5L14.5 2Z"/><path d="M4 18L2 22"/><path d="M6 14L2 18"/></svg>
          <span class="logo-text">ALIANÇA VORTEX</span>
        </a>
        <button class="menu-toggle" aria-label="Abrir menu">
          <span></span><span></span><span></span>
        </button>
        <div class="nav-links">
          <a href="#inicio">Início</a>
          ${oficiais.length > 0 ? '<a href="#oficiais">Oficiais</a>' : ''}
          ${afiliadosCatKeys.length > 0 ? '<a href="#afiliados">Afiliados</a>' : ''}
          ${parcerias.length > 0 ? '<a href="#parcerias">Parcerias</a>' : ''}
          <a href="/admin" class="btn-nav">PAINEL</a>
        </div>
      </nav>

      <main>
        <section id="inicio" class="hero">
          <div class="hero-content">
            <div class="hero-text">
              <h1 class="hero-title">${settings.hero_title || 'ALIANÇA<br>VORTEX'}</h1>
              <p class="hero-subtitle">${settings.hero_subtitle || 'Força, Honra e União.'}</p>
              <p class="hero-description">${settings.hero_description || 'Conexões oficiais, parcerias e presença reunidas em um único espaço.'}</p>
              <div class="hero-buttons-row">
                <a href="#afiliados" class="btn btn-primary">VER AFILIADOS</a>
                ${settings.discord_link ? `<a href="${settings.discord_link}" class="btn btn-outline" target="_blank"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg> ENTRAR NO DISCORD</a>` : ''}
              </div>
            </div>
            <div class="hero-visual">
              <div class="hero-circle">
                <svg class="hero-sword" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#c41e3a" stroke-width="1.5">
                  <path d="M14.5 2L20 7.5L9.5 18L4 18L4 12.5L14.5 2Z"/>
                  <path d="M4 18L2 22"/>
                  <path d="M6 14L2 18"/>
                  <path d="M14.5 2L20 7.5L17 11L7 1L14.5 2Z"/>
                </svg>
              </div>
            </div>
          </div>

          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div class="stat-info">
                <span class="stat-number">${oficiaisCount}</span>
                <span class="stat-label">OFICIAIS</span>
              </div>
            </div>
            <div class="stat-box">
              <div class="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div class="stat-info">
                <span class="stat-number">${parceriasCount}</span>
                <span class="stat-label">PARCERIAS</span>
              </div>
            </div>
            <div class="stat-box">
              <div class="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div class="stat-info">
                <span class="stat-number">${afiliadosCount}</span>
                <span class="stat-label">AFILIADOS</span>
              </div>
            </div>
          </div>
        </section>

        ${oficiais.length > 0 ? `
        <section id="oficiais" class="section">
          <div class="section-header">
            <span class="section-tag">OFICIAIS</span>
            <span class="section-number">01</span>
          </div>
          <h2 class="section-title">Liderança da Aliança</h2>
          <p class="section-desc">Conheça os oficiais que fazem parte da liderança da Aliança VORTEX.</p>
          <div class="cards-scroll-container">
            <div class="cards-scroll">
              ${oficiais.map(o => `
                <div class="card">
                  <div class="card-avatar">
                    ${o.avatar ? `<img src="${o.avatar}" alt="${o.nome}">` : `<span class="avatar-placeholder">${o.nome.charAt(0)}</span>`}
                  </div>
                  <h3 class="card-name">${o.nome}</h3>
                  <p class="card-role">${o.cargo || ''}</p>
                  <p class="card-desc">${o.descricao || ''}</p>
                  <div class="card-links">
                    ${o.discord ? `<a href="${o.discord}" class="card-link" target="_blank"><span class="card-link-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span> Discord</a>` : ''}
                    ${o.whatsapp ? `<a href="${o.whatsapp}" class="card-link" target="_blank"><span class="card-link-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span> WhatsApp</a>` : ''}
                    ${o.instagram ? `<a href="${o.instagram}" class="card-link" target="_blank"><span class="card-link-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></span> Instagram</a>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>
        ` : ''}

        ${afiliadosCatKeys.length > 0 ? `
        <section id="afiliados" class="section">
          <div class="section-header">
            <span class="section-tag">AFILIADOS</span>
            <span class="section-number">${(oficiais.length > 0 ? 2 : 1).toString().padStart(2,'0')}</span>
          </div>
          <h2 class="section-title">Grupos Afiliados</h2>
          <p class="section-desc">Veja os afiliados e grupos conectados à nossa comunidade.</p>
          
          <div class="layout-toggle">
            <button class="layout-btn active" onclick="setLayout('afiliados','horizontal')" data-layout="horizontal">➡</button>
            <button class="layout-btn" onclick="setLayout('afiliados','vertical')" data-layout="vertical">⬇</button>
          </div>

          ${afiliadosCatKeys.map((key, idx) => `
            <div class="afiliados-category">
              <h3 class="category-title">${catDisplayMap[key]}</h3>
              <div class="cards-scroll-container" id="afiliados-${idx}-container">
                <div class="cards-scroll">
                  ${afiliadosByCat[key].map(a => `
                    <a href="${a.link || '#'}" class="card-group${a.vip ? ' card-vip' : ''}" target="_blank" rel="noopener">
                      <div class="card-group-image">
                        ${a.vip ? '<span class="vip-badge">⭐ VIP</span>' : ''}
                        ${a.logo ? `<img src="${a.logo}" alt="${a.nome}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                        <div class="card-group-placeholder" ${a.logo ? 'style="display:none"' : ''}>
                          <span>${a.nome.charAt(0).toUpperCase()}</span>
                        </div>
                        <div class="card-group-overlay"></div>
                      </div>
                      <div class="card-group-body">
                        <h3 class="card-group-name">${a.nome}</h3>
                        <div class="card-group-tags">
                          <span class="card-group-tag">${a.plataforma || 'WhatsApp'}</span>
                        </div>
                        <p class="card-group-desc">${a.descricao || ''}</p>
                        <span class="card-group-btn">ACESSAR ↗</span>
                      </div>
                    </a>
                  `).join('')}
                </div>
              </div>
            </div>
          `).join('')}
        </section>
        ` : ''}

        ${parcerias.length > 0 ? `
        <section id="parcerias" class="section">
          <div class="section-header">
            <span class="section-tag">PARCERIAS</span>
            <span class="section-number">${((oficiais.length > 0 ? 1 : 0) + (afiliadosCatKeys.length > 0 ? 1 : 0) + 1).toString().padStart(2,'0')}</span>
          </div>
          <h2 class="section-title">Aliados da Jornada</h2>
          <p class="section-desc">Encontre as parcerias que caminham junto com a Aliança VORTEX.</p>
          
          <div class="layout-toggle">
            <button class="layout-btn active" onclick="setLayout('parcerias','horizontal')" data-layout="horizontal">➡</button>
            <button class="layout-btn" onclick="setLayout('parcerias','vertical')" data-layout="vertical">⬇</button>
          </div>
          
          <div class="cards-scroll-container" id="parcerias-container">
            <div class="cards-scroll">
              ${parcerias.map(p => `
                <a href="${p.link || '#'}" class="card-group${p.vip ? ' card-vip' : ''}" target="_blank" rel="noopener">
                  <div class="card-group-image">
                    ${p.vip ? '<span class="vip-badge">⭐ VIP</span>' : ''}
                    ${p.logo ? `<img src="${p.logo}" alt="${p.nome}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                    <div class="card-group-placeholder" ${p.logo ? 'style="display:none"' : ''}>
                      <span>${p.nome.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="card-group-overlay"></div>
                  </div>
                  <div class="card-group-body">
                    <h3 class="card-group-name">${p.nome}</h3>
                    <div class="card-group-tags">
                      <span class="card-group-tag">${p.plataforma || 'Discord'}</span>
                      ${p.categoria ? `<span class="card-group-tag">${p.categoria}</span>` : ''}
                    </div>
                    <p class="card-group-desc">${p.descricao || ''}</p>
                    <span class="card-group-btn">ACESSAR ↗</span>
                  </div>
                </a>
              `).join('')}
            </div>
          </div>
        </section>
        ` : ''}

        <section class="sobre-section">
          <h2 class="sobre-title">SOBRE A ALIANÇA</h2>
          <p class="sobre-desc">Muito mais que uma conexão, uma verdadeira aliança.</p>
          <div class="sobre-grid">
            <div class="sobre-card">
              <div class="sobre-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3>UNIÃO</h3>
              <p>Conectamos grupos e comunidades com um objetivo em comum.</p>
            </div>
            <div class="sobre-card">
              <div class="sobre-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
              <h3>PARCERIAS</h3>
              <p>Parcerias fortes que geram visibilidade, crescimento e oportunidades.</p>
            </div>
            <div class="sobre-card">
              <div class="sobre-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>CONFIANÇA</h3>
              <p>Segurança e compromisso com todos os afiliados da aliança.</p>
            </div>
          </div>
        </section>

        <section class="cta-section">
          <div class="cta-card">
            <div class="cta-text">
              <h3>FAÇA PARTE DA ALIANÇA</h3>
              <p>Tem um grupo e quer crescer junto com a gente? Seja um afiliado da Aliança Vortex.</p>
            </div>
            <a href="${settings.whatsapp_link ? settings.whatsapp_link + (settings.whatsapp_link.includes('?') ? '&' : '?') + 'text=' + encodeURIComponent('Olá! Gostaria de solicitar uma afiliação com a Aliança VORTEX.') : '#'}" class="btn btn-primary" target="_blank">SOLICITAR AFILIAÇÃO</a>
          </div>
        </section>
      </main>

      <footer class="footer">
        <div class="footer-content">
          <div class="footer-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c41e3a" stroke-width="1.5"><path d="M14.5 2L20 7.5L9.5 18L4 18L4 12.5L14.5 2Z"/><path d="M4 18L2 22"/><path d="M6 14L2 18"/></svg>
            <span class="logo-text">ALIANÇA VORTEX</span>
          </div>
          <p class="footer-copy">${settings.footer_text || '© 2026 Aliança Vortex. Todos os direitos reservados.'}</p>
          <div class="footer-social">
            ${settings.whatsapp_link ? `<a href="${settings.whatsapp_link}" target="_blank" class="footer-social-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></a>` : ''}
            ${settings.instagram_link ? `<a href="${settings.instagram_link}" target="_blank" class="footer-social-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>` : ''}
            ${settings.discord_link ? `<a href="${settings.discord_link}" target="_blank" class="footer-social-link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></a>` : ''}
          </div>
        </div>
      </footer>

      <script src="/js/main.js"></script>
    </body>
    </html>`;
    
    res.send(html);
  } catch (err) {
    console.error('Erro na rota principal:', err);
    res.status(500).send('Erro interno do servidor');
  }
});

// Inicializar servidor
async function startServer() {
  await database.init();
  
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║          ⚔  ALIANÇA VORTEX - ONLINE  ⚔        ║
╠════════════════════════════════════════════════╣
║  Servidor: http://localhost:${PORT}              ║
║  Painel:   http://localhost:${PORT}/admin         ║
║  API:      http://localhost:${PORT}/api           ║
╚════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);

module.exports = app;
