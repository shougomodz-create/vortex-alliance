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
  if (!token) {
    console.log('[TURNSTILE] Token não fornecido');
    return false;
  }
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);
    const res = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });
    console.log('[TURNSTILE] Result:', JSON.stringify(res.data));
    if (res.data.success) return true;
    console.log('[TURNSTILE] Falha na verificação:', res.data['error-codes'] || 'unknown');
    return false;
  } catch (e) {
    console.error('[TURNSTILE] Erro na requisição:', e.message);
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
  const turnstileHtml = secret ? `<div class="form-group"><div class="cf-turnstile" data-sitekey="${sitekey}" data-theme="dark" data-callback="onTurnstileSuccess"></div></div>` : '';
  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Login - UNION</title><link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Nunito:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/admin.css"></head><body class="login-page"><div class="login-container"><div class="login-card"><div class="login-header"><svg class="login-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8b00ff" stroke-width="1.5"><path d="M14.5 2L20 7.5L9.5 18L4 18L4 12.5L14.5 2Z"/><path d="M4 18L2 22"/><path d="M6 14L2 18"/></svg><h1>ALIANÇA UNION</h1><p>Painel Administrativo</p></div><form id="loginForm" class="login-form"><div class="form-group"><label for="username">Usuário</label><input type="text" id="username" name="username" required placeholder="Digite seu usuário"></div><div class="form-group"><label for="password">Senha</label><input type="password" id="password" name="password" required placeholder="Digite sua senha"></div>${turnstileHtml}<div id="loginError" class="error-message" style="display:none;"></div><button type="submit" class="btn btn-primary btn-full" id="loginBtn">ENTRAR</button></form><a href="/" class="back-link">← Voltar ao site</a></div></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><script>var turnstileReady=false;function onTurnstileSuccess(){turnstileReady=true}window.addEventListener('load',function(){setTimeout(function(){if(typeof turnstile!=='undefined')turnstileReady=true},3000)});document.getElementById("loginForm").addEventListener("submit",function(e){e.preventDefault();var er=document.getElementById("loginError");er.style.display="none";var btn=document.getElementById("loginBtn");btn.disabled=true;btn.textContent="ENTRANDO...";var turnstileToken="";var tw=document.querySelector('[name="cf-turnstile-response"]');if(tw)turnstileToken=tw.value;if(${secret ? 'true' : 'false'} && !turnstileToken){er.textContent="Aguarde o captcha carregar ou clique nele novamente";er.style.display="block";btn.disabled=false;btn.textContent="ENTRAR";if(typeof turnstile!=='undefined'){try{turnstile.reset()}catch(ex){}}return}fetch("/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({username:document.getElementById("username").value,password:document.getElementById("password").value,turnstileToken:turnstileToken})}).then(function(r){return r.json()}).then(function(d){if(d.success){window.location.href="/admin"}else{er.textContent=d.error||"Erro ao fazer login";er.style.display="block";btn.disabled=false;btn.textContent="ENTRAR";if(typeof turnstile!=='undefined'){try{turnstile.reset()}catch(ex){}}}}).catch(function(){er.textContent="Erro de conexão";er.style.display="block";btn.disabled=false;btn.textContent="ENTRAR"})});</script></body></html>`);
});

router.post('/login', async (req, res) => {
  try {
    const { username, password, turnstileToken } = req.body;
    const ip = req.headers['cf-connecting-ip'] || req.ip || req.connection.remoteAddress;
    
    console.log('[LOGIN] Tentativa de login: ' + username + ' via ' + ip);
    
    // Verificar Turnstile se configurado (opcional - se falhar, libera login mas loga)
    const turnstileSecret = getTurnstileSecret();
    if (turnstileSecret && turnstileToken) {
      const turnstileOk = await verifyTurnstile(turnstileToken, ip);
      if (!turnstileOk) {
        console.log('[LOGIN] Turnstile falhou para ' + username + ' - permitindo login (captcha opcional)');
      }
    } else if (turnstileSecret && !turnstileToken) {
      console.log('[LOGIN] Turnstile ausente para ' + username + ' - permitindo login (captcha opcional)');
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
  res.send(layout('Dashboard', '<div class="stats-grid"><div class="stat-card"><div class="stat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b00ff" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="stat-info"><span class="stat-number">'+s.o+'</span><span class="stat-label">Oficiais</span></div></div><div class="stat-card"><div class="stat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b00ff" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div class="stat-info"><span class="stat-number">'+s.p+'</span><span class="stat-label">Parcerias</span></div></div><div class="stat-card"><div class="stat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b00ff" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div class="stat-info"><span class="stat-number">'+s.a+'</span><span class="stat-label">Afiliados</span></div></div></div>'));
});

// ===== OFICIAIS =====
router.get('/oficiais', authMiddleware, async (req, res) => {
  const data = await database.all('SELECT * FROM oficiais ORDER BY ordem ASC');
  const rows = data.map(function(o){return '<tr data-id="'+o.id+'"><td class="drag-handle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg></td><td>'+o.nome+'</td><td>'+(o.cargo||'-')+'</td><td><span class="badge '+(o.ativo?'badge-success':'badge-danger')+'">'+(o.ativo?'Ativo':'Inativo')+'</span></td><td class="actions"><button class="btn-icon" onclick="editOficial('+o.id+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon" onclick="deleteItem(\'oficiais\','+o.id+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>'}).join('');
  res.send(layout('Gerenciar Oficiais', '<div class="page-header"><h2>Gerenciar Oficiais</h2><button class="btn btn-primary" onclick="openModal(\'addOficial\')">+ Adicionar</button></div><div class="data-table-container"><table class="data-table" id="oficiaisTable"><thead><tr><th style="width:40px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg></th><th>Nome</th><th>Cargo</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+rows+'</tbody></table></div><div id="modalOficial" class="modal" style="display:none"><div class="modal-content modal-large"><div class="modal-header"><h3 id="modalOficialTitle">Adicionar Oficial</h3><button class="modal-close" onclick="closeModal(\'modalOficial\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><form id="formOficial"><input type="hidden" id="oficialId"><div class="form-row"><div class="form-group"><label>Nome *</label><input type="text" id="oficialNome" required></div><div class="form-group"><label>Cargo</label><input type="text" id="oficialCargo"></div></div><div class="form-group"><label>Descrição</label><textarea id="oficialDescricao" rows="3"></textarea></div><div class="form-row"><div class="form-group"><label>Discord</label><input type="text" id="oficialDiscord"></div><div class="form-group"><label>WhatsApp</label><input type="text" id="oficialWhatsapp"></div></div><div class="form-group"><label>Instagram</label><input type="text" id="oficialInstagram"></div><div class="form-group"><label>Foto (URL ou upload)</label><input type="text" id="oficialAvatar" placeholder="https://..."><input type="file" id="oficialAvatarFile" accept="image/*" class="mt-2"></div><div class="form-group"><label><input type="checkbox" id="oficialAtivo" checked> Ativo</label></div><div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal(\'modalOficial\')">Cancelar</button><button type="button" class="btn btn-primary" onclick="submitOficial()">Salvar</button></div></form></div></div>'));
});

// ===== PARCERIAS =====
router.get('/parcerias', authMiddleware, async (req, res) => {
  const data = await database.all('SELECT * FROM parcerias ORDER BY vip DESC, ordem ASC');
  const rows = data.map(function(p){return '<tr data-id="'+p.id+'"><td class="drag-handle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg></td><td>'+p.nome+'</td><td>'+(p.categoria||p.tipo||'-')+'</td><td><span class="badge '+(p.vip?'badge-vip':'badge-secondary')+'">'+(p.vip?'VIP':'')+'</span></td><td><span class="badge '+(p.ativo?'badge-success':'badge-danger')+'">'+(p.ativo?'Ativo':'Inativo')+'</span></td><td class="actions"><button class="btn-icon" onclick="editParceria('+p.id+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon" onclick="deleteItem(\'parcerias\','+p.id+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>'}).join('');
  res.send(layout('Gerenciar Parcerias', '<div class="page-header"><h2>Gerenciar Parcerias</h2><button class="btn btn-primary" onclick="openModal(\'addParceria\')">+ Adicionar</button></div><div class="data-table-container"><table class="data-table" id="parceriasTable"><thead><tr><th style="width:40px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg></th><th>Nome</th><th>Categoria</th><th>VIP</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+rows+'</tbody></table></div><div id="modalParceria" class="modal" style="display:none"><div class="modal-content modal-large"><div class="modal-header"><h3 id="modalParceriaTitle">Adicionar Parceria</h3><button class="modal-close" onclick="closeModal(\'modalParceria\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><form id="formParceria"><input type="hidden" id="parceriaId"><div class="form-group"><label>Link do Grupo/Canal</label><div class="input-with-btn"><input type="url" id="parceriaLinkInput" placeholder="Cole o link do Discord, WhatsApp..."><button type="button" class="btn btn-small" onclick="fetchLinkPreview(document.getElementById(\'parceriaLinkInput\').value,\'parceria\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Buscar</button></div><div id="parceriaPreview" class="preview-container"></div></div><div class="form-row"><div class="form-group"><label>Nome *</label><input type="text" id="parceriaNome" required></div><div class="form-group"><label>Plataforma</label><select id="parceriaPlataforma"><option value="Discord">Discord</option><option value="WhatsApp">WhatsApp</option><option value="Instagram">Instagram</option><option value="YouTube">YouTube</option><option value="Telegram">Telegram</option><option value="Canal WhatsApp">Canal WhatsApp</option><option value="Bot Telegram">Bot Telegram</option><option value="Canal Telegram">Canal Telegram</option><option value="Outro">Outro</option></select></div></div><div class="form-group"><label>Categoria</label><input type="text" id="parceriaCategoria" placeholder="Ex: Clan, Grupo"></div><div class="form-group"><label>Descrição</label><textarea id="parceriaDescricao" rows="3"></textarea></div><div class="form-row"><div class="form-group"><label>Link direto</label><input type="text" id="parceriaLink"></div><div class="form-group"><label>WhatsApp</label><input type="text" id="parceriaWhatsapp"></div></div><div class="form-group"><label>Logo (URL ou upload)</label><input type="text" id="parceriaLogo"><input type="file" id="parceriaLogoFile" accept="image/*" class="mt-2"></div><div class="checkbox-row"><div class="form-group"><label><input type="checkbox" id="parceriaAtivo" checked> Ativo</label></div><div class="form-group"><label><input type="checkbox" id="parceriaVip"> VIP (destaque)</label></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal(\'modalParceria\')">Cancelar</button><button type="button" class="btn btn-primary" onclick="submitParceria()">Salvar</button></div></form></div></div>'));
});

// ===== AFILIADOS =====
router.get('/afiliados', authMiddleware, async (req, res) => {
  const data = await database.all('SELECT * FROM afiliados ORDER BY vip DESC, ordem ASC');
  const rows = data.map(function(a){return '<tr data-id="'+a.id+'"><td class="drag-handle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg></td><td>'+a.nome+'</td><td>'+(a.categoria||a.tipo||'-')+'</td><td><span class="badge '+(a.vip?'badge-vip':'badge-secondary')+'">'+(a.vip?'VIP':'')+'</span></td><td><span class="badge '+(a.ativo?'badge-success':'badge-danger')+'">'+(a.ativo?'Ativo':'Inativo')+'</span></td><td class="actions"><button class="btn-icon" onclick="editAfiliado('+a.id+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon" onclick="deleteItem(\'afiliados\','+a.id+')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>'}).join('');
  res.send(layout('Gerenciar Afiliados', '<div class="page-header"><h2>Gerenciar Afiliados</h2><button class="btn btn-primary" onclick="openModal(\'addAfiliado\')">+ Adicionar</button></div><div class="data-table-container"><table class="data-table" id="afiliadosTable"><thead><tr><th style="width:40px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg></th><th>Nome</th><th>Categoria</th><th>VIP</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+rows+'</tbody></table></div><div id="modalAfiliado" class="modal" style="display:none"><div class="modal-content modal-large"><div class="modal-header"><h3 id="modalAfiliadoTitle">Adicionar Afiliado</h3><button class="modal-close" onclick="closeModal(\'modalAfiliado\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><form id="formAfiliado"><input type="hidden" id="afiliadoId"><div class="form-group"><label>Link do Grupo/Canal</label><div class="input-with-btn"><input type="url" id="afiliadoLinkInput" placeholder="Cole o link do Discord, WhatsApp..."><button type="button" class="btn btn-small" onclick="fetchLinkPreview(document.getElementById(\'afiliadoLinkInput\').value,\'afiliado\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Buscar</button></div><div id="afiliadoPreview" class="preview-container"></div></div><div class="form-row"><div class="form-group"><label>Nome *</label><input type="text" id="afiliadoNome" required></div><div class="form-group"><label>Plataforma</label><select id="afiliadoPlataforma"><option value="Discord">Discord</option><option value="WhatsApp">WhatsApp</option><option value="Instagram">Instagram</option><option value="YouTube">YouTube</option><option value="Telegram">Telegram</option><option value="Canal WhatsApp">Canal WhatsApp</option><option value="Bot Telegram">Bot Telegram</option><option value="Canal Telegram">Canal Telegram</option><option value="Outro">Outro</option></select></div></div><div class="form-group"><label>Categoria</label><input type="text" id="afiliadoCategoria" placeholder="Ex: Amizade, Clan, Grupo"></div><div class="form-group"><label>Descrição</label><textarea id="afiliadoDescricao" rows="3"></textarea></div><div class="form-row"><div class="form-group"><label>Link direto</label><input type="text" id="afiliadoLink"></div><div class="form-group"><label>WhatsApp</label><input type="text" id="afiliadoWhatsapp"></div></div><div class="form-group"><label>Logo (URL ou upload)</label><input type="text" id="afiliadoLogo"><input type="file" id="afiliadoLogoFile" accept="image/*" class="mt-2"></div><div class="checkbox-row"><div class="form-group"><label><input type="checkbox" id="afiliadoAtivo" checked> Ativo</label></div><div class="form-group"><label><input type="checkbox" id="afiliadoVip"> VIP (destaque)</label></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal(\'modalAfiliado\')">Cancelar</button><button type="button" class="btn btn-primary" onclick="submitAfiliado()">Salvar</button></div></form></div></div>'));
});

// ===== CONFIGURAÇÕES =====
router.get('/configuracoes', authMiddleware, async (req, res) => {
  const rows = await database.all('SELECT * FROM settings');
  const st = {}; rows.forEach(r => st[r.key] = r.value);
  res.send(layout('Configurações', '<form id="settingsForm" class="card"><h3>Geral</h3><div class="form-group"><label>Título do Site</label><input type="text" id="setting_site_title" value="'+(st.site_title||'')+'"></div><div class="form-group"><label>Descrição</label><textarea id="setting_description" rows="2">'+(st.description||'')+'</textarea></div><h3>Hero</h3><div class="form-group"><label>Título</label><input type="text" id="setting_hero_title" value="'+(st.hero_title||'')+'"></div><div class="form-group"><label>Subtítulo</label><input type="text" id="setting_hero_subtitle" value="'+(st.hero_subtitle||'')+'"></div><div class="form-group"><label>Descrição Hero</label><textarea id="setting_hero_description" rows="2">'+(st.hero_description||'')+'</textarea></div><h3>Redes Sociais</h3><div class="form-group"><label>WhatsApp</label><input type="text" id="setting_whatsapp_link" value="'+(st.whatsapp_link||'')+'"></div><div class="form-group"><label>Discord</label><input type="text" id="setting_discord_link" value="'+(st.discord_link||'')+'"></div><h3>Rodapé</h3><div class="form-group"><label>Texto</label><input type="text" id="setting_footer_text" value="'+(st.footer_text||'')+'"></div><div class="form-actions"><button type="button" class="btn btn-primary" onclick="submitSettings()">Salvar</button></div></form><div class="card" style="margin-top:1.5rem"><h3>Trocar Usuário e Senha</h3><div class="form-group"><label>Senha Atual *</label><input type="password" id="currentPassword" required></div><div class="form-row"><div class="form-group"><label>Novo Usuário</label><input type="text" id="newUsername" placeholder="Deixe vazio para manter"></div><div class="form-group"><label>Nova Senha</label><input type="password" id="newPassword" placeholder="Deixe vazio para manter"></div></div><div class="form-actions"><button type="button" class="btn btn-primary" onclick="submitChangePassword()">Atualizar Credenciais</button></div></div>'));
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
    const { nome, cargo, descricao, discord, whatsapp, instagram, ativo, avatar } = req.body;
    const url = req.file ? '/images/' + req.file.filename : avatar;
    const maxOrd = (await database.get('SELECT COALESCE(MAX(ordem),0)+1 as m FROM oficiais'))?.m || 0;
    const r = await database.run('INSERT INTO oficiais (nome,cargo,descricao,avatar,discord,whatsapp,instagram,ordem,ativo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id', [nome, cargo, descricao, url, discord, whatsapp, instagram, maxOrd, ativo==='true'?1:0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.put('/api/oficiais/:id', authMiddleware, upload.single('avatarFile'), async (req, res) => {
  try {
    const { nome, cargo, descricao, discord, whatsapp, instagram, ativo, avatar } = req.body;
    const url = req.file ? '/images/' + req.file.filename : avatar;
    await database.run('UPDATE oficiais SET nome=$1,cargo=$2,descricao=$3,avatar=$4,discord=$5,whatsapp=$6,instagram=$7,ativo=$8 WHERE id=$9', [nome, cargo, descricao, url, discord, whatsapp, instagram, ativo==='true'?1:0, req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.delete('/api/oficiais/:id', authMiddleware, async (req, res) => { await database.run('DELETE FROM oficiais WHERE id=$1', [req.params.id]); res.json({ success: true }); });
router.post('/api/oficiais/reorder', authMiddleware, async (req, res) => { for (const i of req.body.items) await database.run('UPDATE oficiais SET ordem=$1 WHERE id=$2', [i.ordem, i.id]); res.json({ success: true }); });

router.post('/api/parcerias', authMiddleware, upload.single('logoFile'), async (req, res) => {
  try {
    const { nome, tipo, descricao, link, whatsapp, plataforma, categoria, ativo, logo, vip } = req.body;
    const url = req.file ? '/images/' + req.file.filename : logo;
    const maxOrd = (await database.get('SELECT COALESCE(MAX(ordem),0)+1 as m FROM parcerias'))?.m || 0;
    const r = await database.run('INSERT INTO parcerias (nome,tipo,descricao,logo,link,whatsapp,membros,plataforma,categoria,ordem,ativo,vip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id', [nome, tipo, descricao, url, link, whatsapp, 0, plataforma||'Discord', categoria||'Geral', maxOrd, ativo==='true'?1:0, vip==='true'?1:0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.put('/api/parcerias/:id', authMiddleware, upload.single('logoFile'), async (req, res) => {
  try {
    const { nome, tipo, descricao, link, whatsapp, plataforma, categoria, ativo, logo, vip } = req.body;
    const url = req.file ? '/images/' + req.file.filename : logo;
    await database.run('UPDATE parcerias SET nome=$1,tipo=$2,descricao=$3,logo=$4,link=$5,whatsapp=$6,plataforma=$7,categoria=$8,ativo=$9,vip=$10 WHERE id=$11', [nome, tipo, descricao, url, link, whatsapp, plataforma||'Discord', categoria||'Geral', ativo==='true'?1:0, vip==='true'?1:0, req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.delete('/api/parcerias/:id', authMiddleware, async (req, res) => { await database.run('DELETE FROM parcerias WHERE id=$1', [req.params.id]); res.json({ success: true }); });
router.post('/api/parcerias/reorder', authMiddleware, async (req, res) => { for (const i of req.body.items) await database.run('UPDATE parcerias SET ordem=$1 WHERE id=$2', [i.ordem, i.id]); res.json({ success: true }); });

router.post('/api/afiliados', authMiddleware, upload.single('logoFile'), async (req, res) => {
  try {
    const { nome, tipo, descricao, link, whatsapp, plataforma, categoria, ativo, logo, vip } = req.body;
    const url = req.file ? '/images/' + req.file.filename : logo;
    const maxOrd = (await database.get('SELECT COALESCE(MAX(ordem),0)+1 as m FROM afiliados'))?.m || 0;
    const r = await database.run('INSERT INTO afiliados (nome,tipo,descricao,logo,link,whatsapp,membros,plataforma,categoria,ordem,ativo,vip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id', [nome, tipo, descricao, url, link, whatsapp, 0, plataforma||'Discord', categoria||'Geral', maxOrd, ativo==='true'?1:0, vip==='true'?1:0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.put('/api/afiliados/:id', authMiddleware, upload.single('logoFile'), async (req, res) => {
  try {
    const { nome, tipo, descricao, link, whatsapp, plataforma, categoria, ativo, logo, vip } = req.body;
    const url = req.file ? '/images/' + req.file.filename : logo;
    await database.run('UPDATE afiliados SET nome=$1,tipo=$2,descricao=$3,logo=$4,link=$5,whatsapp=$6,plataforma=$7,categoria=$8,ativo=$9,vip=$10 WHERE id=$11', [nome, tipo, descricao, url, link, whatsapp, plataforma||'Discord', categoria||'Geral', ativo==='true'?1:0, vip==='true'?1:0, req.params.id]);
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

router.post('/api/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    const user = await database.get('SELECT * FROM users WHERE id=$1', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    if (newUsername && newUsername !== user.username) {
      const exists = await database.get('SELECT id FROM users WHERE username=$1 AND id!=$2', [newUsername, user.id]);
      if (exists) return res.status(400).json({ error: 'Este nome de usuário já existe' });
      await database.run('UPDATE users SET username=$1 WHERE id=$2', [newUsername, user.id]);
    }
    if (newPassword) {
      const hash = bcrypt.hashSync(newPassword, 10);
      await database.run('UPDATE users SET password=$1 WHERE id=$2', [hash, user.id]);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

function layout(title, content) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} - UNION</title><link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Nunito:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/admin.css"></head><body><div class="menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open');document.querySelector('.sidebar-overlay').classList.toggle('open')"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></div><div class="sidebar-overlay" onclick="document.querySelector('.sidebar').classList.remove('open');this.classList.remove('open')"></div><div class="admin-layout"><aside class="sidebar"><div class="sidebar-header"><svg class="sidebar-logo" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b00ff" stroke-width="1.5"><path d="M14.5 2L20 7.5L9.5 18L4 18L4 12.5L14.5 2Z"/><path d="M4 18L2 22"/><path d="M6 14L2 18"/></svg><span class="sidebar-title">UNION</span></div><nav class="sidebar-nav"><a href="/admin" class="nav-item ${title==='Dashboard'?'active':''}"><span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span> Dashboard</a><a href="/admin/oficiais" class="nav-item ${title==='Gerenciar Oficiais'?'active':''}"><span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span> Oficiais</a><a href="/admin/parcerias" class="nav-item ${title==='Gerenciar Parcerias'?'active':''}"><span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span> Parcerias</a><a href="/admin/afiliados" class="nav-item ${title==='Gerenciar Afiliados'?'active':''}"><span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span> Afiliados</a><a href="/admin/configuracoes" class="nav-item ${title==='Configurações'?'active':''}"><span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span> Configurações</a></nav><div class="sidebar-footer"><a href="/" class="nav-item" target="_blank"><span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span> Ver Site</a><button onclick="logout()" class="nav-item"><span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span> Sair</button></div></aside><main class="main-content"><header class="topbar"><h1 class="page-title">${title}</h1><div class="user-info"><span>Admin</span></div></header><div class="content">${content}</div></main></div><script src="/js/admin.js"></script></body></html>`;
}

module.exports = router;
