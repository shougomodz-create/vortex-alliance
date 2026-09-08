const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db = null;
let SQL = null;

const DB_PATH = path.resolve(__dirname, '..', process.env.DB_PATH || './data/vortex.db');

const init = async () => {
  const dbDir = path.dirname(DB_PATH);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  SQL = await initSqlJs();
  
  // Carregar banco existente ou criar novo
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  createTables();
  saveDatabase();
  seedDefaultData();
  
  console.log('✓ Banco de dados inicializado');
};

const createTables = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS oficiais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cargo TEXT,
      descricao TEXT,
      avatar TEXT,
      discord TEXT,
      whatsapp TEXT,
      instagram TEXT,
      ordem INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS parcerias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS afiliados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const seedDefaultData = () => {
  const bcrypt = require('bcryptjs');
  
  // Criar usuário admin padrão
  const existingUser = db.exec('SELECT id FROM users WHERE username = ?', ['vtxadm']);
  if (!existingUser.length || !existingUser[0].values.length) {
    const hashedPassword = bcrypt.hashSync('VTX2K27', 10);
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['vtxadm', hashedPassword, 'admin']);
    console.log('✓ Usuário admin criado (vtxadm/VTX2K27)');
  }
  
  // Migrar usuário antigo admin -> vtxadm
  const oldUser = db.exec('SELECT id FROM users WHERE username = ?', ['admin']);
  if (oldUser.length && oldUser[0].values.length) {
    const newHash = bcrypt.hashSync('VTX2K27', 10);
    db.run("UPDATE users SET username = 'vtxadm', password = ? WHERE username = 'admin'", [newHash]);
    console.log('✓ Usuário migrado admin -> vtxadm');
  }
  
  // Configurações padrão
  const defaultSettings = {
    site_title: 'ALIANÇA VORTEX',
    hero_title: 'ALIANÇA<br>VORTEX',
    hero_subtitle: 'Força, Honra e União.',
    hero_description: 'Conexões oficiais, parcerias e presença reunidas em um único espaço.',
    description: 'Aliança VORTEX — Força, Honra e União.',
    footer_text: 'VORTEX © 2026 — Todos os direitos reservados.',
    whatsapp_link: '',
    discord_link: '',
    instagram_link: ''
  };
  
  Object.entries(defaultSettings).forEach(([key, value]) => {
    const existing = db.exec('SELECT id FROM settings WHERE key = ?', [key]);
    if (!existing.length || !existing[0].values.length) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  });
  
  saveDatabase();
};

const saveDatabase = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
};

const getDB = () => {
  if (!db) throw new Error('Banco de dados não inicializado');
  return db;
};

// Helper functions para operações comuns
const all = (sql, params = []) => {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
};

const get = (sql, params = []) => {
  const result = all(sql, params);
  return result.length > 0 ? result[0] : null;
};

const run = (sql, params = []) => {
  db.run(sql, params);
  saveDatabase();
  return { changes: db.getRowsModified(), lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] };
};

const close = () => {
  if (db) {
    saveDatabase();
    db.close();
  }
};

module.exports = { init, getDB, all, get, run, saveDatabase, close };
