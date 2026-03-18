const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { bruteForceProtection, recordFailedAttempt, resetAttempts } = require('../middleware/bruteforce');

const router = express.Router();

// POST /api/auth/login
router.post('/login', bruteForceProtection, (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
  }
  
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    const locked = recordFailedAttempt(ip);
    const msg = locked 
      ? `Demasiados intentos. IP bloqueada por 15 minutos.`
      : 'Credenciales incorrectas.';
    
    // Log failed attempt
    db.prepare('INSERT INTO logs (action, target, details, ip_address) VALUES (?, ?, ?, ?)')
      .run('login_failed', username, `Intento fallido desde ${ip}`, ip);
    
    return res.status(401).json({ error: msg, locked });
  }
  
  // Success — reset attempts and create session
  resetAttempts(ip);
  
  req.session.user = {
    id: admin.id,
    username: admin.username,
    role: admin.role
  };
  
  // Log success
  db.prepare('INSERT INTO logs (admin_id, action, target, details, ip_address) VALUES (?, ?, ?, ?, ?)')
    .run(admin.id, 'login_success', admin.username, 'Inicio de sesión exitoso', ip);
  
  res.json({ 
    success: true, 
    user: { 
      id: admin.id, 
      username: admin.username, 
      role: admin.role 
    } 
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  if (req.session.user) {
    db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
      .run(req.session.user.id, 'logout', req.session.user.username, 'Cierre de sesión');
  }
  req.session.destroy();
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  res.status(401).json({ error: 'No autenticado' });
});

module.exports = router;
