const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const systemUsers = require('../services/system-users');
const credentials = require('../services/credentials');

const router = express.Router();

const CONNECTION_METHODS = {
  ssh: {
    label: 'SSH Directo',
    service: 'ssh',
    app: 'HTTP Injector / HTTP Custom / NapsternetV',
    steps: [
      'Abre tu app de tunel SSH.',
      'Crea un perfil tipo SSH con Host, Puerto, Usuario y Password.',
      'Guarda y conecta.'
    ]
  },
  ssl: {
    label: 'SSL/TLS (Stunnel)',
    service: 'stunnel',
    app: 'HTTP Injector / HTTP Custom (SSL)',
    steps: [
      'Abre tu app y selecciona modo SSL/TLS.',
      'Configura SNI con el dominio del ticket.',
      'Ingresa Host, Puerto SSL, Usuario y Password.',
      'Guarda y conecta.'
    ]
  },
  websocket: {
    label: 'WebSocket',
    service: 'websocket',
    app: 'HTTP Custom / HTTP Injector (WS)',
    steps: [
      'Selecciona modo WebSocket/WS en tu app.',
      'Configura Host, Puerto WS, Usuario y Password.',
      'Copia el payload WS del ticket.',
      'Guarda y conecta.'
    ]
  },
  squid: {
    label: 'Proxy Squid',
    service: 'squid',
    app: 'HTTP Custom / HTTP Injector (Proxy)',
    steps: [
      'Configura tu app con proxy HTTP.',
      'Ingresa Host y Puerto de Squid.',
      'Usa el usuario/password SSH para autenticar el tunel.',
      'Guarda y conecta.'
    ]
  },
  v2ray: {
    label: 'V2Ray (VMess/VLESS)',
    service: 'v2ray',
    app: 'v2rayNG / v2rayN / NekoBox',
    steps: [
      'Abre tu cliente V2Ray y agrega perfil manual.',
      'Configura servidor con Host y Puerto V2Ray del ticket.',
      'Usa transporte WebSocket con path /vmess o /vless.',
      'Si no tienes UUID, solicitalo al administrador del panel.'
    ]
  },
  hysteria: {
    label: 'Hysteria 2',
    service: 'hysteria',
    app: 'NekoBox / sing-box / Hiddify Next',
    steps: [
      'Abre tu cliente compatible con Hysteria 2.',
      'Configura server con Host y Puerto Hysteria del ticket.',
      'Ingresa la contraseña del servicio Hysteria.',
      'Guarda y conecta.'
    ]
  }
};

function normalizeConnectionType(value) {
  const key = String(value || 'ssh').toLowerCase();
  return CONNECTION_METHODS[key] ? key : 'ssh';
}

function buildConnectionGuide(connectionType, domain, services) {
  const type = normalizeConnectionType(connectionType);
  const method = CONNECTION_METHODS[type];
  const service = services.find(svc => svc.name === method.service);
  const payload = `GET / HTTP/1.1[crlf]Host: ${domain}[crlf]Upgrade: websocket[crlf][crlf]`;

  return {
    type,
    label: method.label,
    app: method.app,
    host: domain,
    port: service ? service.port : null,
    enabled: service ? !!service.enabled : false,
    payload,
    steps: method.steps
  };
}

function logAction(adminId, action, target, details, ip) {
  db.prepare('INSERT INTO logs (admin_id, action, target, details, ip_address) VALUES (?, ?, ?, ?, ?)')
    .run(adminId, action, target, details, ip);
}

// GET /api/users — list users
router.get('/', requireAuth, (req, res) => {
  const { user } = req.session;
  let users;
  
  if (user.role === 'admin') {
    users = db.prepare(`
      SELECT
        u.id, u.username, u.device_limit, u.expiry_date, u.created_by,
        u.connection_type,
        u.status, u.created_at,
        a.username as created_by_name
      FROM users u LEFT JOIN admins a ON u.created_by = a.id 
      ORDER BY u.created_at DESC
    `).all();
  } else {
    // Reseller only sees their own users
    users = db.prepare(`
      SELECT
        u.id, u.username, u.device_limit, u.expiry_date, u.created_by,
        u.connection_type,
        u.status, u.created_at,
        a.username as created_by_name
      FROM users u LEFT JOIN admins a ON u.created_by = a.id 
      WHERE u.created_by = ? ORDER BY u.created_at DESC
    `).all(user.id);
  }
  
  // Calculate days remaining
  const now = new Date();
  users = users.map(u => {
    const expiry = new Date(u.expiry_date);
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return { ...u, days_left: daysLeft };
  });
  
  res.json({ users });
});

