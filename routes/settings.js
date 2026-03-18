const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../database/db');
const backupService = require('../services/backup');
const path = require('path');
const fs = require('fs');

// POST /api/settings/backup/create
router.post('/backup/create', requireAuth, requireAdmin, (req, res) => {
  try {
    const backup = backupService.createBackup();
    res.json({ success: true, filename: backup.filename });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear respaldo: ' + err.message });
  }
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
