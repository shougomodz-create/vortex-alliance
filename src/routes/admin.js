const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const database = require('../database');
const authMiddleware = require('../middleware/auth');

const getTurnstileSecret = () => process.env.TURNSTILE_SECRET_KEY || '';
const getTurnstileSitekey = () => process.env.TURNSTILE_SITEKEY || '0x4AAAAAACzvNarbs8yzOoKh';

async function verifyTurnstile(token, ip) {
  const secret = getTurnstileSecret();
  if (!secret) return true;
  if (!token) return false;
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);
    const res = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });
    console.log('[TURNSTILE] Result:', JSON.stringify(res.data));
    return res.data.success === true;
  } catch (e) {
    console.error('[TURNSTILE] Erro:', e.message);
    return false;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', '..', 'public', 'images')),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ===== LOGIN =====
router.get('/login', (req, res) => {
  const secret = getTurnstileSecret();
  const sitekey = getTurnstileSitekey();
  console.log('[LOGIN] Turnstile Secret exists:', !!secret, 'Sitekey:', sitekey);
  const turnstileHtml = secret ? `<div class="form-group"><div class="cf-turnstile" data-sitekey="${sitekey}" data-theme="dark"></div></div>` : '';
  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Login - VORTEX</title><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/admin.css"></head><body class="login-page"><div class="login-container"><div class="login-card"><div class="login-header"><span class="login-icon">⚔</span><h1>ALIANÇA VORTEX</h1><p>Painel Administrativo</p></div><form id="loginForm" class="login-form"><div class="form-group"><label for="username">Usuário</label><input type="text" id="username" name="username" required placeholder="Digite seu usuário"></div><div class="form-group"><label for="password">Senha</label><input type="password" id="password" name="password" required placeholder="Digite sua senha"></div>${turnstileHtml}<div id="loginError" class="error-message" style="display:none;"></div><button type="submit" class="btn btn-primary btn-full" id="loginBtn">ENTRAR</button></form><a href="/" class="back-link">← Voltar ao site</a></div></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><script>document.getElementById("loginForm").addEventListener("submit",function(e){e.preventDefault();var er=document.getElementById("loginError");er.style.display="none";var btn=document.getElementById("loginBtn");btn.disabled=true;btn.textContent="ENTRANDO...";var turnstileToken="";var tw=document.querySelector('[name="cf-turnstile-response"]');if(tw)turnstileToken=tw.value;if(${secret ? 'true' : 'false'} && !turnstileToken){er.textContent="Confirme o captcha";er.style.display="block";btn.disabled=false;btn.textContent="ENTRAR";return}fetch("/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({username:document.getElementById("username").value,password:document.getElementById("password").value,turnstileToken:turnstileToken})}).then(function(r){return r.json()}).then(function(d){if(d.success){window.location.href="/admin"}else{er.textContent=d.error||"Erro ao fazer login";er.style.display="block";btn.disabled=false;btn.textContent="ENTRAR"}}).catch(function(){er.textContent="Erro de conexão";er.style.display="block";btn.disabled=false;btn.textContent="ENTRAR"})});</script></body></html>`);
});

router.post('/login', async (req, res) => {
  try {
    const { username, password, turnstileToken } = req.body;
    const ip = req.headers['cf-connecting-ip'] || req.ip || req.connection.remoteAddress;
    
    console.log('[LOGIN] Tentativa de login: ' + username + ' via ' + ip);
    
    // Verificar Turnstile se configurado
    if (getTurnstileSecret()) {
      const turnstileOk = await verifyTurnstile(turnstileToken, ip);
      if (!turnstileOk) {
        console.log('[LOGIN] Turnstile falhou para: ' + username);
        return res.status(401).json({ error: 'Captcha inválido. Tente novamente.' });
      }
    }
    
    const user = await database.get('SELECT * FROM users WHERE username = $1', [username]);
    if (!user) {
      console.log('[LOGIN] Usuário não encontrado: ' + username);
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    
    if (!bcrypt.compareSync(password, user.password)) {
      console.log('[LOGIN] Senha incorreta para: ' + username);
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'vtx-fallback-secret-key-production';
    const isProduction = process.env.NODE_ENV === 'production';
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      jwtSecret,
      { expiresIn: '12h' }
    );
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 12 * 60 * 60 * 1000,
      sameSite: 'lax',
      path: '/'
    });
    
    console.log('[LOGIN] Login sucesso: ' + username + ' via ' + ip + ' em ' + new Date().toLocaleString('pt-BR'));
    res.json({ success: true });
  } catch (err) {
    console.error('[LOGIN] ERRO:', err.message, err.stack);
    res.status(500).json({ error: 'Erro ao fazer login: ' + err.message });
  }
});

router.post('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', { path: '/', httpOnly: true, secure: isProduction, sameSite: 'lax' });
  res.json({ success: true });
});

// ===== DASHBOARD =====
router.get('/', authMiddleware, async (req, res) => {
  const s = {
    o: (await database.get('SELECT COUNT(*) as c FROM oficiais'))?.c||0,
    p: (await database.get('SELECT COUNT(*) as c FROM parcerias'))?.c||0,
    a: (await database.get('SELECT COUNT(*) as c FROM afiliados'))?.c||0
  };
  res.send(layout('Dashboard', '<div class="stats-grid"><div class="stat-card"><div class="stat-icon">👤</div><div class="stat-info"><span class="stat-number">'+s.o+'</span><span class="stat-label">Oficiais</span></div></div><div class="stat-card"><div class="stat-icon">🤝</div><div class="stat-info"><span class="stat-number">'+s.p+'</span><span class="stat-label">Parcerias</span></div></div><div class="stat-card"><div class="stat-icon">👥</div><div class="stat-info"><span class="stat-number">'+s.a+'</span><span class="stat-label">Afiliados</span></div></div></div>'));
});

// ===== OFICIAIS =====
router.get('/oficiais', authMiddleware, async (req, res) => {
  const data = await database.all('SELECT * FROM oficiais ORDER BY ordem ASC');
  const rows = data.map(function(o){return '<tr data-id="'+o.id+'"><td class="drag-handle">⋮⋮</td><td>'+o.ordem+'</td><td>'+o.nome+'</td><td>'+(o.cargo||'-')+'</td><td><span class="badge '+(o.ativo?'badge-success':'badge-danger')+'">'+(o.ativo?'Ativo':'Inativo')+'</span></td><td class="actions"><button class="btn-icon" onclick="editOficial('+o.id+')">✏️</button><button class="btn-icon" onclick="deleteItem(\'oficiais\','+o.id+')">🗑️</button></td></tr>'}).join('');
  res.send(layout('Gerenciar Oficiais', '<div class="page-header"><h2>Gerenciar Oficiais</h2><button class="btn btn-primary" onclick="openModal(\'addOficial\')">+ Adicionar</button></div><div class="data-table-container"><table class="data-table" id="oficiaisTable"><thead><tr><th style="width:40px">⋮⋮</th><th>Ordem</th><th>Nome</th><th>Cargo</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+rows+'</tbody></table></div><div id="modalOficial" class="modal" style="display:none"><div class="modal-content modal-large"><div class="modal-header"><h3 id="modalOficialTitle">Adicionar Oficial</h3><button class="modal-close" onclick="closeModal(\'modalOficial\')">&times;</button></div><form id="formOficial"><input type="hidden" id="oficialId"><div class="form-row"><div class="form-group"><label>Nome *</label><input type="text" id="oficialNome" required></div><div class="form-group"><label>Cargo</label><input type="text" id="oficialCargo"></div></div><div class="form-group"><label>Descrição</label><textarea id="oficialDescricao" rows="3"></textarea></div><div class="form-row"><div class="form-group"><label>Discord</label><input type="text" id="oficialDiscord"></div><div class="form-group"><label>WhatsApp</label><input type="text" id="oficialWhatsapp"></div></div><div class="form-row"><div class="form-group"><label>Instagram</label><input type="text" id="oficialInstagram"></div><div class="form-group"><label>Ordem</label><input type="number" id="oficialOrdem" value="0"></div></div><div class="form-group"><label>Foto (URL ou upload)</label><input type="text" id="oficialAvatar" placeholder="https://..."><input type="file" id="oficialAvatarFile" accept="image/*" class="mt-2"></div><div class="form-group"><label><input type="checkbox" id="oficialAtivo" checked> Ativo</label></div><div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal(\'modalOficial\')">Cancelar</button><button type="button" class="btn btn-primary" onclick="submitOficial()">Salvar</button></div></form></div></div>'));
});

// ===== PARCERIAS =====
router.get('/parcerias', authMiddleware, async (req, res) => {
  const data = await database.all('SELECT * FROM parcerias ORDER BY vip DESC, ordem ASC');
  const rows = data.map(function(p){return '<tr data-id="'+p.id+'"><td class="drag-handle">⋮⋮</td><td>'+p.ordem+'</td><td>'+p.nome+'</td><td>'+(p.categoria||p.tipo||'-')+'</td><td><span class="badge '+(p.vip?'badge-vip':'badge-secondary')+'">'+(p.vip?'VIP':'')+'</span></td><td><span class="badge '+(p.ativo?'badge-success':'badge-danger')+'">'+(p.ativo?'Ativo':'Inativo')+'</span></td><td class="actions"><button class="btn-icon" onclick="editParceria('+p.id+')">✏️</button><button class="btn-icon" onclick="deleteItem(\'parcerias\','+p.id+')">🗑️</button></td></tr>'}).join('');
  res.send(layout('Gerenciar Parcerias', '<div class="page-header"><h2>Gerenciar Parcerias</h2><button class="btn btn-primary" onclick="openModal(\'addParceria\')">+ Adicionar</button></div><div class="data-table-container"><table class="data-table" id="parceriasTable"><thead><tr><th style="width:40px">⋮⋮</th><th>Ordem</th><th>Nome</th><th>Categoria</th><th>VIP</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+rows+'</tbody></table></div><div id="modalParceria" class="modal" style="display:none"><div class="modal-content modal-large"><div class="modal-header"><h3 id="modalParceriaTitle">Adicionar Parceria</h3><button class="modal-close" onclick="closeModal(\'modalParceria\')">&times;</button></div><form id="formParceria"><input type="hidden" id="parceriaId"><div class="form-group"><label>Link do Grupo/Canal</label><div class="input-with-btn"><input type="url" id="parceriaLinkInput" placeholder="Cole o link do Discord, WhatsApp..."><button type="button" class="btn btn-small" onclick="fetchLinkPreview(document.getElementById(\'parceriaLinkInput\').value,\'parceria\')">🔍 Buscar</button></div><div id="parceriaPreview" class="preview-container"></div></div><div class="form-row"><div class="form-group"><label>Nome *</label><input type="text" id="parceriaNome" required></div><div class="form-group"><label>Plataforma</label><select id="parceriaPlataforma"><option value="Discord">Discord</option><option value="WhatsApp">WhatsApp</option><option value="Instagram">Instagram</option><option value="YouTube">YouTube</option><option value="Telegram">Telegram</option><option value="Canal WhatsApp">Canal WhatsApp</option><option value="Bot Telegram">Bot Telegram</option><option value="Canal Telegram">Canal Telegram</option><option value="Outro">Outro</option></select></div></div><div class="form-row"><div class="form-group"><label>Categoria</label><input type="text" id="parceriaCategoria" placeholder="Ex: Clan, Grupo"></div><div class="form-group"><label>Membros</label><input type="number" id="parceriaMembros" placeholder="Ex: 500" min="0"></div></div><div class="form-group"><label>Descrição</label><textarea id="parceriaDescricao" rows="3"></textarea></div><div class="form-row"><div class="form-group"><label>Link direto</label><input type="text" id="parceriaLink"></div><div class="form-group"><label>WhatsApp</label><input type="text" id="parceriaWhatsapp"></div></div><div class="form-row"><div class="form-group"><label>Ordem</label><input type="number" id="parceriaOrdem" value="0"></div><div class="form-group"><label>Logo (URL ou upload)</label><input type="text" id="parceriaLogo"><input type="file" id="parceriaLogoFile" accept="image/*" class="mt-2"></div></div><div class="checkbox-row"><div class="form-group"><label><input type="checkbox" id="parceriaAtivo" checked> Ativo</label></div><div class="form-group"><label><input type="checkbox" id="parceriaVip"> VIP (destaque)</label></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal(\'modalParceria\')">Cancelar</button><button type="button" class="btn btn-primary" onclick="submitParceria()">Salvar</button></div></form></div></div>'));
});

// ===== AFILIADOS =====
router.get('/afiliados', authMiddleware, async (req, res) => {
  const data = await database.all('SELECT * FROM afiliados ORDER BY vip DESC, ordem ASC');
  const rows = data.map(function(a){return '<tr data-id="'+a.id+'"><td class="drag-handle">⋮⋮</td><td>'+a.ordem+'</td><td>'+a.nome+'</td><td>'+(a.categoria||a.tipo||'-')+'</td><td><span class="badge '+(a.vip?'badge-vip':'badge-secondary')+'">'+(a.vip?'VIP':'')+'</span></td><td><span class="badge '+(a.ativo?'badge-success':'badge-danger')+'">'+(a.ativo?'Ativo':'Inativo')+'</span></td><td class="actions"><button class="btn-icon" onclick="editAfiliado('+a.id+')">✏️</button><button class="btn-icon" onclick="deleteItem(\'afiliados\','+a.id+')">🗑️</button></td></tr>'}).join('');
  res.send(layout('Gerenciar Afiliados', '<div class="page-header"><h2>Gerenciar Afiliados</h2><button class="btn btn-primary" onclick="openModal(\'addAfiliado\')">+ Adicionar</button></div><div class="data-table-container"><table class="data-table" id="afiliadosTable"><thead><tr><th style="width:40px">⋮⋮</th><th>Ordem</th><th>Nome</th><th>Categoria</th><th>VIP</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+rows+'</tbody></table></div><div id="modalAfiliado" class="modal" style="display:none"><div class="modal-content modal-large"><div class="modal-header"><h3 id="modalAfiliadoTitle">Adicionar Afiliado</h3><button class="modal-close" onclick="closeModal(\'modalAfiliado\')">&times;</button></div><form id="formAfiliado"><input type="hidden" id="afiliadoId"><div class="form-group"><label>Link do Grupo/Canal</label><div class="input-with-btn"><input type="url" id="afiliadoLinkInput" placeholder="Cole o link do Discord, WhatsApp..."><button type="button" class="btn btn-small" onclick="fetchLinkPreview(document.getElementById(\'afiliadoLinkInput\').value,\'afiliado\')">🔍 Buscar</button></div><div id="afiliadoPreview" class="preview-container"></div></div><div class="form-row"><div class="form-group"><label>Nome *</label><input type="text" id="afiliadoNome" required></div><div class="form-group"><label>Plataforma</label><select id="afiliadoPlataforma"><option value="Discord">Discord</option><option value="WhatsApp">WhatsApp</option><option value="Instagram">Instagram</option><option value="YouTube">YouTube</option><option value="Telegram">Telegram</option><option value="Canal WhatsApp">Canal WhatsApp</option><option value="Bot Telegram">Bot Telegram</option><option value="Canal Telegram">Canal Telegram</option><option value="Outro">Outro</option></select></div></div><div class="form-row"><div class="form-group"><label>Categoria</label><input type="text" id="afiliadoCategoria" placeholder="Ex: Amizade, Clan, Grupo"></div><div class="form-group"><label>Membros</label><input type="number" id="afiliadoMembros" placeholder="Ex: 500" min="0"></div></div><div class="form-group"><label>Descrição</label><textarea id="afiliadoDescricao" rows="3"></textarea></div><div class="form-row"><div class="form-group"><label>Link direto</label><input type="text" id="afiliadoLink"></div><div class="form-group"><label>WhatsApp</label><input type="text" id="afiliadoWhatsapp"></div></div><div class="form-row"><div class="form-group"><label>Ordem</label><input type="number" id="afiliadoOrdem" value="0"></div><div class="form-group"><label>Logo (URL ou upload)</label><input type="text" id="afiliadoLogo"><input type="file" id="afiliadoLogoFile" accept="image/*" class="mt-2"></div></div><div class="checkbox-row"><div class="form-group"><label><input type="checkbox" id="afiliadoAtivo" checked> Ativo</label></div><div class="form-group"><label><input type="checkbox" id="afiliadoVip"> VIP (destaque)</label></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal(\'modalAfiliado\')">Cancelar</button><button type="button" class="btn btn-primary" onclick="submitAfiliado()">Salvar</button></div></form></div></div>'));
});

// ===== CONFIGURAÇÕES =====
router.get('/configuracoes', authMiddleware, async (req, res) => {
  const rows = await database.all('SELECT * FROM settings');
  const st = {}; rows.forEach(r => st[r.key] = r.value);
  res.send(layout('Configurações', '<form id="settingsForm" class="card"><h3>Geral</h3><div class="form-group"><label>Título do Site</label><input type="text" id="setting_site_title" value="'+(st.site_title||'')+'"></div><div class="form-group"><label>Descrição</label><textarea id="setting_description" rows="2">'+(st.description||'')+'</textarea></div><h3>Hero</h3><div class="form-group"><label>Título</label><input type="text" id="setting_hero_title" value="'+(st.hero_title||'')+'"></div><div class="form-group"><label>Subtítulo</label><input type="text" id="setting_hero_subtitle" value="'+(st.hero_subtitle||'')+'"></div><div class="form-group"><label>Descrição Hero</label><textarea id="setting_hero_description" rows="2">'+(st.hero_description||'')+'</textarea></div><h3>Redes Sociais</h3><div class="form-group"><label>WhatsApp</label><input type="text" id="setting_whatsapp_link" value="'+(st.whatsapp_link||'')+'"></div><div class="form-group"><label>Discord</label><input type="text" id="setting_discord_link" value="'+(st.discord_link||'')+'"></div><h3>Rodapé</h3><div class="form-group"><label>Texto</label><input type="text" id="setting_footer_text" value="'+(st.footer_text||'')+'"></div><div class="form-actions"><button type="button" class="btn btn-primary" onclick="submitSettings()">Salvar</button></div></form>'));
});

// ===== API CRUD =====
// GET - Listar todos (admin, inclui inativos)
router.get('/api/oficiais', authMiddleware, async (req, res) => {
  try {
    const data = await database.all('SELECT * FROM oficiais ORDER BY ordem ASC');
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/parcerias', authMiddleware, async (req, res) => {
  try {
    const data = await database.all('SELECT * FROM parcerias ORDER BY ordem ASC');
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/afiliados', authMiddleware, async (req, res) => {
  try {
    const data = await database.all('SELECT * FROM afiliados ORDER BY ordem ASC');
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/oficiais', authMiddleware, upload.single('avatarFile'), async (req, res) => {
  try {
    const { nome, cargo, descricao, discord, whatsapp, instagram, ordem, ativo, avatar } = req.body;
    const url = req.file ? '/images/' + req.file.filename : avatar;
    const r = await database.run('INSERT INTO oficiais (nome,cargo,descricao,avatar,discord,whatsapp,instagram,ordem,ativo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id', [nome, cargo, descricao, url, discord, whatsapp, instagram, parseInt(ordem)||0, ativo==='true'?1:0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.put('/api/oficiais/:id', authMiddleware, upload.single('avatarFile'), async (req, res) => {
  try {
    const { nome, cargo, descricao, discord, whatsapp, instagram, ordem, ativo, avatar } = req.body;
    const url = req.file ? '/images/' + req.file.filename : avatar;
    await database.run('UPDATE oficiais SET nome=$1,cargo=$2,descricao=$3,avatar=$4,discord=$5,whatsapp=$6,instagram=$7,ordem=$8,ativo=$9 WHERE id=$10', [nome, cargo, descricao, url, discord, whatsapp, instagram, parseInt(ordem)||0, ativo==='true'?1:0, req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.delete('/api/oficiais/:id', authMiddleware, async (req, res) => { await database.run('DELETE FROM oficiais WHERE id=$1', [req.params.id]); res.json({ success: true }); });
router.post('/api/oficiais/reorder', authMiddleware, async (req, res) => { for (const i of req.body.items) await database.run('UPDATE oficiais SET ordem=$1 WHERE id=$2', [i.ordem, i.id]); res.json({ success: true }); });

router.post('/api/parcerias', authMiddleware, upload.single('logoFile'), async (req, res) => {
  try {
    const { nome, tipo, descricao, link, whatsapp, membros, plataforma, categoria, ordem, ativo, logo, vip } = req.body;
    const url = req.file ? '/images/' + req.file.filename : logo;
    const r = await database.run('INSERT INTO parcerias (nome,tipo,descricao,logo,link,whatsapp,membros,plataforma,categoria,ordem,ativo,vip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id', [nome, tipo, descricao, url, link, whatsapp, parseInt(membros)||0, plataforma||'Discord', categoria||'Geral', parseInt(ordem)||0, ativo==='true'?1:0, vip==='true'?1:0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.put('/api/parcerias/:id', authMiddleware, upload.single('logoFile'), async (req, res) => {
  try {
    const { nome, tipo, descricao, link, whatsapp, membros, plataforma, categoria, ordem, ativo, logo, vip } = req.body;
    const url = req.file ? '/images/' + req.file.filename : logo;
    await database.run('UPDATE parcerias SET nome=$1,tipo=$2,descricao=$3,logo=$4,link=$5,whatsapp=$6,membros=$7,plataforma=$8,categoria=$9,ordem=$10,ativo=$11,vip=$12 WHERE id=$13', [nome, tipo, descricao, url, link, whatsapp, parseInt(membros)||0, plataforma||'Discord', categoria||'Geral', parseInt(ordem)||0, ativo==='true'?1:0, vip==='true'?1:0, req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.delete('/api/parcerias/:id', authMiddleware, async (req, res) => { await database.run('DELETE FROM parcerias WHERE id=$1', [req.params.id]); res.json({ success: true }); });
router.post('/api/parcerias/reorder', authMiddleware, async (req, res) => { for (const i of req.body.items) await database.run('UPDATE parcerias SET ordem=$1 WHERE id=$2', [i.ordem, i.id]); res.json({ success: true }); });

router.post('/api/afiliados', authMiddleware, upload.single('logoFile'), async (req, res) => {
  try {
    const { nome, tipo, descricao, link, whatsapp, membros, plataforma, categoria, ordem, ativo, logo, vip } = req.body;
    const url = req.file ? '/images/' + req.file.filename : logo;
    const r = await database.run('INSERT INTO afiliados (nome,tipo,descricao,logo,link,whatsapp,membros,plataforma,categoria,ordem,ativo,vip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id', [nome, tipo, descricao, url, link, whatsapp, parseInt(membros)||0, plataforma||'Discord', categoria||'Geral', parseInt(ordem)||0, ativo==='true'?1:0, vip==='true'?1:0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.put('/api/afiliados/:id', authMiddleware, upload.single('logoFile'), async (req, res) => {
  try {
    const { nome, tipo, descricao, link, whatsapp, membros, plataforma, categoria, ordem, ativo, logo, vip } = req.body;
    const url = req.file ? '/images/' + req.file.filename : logo;
    await database.run('UPDATE afiliados SET nome=$1,tipo=$2,descricao=$3,logo=$4,link=$5,whatsapp=$6,membros=$7,plataforma=$8,categoria=$9,ordem=$10,ativo=$11,vip=$12 WHERE id=$13', [nome, tipo, descricao, url, link, whatsapp, parseInt(membros)||0, plataforma||'Discord', categoria||'Geral', parseInt(ordem)||0, ativo==='true'?1:0, vip==='true'?1:0, req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.delete('/api/afiliados/:id', authMiddleware, async (req, res) => { await database.run('DELETE FROM afiliados WHERE id=$1', [req.params.id]); res.json({ success: true }); });
router.post('/api/afiliados/reorder', authMiddleware, async (req, res) => { for (const i of req.body.items) await database.run('UPDATE afiliados SET ordem=$1 WHERE id=$2', [i.ordem, i.id]); res.json({ success: true }); });

router.post('/api/settings', authMiddleware, async (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    if (k.startsWith('setting_')) {
      const key = k.replace('setting_', '');
      const ex = await database.get('SELECT id FROM settings WHERE key=$1', [key]);
      if (ex) await database.run('UPDATE settings SET value=$1 WHERE key=$2', [v, key]);
      else await database.run('INSERT INTO settings (key,value) VALUES ($1,$2)', [key, v]);
    }
  }
  res.json({ success: true });
});

function layout(title, content) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} - VORTEX</title><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/admin.css"></head><body><div class="menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open');document.querySelector('.sidebar-overlay').classList.toggle('open')">☰</div><div class="sidebar-overlay" onclick="document.querySelector('.sidebar').classList.remove('open');this.classList.remove('open')"></div><div class="admin-layout"><aside class="sidebar"><div class="sidebar-header"><span class="sidebar-logo">⚔</span><span class="sidebar-title">VORTEX</span></div><nav class="sidebar-nav"><a href="/admin" class="nav-item ${title==='Dashboard'?'active':''}"><span class="nav-icon">📊</span> Dashboard</a><a href="/admin/oficiais" class="nav-item ${title==='Gerenciar Oficiais'?'active':''}"><span class="nav-icon">👤</span> Oficiais</a><a href="/admin/parcerias" class="nav-item ${title==='Gerenciar Parcerias'?'active':''}"><span class="nav-icon">🤝</span> Parcerias</a><a href="/admin/afiliados" class="nav-item ${title==='Gerenciar Afiliados'?'active':''}"><span class="nav-icon">👥</span> Afiliados</a><a href="/admin/configuracoes" class="nav-item ${title==='Configurações'?'active':''}"><span class="nav-icon">⚙</span> Configurações</a></nav><div class="sidebar-footer"><a href="/" class="nav-item" target="_blank"><span class="nav-icon">🌐</span> Ver Site</a><button onclick="logout()" class="nav-item"><span class="nav-icon">🚪</span> Sair</button></div></aside><main class="main-content"><header class="topbar"><h1 class="page-title">${title}</h1><div class="user-info"><span>Admin</span></div></header><div class="content">${content}</div></main></div><script src="/js/admin.js"></script></body></html>`;
}

module.exports = router;
