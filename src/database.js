const { Pool } = require('pg');

let pool = null;

const init = async () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('⚠ DATABASE_URL não configurada! O site vai funcionar mas sem persistência.');
    return;
  }
  
  console.log('[DB] Conectando ao Neon PostgreSQL...');
  
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000
  });
  
  // Testar conexão
  try {
    const client = await pool.connect();
    console.log('✓ Conectado ao Neon PostgreSQL');
    client.release();
  } catch (err) {
    console.error('✗ Erro ao conectar no Neon:', err.message);
    pool = null;
    return;
  }
  
  try {
    await createTables();
    await seedDefaultData();
    console.log('✓ Banco de dados inicializado');
  } catch (err) {
    console.error('✗ Erro ao criar tabelas:', err.message);
  }
};

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oficiais (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      cargo TEXT,
      descricao TEXT,
      avatar TEXT,
      discord TEXT,
      whatsapp TEXT,
      instagram TEXT,
      ordem INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS parcerias (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      tipo TEXT,
      descricao TEXT,
      logo TEXT,
      link TEXT,
      whatsapp TEXT,
      membros INTEGER DEFAULT 0,
      plataforma TEXT DEFAULT 'Discord',
      categoria TEXT DEFAULT 'Geral',
      ordem INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS afiliados (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      tipo TEXT,
      descricao TEXT,
      logo TEXT,
      link TEXT,
      whatsapp TEXT,
      membros INTEGER DEFAULT 0,
      plataforma TEXT DEFAULT 'Discord',
      categoria TEXT DEFAULT 'Geral',
      ordem INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Migration: adicionar coluna vip se não existir
  try {
    await pool.query('ALTER TABLE parcerias ADD COLUMN vip INTEGER DEFAULT 0');
  } catch (e) { /* coluna já existe */ }
  try {
    await pool.query('ALTER TABLE afiliados ADD COLUMN vip INTEGER DEFAULT 0');
  } catch (e) { /* coluna já existe */ }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

const seedDefaultData = async () => {
  const bcrypt = require('bcryptjs');
  
  // Criar usuário admin padrão
  const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', ['vtxadm']);
  if (existingUser.rows.length === 0) {
    const hashedPassword = bcrypt.hashSync('VTX2K27', 10);
    await pool.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', ['vtxadm', hashedPassword, 'admin']);
    console.log('✓ Usuário admin criado (vtxadm/VTX2K27)');
  }
  
  // Migrar usuário antigo admin -> vtxadm
  const oldUser = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
  if (oldUser.rows.length > 0) {
    const newHash = bcrypt.hashSync('VTX2K27', 10);
    await pool.query("UPDATE users SET username = 'vtxadm', password = $1 WHERE username = 'admin'", [newHash]);
    console.log('✓ Usuário migrado admin -> vtxadm');
  }
  
  // Configurações padrão
  const defaultSettings = {
    site_title: 'ALIANÇA UNION',
    hero_title: 'ALIANÇA<br>UNION',
    hero_subtitle: 'Força, Honra e União.',
    hero_description: 'Conexões oficiais, parcerias e presença reunidas em um único espaço.',
    description: 'Aliança UNION — Força, Honra e União.',
    footer_text: 'UNION © 2026 — Todos os direitos reservados.',
    whatsapp_link: '',
    discord_link: '',
    instagram_link: ''
  };
  
  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = await pool.query('SELECT id FROM settings WHERE key = $1', [key]);
    if (existing.rows.length === 0) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, value]);
    }
  }
};

// Helper functions para operações comuns
const all = async (sql, params = []) => {
  if (!pool) return [];
  const result = await pool.query(sql, params);
  return result.rows;
};

const get = async (sql, params = []) => {
  if (!pool) return null;
  const result = await pool.query(sql, params);
  return result.rows.length > 0 ? result.rows[0] : null;
};

const run = async (sql, params = []) => {
  if (!pool) return { changes: 0, lastInsertRowid: null };
  const result = await pool.query(sql, params);
  return { 
    changes: result.rowCount, 
    lastInsertRowid: result.rows[0]?.id || null 
  };
};

const close = async () => {
  if (pool) {
    await pool.end();
  }
};

module.exports = { init, all, get, run, close };