// POST /api/users — create user
router.post('/', requireAuth, (req, res) => {
  const { user } = req.session;
  const { username, password, device_limit, expiry_date, connection_type } = req.body;
  const ip = req.ip;
  const selectedConnection = normalizeConnectionType(connection_type);

  const selectedMethod = CONNECTION_METHODS[selectedConnection];
  const selectedService = db.prepare('SELECT * FROM service_ports WHERE name = ?').get(selectedMethod.service);
  if (!selectedService || !selectedService.enabled) {
    return res.status(400).json({
      error: `El protocolo ${selectedMethod.label} no está activo. Actívelo en Servicios antes de crear el usuario.`
    });
  }
  
  if (!username || !password || !expiry_date) {
    return res.status(400).json({ error: 'Nombre, contraseña y fecha de expiración son requeridos.' });
  }
  
  // Check if reseller has credits
  if (user.role === 'reseller') {
    const reseller = db.prepare('SELECT credits FROM admins WHERE id = ?').get(user.id);
    if (reseller.credits <= 0) {
      return res.status(403).json({ error: 'Sin créditos disponibles. Contacte al administrador.' });
    }
  }
  
  // Check duplicate
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'El usuario ya existe.' });
  }
  
  try {
    const encryptedPassword = credentials.encrypt(password);

    // Create system user
    try {
      systemUsers.createSystemUser(username, password, expiry_date);
    } catch (sysErr) {
      return res.status(500).json({ error: sysErr.message });
    }
    
    // Insert in database
    const result = db.prepare(
      'INSERT INTO users (username, password, password_encrypted, connection_type, device_limit, expiry_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(username, '[secure]', encryptedPassword, selectedConnection, device_limit || 1, expiry_date, user.id);
    
    // Deduct reseller credit
    if (user.role === 'reseller') {
      db.prepare('UPDATE admins SET credits = credits - 1 WHERE id = ?').run(user.id);
    }
    
    logAction(user.id, 'user_create', username, `Creado con expiración ${expiry_date}, límite ${device_limit || 1}, conexión ${selectedConnection}`, ip);
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('[Users] Create error:', err.message);
    res.status(500).json({ error: 'Error al crear usuario: ' + err.message });
  }
});

// PUT /api/users/:id — edit user
router.put('/:id', requireAuth, (req, res) => {
  const { user } = req.session;
  const { id } = req.params;
  const { password, device_limit, expiry_date, connection_type } = req.body;
  const ip = req.ip;
  
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });
  
  // Reseller can only edit own users
  if (user.role === 'reseller' && target.created_by !== user.id) {
    return res.status(403).json({ error: 'No autorizado.' });
  }
  
  try {
    if (password) {
      const encryptedPassword = credentials.encrypt(password);
      systemUsers.changePassword(target.username, password);
      db.prepare('UPDATE users SET password = ?, password_encrypted = ? WHERE id = ?').run('[secure]', encryptedPassword, id);
    }
    if (device_limit !== undefined) {
      db.prepare('UPDATE users SET device_limit = ? WHERE id = ?').run(device_limit, id);
    }
    if (expiry_date) {
      systemUsers.setExpiry(target.username, expiry_date);
      db.prepare('UPDATE users SET expiry_date = ? WHERE id = ?').run(expiry_date, id);
    }
    if (connection_type !== undefined) {
      const selectedConnection = normalizeConnectionType(connection_type);
      db.prepare('UPDATE users SET connection_type = ? WHERE id = ?').run(selectedConnection, id);
    }
    
    logAction(user.id, 'user_edit', target.username, `Editado: ${JSON.stringify(req.body)}`, ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al editar usuario: ' + err.message });
  }
});

