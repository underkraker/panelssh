const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../config');
const credentials = require('../services/credentials');

// Ensure database directory exists
const dbDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(config.DB_PATH, { verbose: null });
  console.log('[DB] Conectado exitosamente en:', config.DB_PATH);
} catch (err) {
  console.error('❌ [ERROR FATAL] No se pudo cargar el motor de Base de Datos.');
  console.error('Este error es común si no se instaló "build-essential" o si "npm install" falló.');
  console.error('Detalle del error:', err.message);
  process.exit(1);
}

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','reseller')),
    credits INTEGER DEFAULT 0,
    parent_id INTEGER,
    subdomain TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES admins(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    connection_type TEXT DEFAULT 'ssh',
    device_limit INTEGER DEFAULT 1,
    expiry_date DATE NOT NULL,
    created_by INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','banned','expired')),
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS demos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    expires_at DATETIME NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','expired'))
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    last_attempt DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS service_ports (
    name TEXT PRIMARY KEY,
    port INTEGER NOT NULL,
    enabled INTEGER DEFAULT 0,
    custom_config TEXT
  );
`);

// ── Schema migrations ───────────────────────────────────────
const userColumns = db.prepare('PRAGMA table_info(users)').all();
const hasEncryptedPassword = userColumns.some(col => col.name === 'password_encrypted');
const hasConnectionType = userColumns.some(col => col.name === 'connection_type');

if (!hasEncryptedPassword) {
  db.exec('ALTER TABLE users ADD COLUMN password_encrypted TEXT');
}

if (!hasConnectionType) {
  db.exec("ALTER TABLE users ADD COLUMN connection_type TEXT DEFAULT 'ssh'");
}

db.prepare("UPDATE users SET connection_type = 'ssh' WHERE connection_type IS NULL OR connection_type = ''").run();

// Migrate any plain-text password to encrypted storage
try {
  const toMigrate = db.prepare(`
    SELECT id, password, password_encrypted
    FROM users
    WHERE (password_encrypted IS NULL OR password_encrypted = '')
      AND password IS NOT NULL
      AND password != '[secure]'
  `).all();

  const updatePassword = db.prepare('UPDATE users SET password = ?, password_encrypted = ? WHERE id = ?');
  for (const row of toMigrate) {
    const encrypted = credentials.encrypt(row.password);
    updatePassword.run('[secure]', encrypted, row.id);
  }
} catch (err) {
  console.error('[DB] Password migration warning:', err.message);
}

// ── Seed Default Admin ───────────────────────────────────────
const existingAdmin = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
if (!existingAdmin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  console.log('[DB] Default admin created — admin / admin123');
}

// ── Seed Default Service Ports ───────────────────────────────
const defaultServices = [
  { name: 'ssh', port: 22, enabled: 0 },
  { name: 'stunnel', port: 443, enabled: 0 },
  { name: 'squid', port: 3128, enabled: 0 },
  { name: 'v2ray', port: 10085, enabled: 0 },
  { name: 'websocket', port: 8880, enabled: 0 },
  { name: 'badvpn', port: 7300, enabled: 0 },
  { name: 'hysteria', port: 4434, enabled: 0 }
];

const insertService = db.prepare('INSERT OR IGNORE INTO service_ports (name, port, enabled) VALUES (?, ?, ?)');
for (const svc of defaultServices) {
  insertService.run(svc.name, svc.port, svc.enabled);
}

// Ensure SSH is present in service_ports
const hasSsh = db.prepare('SELECT 1 FROM service_ports WHERE name = ?').get('ssh');
if (!hasSsh) {
  db.prepare('INSERT INTO service_ports (name, port, enabled) VALUES (?, ?, ?)').run('ssh', 22, 1);
}

// ── Seed Default Settings ────────────────────────────────────
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
insertSetting.run('panel_port', '8080');
insertSetting.run('domain', 'localhost');
insertSetting.run('root_forced', '0');
insertSetting.run('privilege_mode', 'auto');
insertSetting.run('cloud_provider', 'auto');
insertSetting.run('server_user', 'root');

module.exports = db;
