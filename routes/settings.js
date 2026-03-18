const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../database/db');
const backupService = require('../services/backup');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// POST /api/settings/backup/create
router.post('/backup/create', requireAuth, requireAdmin, async (req, res) => {
  try {
    const backup = await backupService.createBackup();
    res.json({ success: true, filename: backup.filename });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear respaldo: ' + err.message });
  }
});

// POST /api/settings/password/change
router.post('/password/change', requireAuth, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  const currentUser = req.session && req.session.user;

  if (!currentUser || !currentUser.id) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Todos los campos son requeridos.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'La confirmación no coincide.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(currentUser.id);
  if (!admin) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  const isValid = bcrypt.compareSync(currentPassword, admin.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(newHash, currentUser.id);

  db.prepare('INSERT INTO logs (admin_id, action, target, details, ip_address) VALUES (?, ?, ?, ?, ?)')
    .run(currentUser.id, 'password_change', currentUser.username, 'Cambio de contraseña realizado', req.ip || '');

  res.json({ success: true });
});

// GET /api/settings/backup/list
router.get('/backup/list', requireAuth, requireAdmin, (req, res) => {
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) return res.json({ backups: [] });
  
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-'))
    .map(f => ({
      name: f,
      size: (fs.statSync(path.join(backupDir, f)).size / 1024).toFixed(2) + ' KB',
      time: fs.statSync(path.join(backupDir, f)).mtime
    }))
    .sort((a, b) => b.time - a.time);
    
  res.json({ backups: files });
});

// GET /api/settings/backup/download/:filename
router.get('/backup/download/:filename', requireAuth, requireAdmin, (req, res) => {
  const { filename } = req.params;
  const safeName = path.basename(filename);
  const filePath = path.join(__dirname, '../backups', safeName);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'Archivo no encontrado' });
  }
});

module.exports = router;