// DELETE /api/users/:id — delete user
router.delete('/:id', requireAuth, (req, res) => {
  const { user } = req.session;
  const { id } = req.params;
  const ip = req.ip;
  
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });
  
  if (user.role === 'reseller' && target.created_by !== user.id) {
    return res.status(403).json({ error: 'No autorizado.' });
  }
  
  try {
    systemUsers.deleteSystemUser(target.username);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    
    logAction(user.id, 'user_delete', target.username, 'Usuario eliminado', ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar usuario: ' + err.message });
  }
});

// GET /api/users/me/config — for Android app sync
router.get('/me/config', requireAuth, (req, res) => {
  const { user } = req.session;
  try {
    const services = db.prepare('SELECT name, port FROM service_ports WHERE enabled = 1').all();
    const domain = require('../config').DOMAIN || 'localhost';
    const panelUser = db.prepare('SELECT expiry_date, connection_type FROM users WHERE username = ?').get(user.username);
    
    res.json({
      username: user.username,
      expiry_date: panelUser ? panelUser.expiry_date : null,
      connection_type: panelUser ? normalizeConnectionType(panelUser.connection_type) : 'ssh',
      domain: domain,
      services: services,
      payload: `GET / HTTP/1.1[crlf]Host: ${domain}[crlf]Upgrade: websocket[crlf][crlf]`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:id/ban — ban/unban user
router.post('/:id/ban', requireAuth, (req, res) => {
  const { user } = req.session;
  const { id } = req.params;
  const ip = req.ip;
  
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });
  
  if (user.role === 'reseller' && target.created_by !== user.id) {
    return res.status(403).json({ error: 'No autorizado.' });
  }
  
  const newStatus = target.status === 'banned' ? 'active' : 'banned';
  
  try {
    if (newStatus === 'banned') {
      systemUsers.lockUser(target.username);
    } else {
      systemUsers.unlockUser(target.username);
    }
    
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(newStatus, id);
    logAction(user.id, newStatus === 'banned' ? 'user_ban' : 'user_unban', target.username, `Estado cambiado a ${newStatus}`, ip);
    
    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar estado: ' + err.message });
  }
});

// POST /api/users/:id/reset-password — reset password
router.post('/:id/reset-password', requireAuth, (req, res) => {
  const { user } = req.session;
  const { id } = req.params;
  const { password } = req.body;
  const ip = req.ip;
  
  if (!password) return res.status(400).json({ error: 'Nueva contraseña requerida.' });
  
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });
  
  if (user.role === 'reseller' && target.created_by !== user.id) {
    return res.status(403).json({ error: 'No autorizado.' });
  }
  
  try {
    const encryptedPassword = credentials.encrypt(password);
    systemUsers.changePassword(target.username, password);
    db.prepare('UPDATE users SET password = ?, password_encrypted = ? WHERE id = ?').run('[secure]', encryptedPassword, id);
    
    logAction(user.id, 'password_reset', target.username, 'Contraseña reseteada', ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al resetear contraseña: ' + err.message });
  }
});

// GET /api/users/:id/ticket — full ticket data with secure password retrieval
router.get('/:id/ticket', requireAuth, (req, res) => {
  const { user } = req.session;
  const { id } = req.params;

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

  if (user.role === 'reseller' && target.created_by !== user.id) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  let password = '';
  try {
    if (target.password_encrypted) {
      password = credentials.decrypt(target.password_encrypted);
    }
  } catch (err) {
    password = '';
  }

  // Backward compatibility for old rows
  if (!password && target.password && target.password !== '[secure]') {
    password = target.password;
  }

  const selectedConnection = normalizeConnectionType(req.query.type || target.connection_type);
  const services = db.prepare('SELECT name, port, enabled FROM service_ports').all();
  const domain = require('../config').DOMAIN || 'localhost';
  const guide = buildConnectionGuide(selectedConnection, domain, services);

  res.json({
    ticket: {
      username: target.username,
      password: password || 'No disponible',
      expiry_date: target.expiry_date,
      connection_type: guide.type,
      connection_label: guide.label,
      domain,
      services,
      payload: guide.payload,
      guide
    }
  });
});

module.exports = router;
