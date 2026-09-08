const express = require('express');
const router = express.Router();
const database = require('../database');
const https = require('https');
const http = require('http');

// GET - Root
router.get('/', (req, res) => {
  res.json({ 
    endpoints: ['/settings', '/oficiais', '/parcerias', '/afiliados', '/stats', '/visit', '/preview'] 
  });
});

// GET - Preview de link (busca metadados)
router.get('/preview', (req, res) => {
  const { url, platform } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL é obrigatória' });
  }
  
  // Buscar página e extrair metadados
  fetchMetaTags(url)
    .then(meta => {
      const detectedPlatform = platform || detectPlatformFromUrl(url);
      
      let result = {
        nome: meta.ogTitle || meta.title || '',
        descricao: meta.ogDescription || meta.description || '',
        logo: meta.ogImage || meta.favicon || '',
        tipo: detectType(url, platform),
        plataforma: detectedPlatform,
        membros: null,
        url: url
      };
      
      const html = meta.html || '';
      
      // Discord: "X Members" ou "X Online"
      const discordMembers = html.match(/([\d.,]+)\s*(?:Members|Membros|Mitglieder)/i);
      if (discordMembers) {
        result.membros = parseMemberCount(discordMembers[1]);
      }
      
      // WhatsApp: "X participants" ou "participantes"
      if (!result.membros) {
        const waMembers = html.match(/([\d.,]+)\s*(?:participants|participantes|member|membro)/i);
        if (waMembers) {
          result.membros = parseMemberCount(waMembers[1]);
        }
      }
      
      // YouTube subscribers
      if (!result.membros) {
        const ytSubs = html.match(/([\d.,]+)\s*(?:subscribers|inscritos)/i);
        if (ytSubs) {
          result.membros = parseMemberCount(ytSubs[1]);
        }
      }
      
      // Instagram followers
      if (!result.membros) {
        const igFollowers = html.match(/([\d.,]+)\s*(?:followers|seguidores)/i);
        if (igFollowers) {
          result.membros = parseMemberCount(igFollowers[1]);
        }
      }

      // Generic: "Xk members" / "X mil membros"
      if (!result.membros) {
        const generic = html.match(/([\d.,]+[kKmM]?)\s*(?:membros|members|users|usuários|pessoas|people)/i);
        if (generic) {
          result.membros = parseMemberCount(generic[1]);
        }
      }
      
      res.json(result);
    })
    .catch(err => {
      console.error('Erro ao buscar preview:', err);
      // Retornar dados básicos mesmo com erro
      res.json({
        nome: extractNameFromUrl(url),
        descricao: '',
        logo: '',
        tipo: detectType(url, platform),
        membros: null,
        url: url
      });
    });
});

// Funções auxiliares para preview
function fetchMetaTags(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    }, (res) => {
      // Seguir redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchMetaTags(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const meta = {
          title: extractTag(data, 'title'),
          description: extractTag(data, 'description'),
          ogTitle: extractMetaProperty(data, 'og:title'),
          ogDescription: extractMetaProperty(data, 'og:description'),
          ogImage: extractMetaProperty(data, 'og:image'),
          favicon: extractFavicon(data, url),
          html: data
        };
        resolve(meta);
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function extractMetaProperty(html, prop) {
  const match = html.match(new RegExp(`property="${prop}"[^>]*content="([^"]*)"`, 'i'));
  if (match) return match[1];
  const match2 = html.match(new RegExp(`content="([^"]*)"[^>]*property="${prop}"`, 'i'));
  return match2 ? match2[1] : null;
}

function extractFavicon(html, baseUrl) {
  const match = html.match(/rel="icon"[^>]*href="([^"]*)"/i) || 
                html.match(/rel="shortcut icon"[^>]*href="([^"]*)"/i);
  if (match) {
    let href = match[1];
    if (href.startsWith('/')) {
      const urlObj = new URL(baseUrl);
      href = urlObj.origin + href;
    }
    return href;
  }
  return null;
}

function detectType(url, platform) {
  if (platform === 'discord' || url.includes('discord')) return 'Discord Server';
  if (platform === 'whatsapp' || url.includes('whatsapp') || url.includes('wa.me')) return 'WhatsApp Group';
  if (platform === 'instagram' || url.includes('instagram')) return 'Instagram';
  if (platform === 'youtube' || url.includes('youtube')) return 'YouTube';
  if (url.includes('tiktok')) return 'TikTok';
  if (url.includes('twitter') || url.includes('x.com')) return 'Twitter/X';
  return 'Website';
}

function extractNameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.hostname.replace('www.', '').split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return '';
  }
}

function detectPlatformFromUrl(url) {
  const u = url.toLowerCase();
  if (u.includes('discord')) return 'Discord';
  if (u.includes('wa.me') || u.includes('whatsapp')) return 'WhatsApp';
  if (u.includes('instagram')) return 'Instagram';
  if (u.includes('youtube')) return 'YouTube';
  if (u.includes('telegram')) return 'Telegram';
  return 'Outro';
}

function parseMemberCount(str) {
  if (!str) return null;
  str = str.replace(/[.,]/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

// GET - Buscar todas as configurações
router.get('/settings', async (req, res) => {
  try {
    const rows = await database.all('SELECT * FROM settings');
    const settings = {};
    rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// GET - Buscar oficiais
router.get('/oficiais', async (req, res) => {
  try {
    const oficiais = await database.all('SELECT * FROM oficiais WHERE ativo = 1 ORDER BY ordem ASC');
    res.json(oficiais);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar oficiais' });
  }
});

// GET - Buscar parcerias
router.get('/parcerias', async (req, res) => {
  try {
    const parcerias = await database.all('SELECT * FROM parcerias WHERE ativo = 1 ORDER BY ordem ASC');
    res.json(parcerias);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar parcerias' });
  }
});

// GET - Buscar afiliados
router.get('/afiliados', async (req, res) => {
  try {
    const afiliados = await database.all('SELECT * FROM afiliados WHERE ativo = 1 ORDER BY ordem ASC');
    res.json(afiliados);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar afiliados' });
  }
});

// GET - Estatísticas
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      oficiais: (await database.get('SELECT COUNT(*) as count FROM oficiais WHERE ativo = 1'))?.count || 0,
      parcerias: (await database.get('SELECT COUNT(*) as count FROM parcerias WHERE ativo = 1'))?.count || 0,
      afiliados: (await database.get('SELECT COUNT(*) as count FROM afiliados WHERE ativo = 1'))?.count || 0,
      visitsTotal: (await database.get('SELECT COUNT(*) as count FROM visits'))?.count || 0,
      visitsToday: (await database.get("SELECT COUNT(*) as count FROM visits WHERE date(created_at) = CURRENT_DATE"))?.count || 0
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// POST - Registrar visita
router.post('/visit', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    await database.run('INSERT INTO visits (ip, user_agent) VALUES ($1, $2)', [ip, userAgent]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar visita' });
  }
});

module.exports = router;
