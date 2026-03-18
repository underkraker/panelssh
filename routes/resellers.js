const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/resellers — list all resellers (admin only)
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const resellers = db.prepare(`
    SELECT id, username, credits, subdomain, created_at,
      (SELECT COUNT(*) FROM users WHERE created_by = admins.id) as user_count
    FROM admins 
    WHERE role = 'reseller' 
    ORDER BY created_at DESC
  `).all();
  
  res.json({ resellers });
});

// POST /api/resellers — create reseller (admin only)
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { username, password, credits, subdomain } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos.' });
  }
  
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'El nombre de reseller ya existe.' });
  }
  
  const hash = bcrypt.hashSync(password, 10);
  
  const result = db.prepare(
    'INSERT INTO admins (username, password_hash, role, credits, parent_id, subdomain) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(username, hash, 'reseller', credits || 0, req.session.user.id, subdomain || null);
  
  db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
    .run(req.session.user.id, 'reseller_create', username, `Créditos: ${credits || 0}`);
  
  res.json({ success: true, id: result.lastInsertRowid });
});

// PUT /api/resellers/:id/credits — adjust credits (admin only)
router.put('/:id/credits', requireAuth, requireAdmin, (req, res) => {
  const { credits } = req.body;
  const { id } = req.params;
  
  if (credits === undefined || credits < 0) {
    return res.status(400).json({ error: 'Créditos inválidos.' });
  }
  
  const reseller = db.prepare('SELECT * FROM admins WHERE id = ? AND role = ?').get(id, 'reseller');
  if (!reseller) return res.status(404).json({ error: 'Reseller no encontrado.' });
  
  db.prepare('UPDATE admins SET credits = ? WHERE id = ?').run(credits, id);
  
  db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
    .run(req.session.user.id, 'credits_update', reseller.username, `Créditos: ${credits}`);
  
  res.json({ success: true });
});

// PUT /api/resellers/:id — edit reseller (admin only)
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { password, credits, subdomain } = req.body;
  
  const reseller = db.prepare('SELECT * FROM admins WHERE id = ? AND role = ?').get(id, 'reseller');
  if (!reseller) return res.status(404).json({ error: 'Reseller no encontrado.' });
  
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, id);
  }
  if (credits !== undefined) {
    db.prepare('UPDATE admins SET credits = ? WHERE id = ?').run(credits, id);
  }
  if (subdomain !== undefined) {
    db.prepare('UPDATE admins SET subdomain = ? WHERE id = ?').run(subdomain, id);
  }
  
  db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
    .run(req.session.user.id, 'reseller_edit', reseller.username, JSON.stringify(req.body));
  
  res.json({ success: true });
});

// DELETE /api/resellers/:id — delete reseller (admin only)
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  const reseller = db.prepare('SELECT * FROM admins WHERE id = ? AND role = ?').get(id, 'reseller');
  if (!reseller) return res.status(404).json({ error: 'Reseller no encontrado.' });
  
  // Delete all users created by this reseller from system
  const resellerUsers = db.prepare('SELECT username FROM users WHERE created_by = ?').all(id);
  const systemUsersModule = require('../services/system-users');
  for (const u of resellerUsers) {
    try { systemUsersModule.deleteSystemUser(u.username); } catch (e) {}
  }
  
  db.prepare('DELETE FROM users WHERE created_by = ?').run(id);
  db.prepare('DELETE FROM admins WHERE id = ?').run(id);
  
  db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
    .run(req.session.user.id, 'reseller_delete', reseller.username, `Eliminado con ${resellerUsers.length} usuarios`);
  
  res.json({ success: true });
});

module.exports = router;
