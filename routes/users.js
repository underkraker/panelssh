const express = require('express');
const db = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const systemUsers = require('../services/system-users');

const router = express.Router();

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
      SELECT u.*, a.username as created_by_name 
      FROM users u LEFT JOIN admins a ON u.created_by = a.id 
      ORDER BY u.created_at DESC
    `).all();
  } else {
    // Reseller only sees their own users
    users = db.prepare(`
      SELECT u.*, a.username as created_by_name 
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
  const { username, password, device_limit, expiry_date } = req.body;
  const ip = req.ip;
  
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
    // Create system user
    systemUsers.createSystemUser(username, password, expiry_date);
    
    // Insert in database
    const result = db.prepare(
      'INSERT INTO users (username, password, device_limit, expiry_date, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(username, password, device_limit || 1, expiry_date, user.id);
    
    // Deduct reseller credit
    if (user.role === 'reseller') {
      db.prepare('UPDATE admins SET credits = credits - 1 WHERE id = ?').run(user.id);
    }
    
    logAction(user.id, 'user_create', username, `Creado con expiración ${expiry_date}, límite ${device_limit || 1}`, ip);
    
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
  const { password, device_limit, expiry_date } = req.body;
  const ip = req.ip;
  
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });
  
  // Reseller can only edit own users
  if (user.role === 'reseller' && target.created_by !== user.id) {
    return res.status(403).json({ error: 'No autorizado.' });
  }
  
  try {
    if (password) {
      systemUsers.changePassword(target.username, password);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(password, id);
    }
    if (device_limit !== undefined) {
      db.prepare('UPDATE users SET device_limit = ? WHERE id = ?').run(device_limit, id);
    }
    if (expiry_date) {
      systemUsers.setExpiry(target.username, expiry_date);
      db.prepare('UPDATE users SET expiry_date = ? WHERE id = ?').run(expiry_date, id);
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
    systemUsers.changePassword(target.username, password);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(password, id);
    
    logAction(user.id, 'password_reset', target.username, 'Contraseña reseteada', ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al resetear contraseña: ' + err.message });
  }
});

module.exports = router;
