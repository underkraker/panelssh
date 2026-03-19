const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../database/db');
const backupService = require('../services/backup');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const privileged = require('../services/privileged-exec');

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

function ensureSshOption(configStr, key, value) {
  const regex = new RegExp(`^#?${key}\\s+.*`, 'm');
  if (regex.test(configStr)) {
    return configStr.replace(regex, `${key} ${value}`);
  }
  return `${configStr.trimEnd()}\n${key} ${value}\n`;
}

function readSshState() {
  try {
    const sshdConfig = privileged.readTextFile('/etc/ssh/sshd_config');
    return {
      passwordAuthentication: /^(?!\s*#)\s*PasswordAuthentication\s+yes\b/im.test(sshdConfig),
      permitRootLogin: /^(?!\s*#)\s*PermitRootLogin\s+yes\b/im.test(sshdConfig),
      pubkeyAuthentication: /^(?!\s*#)\s*PubkeyAuthentication\s+yes\b/im.test(sshdConfig)
    };
  } catch (e) {
    return {
      passwordAuthentication: false,
      permitRootLogin: false,
      pubkeyAuthentication: false
    };
  }
}

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

// GET /api/settings/vps/root-status
router.get('/vps/root-status', requireAuth, requireAdmin, (req, res) => {
  try {
    const privilege = privileged.detectPrivilegeMode();
    const ssh = readSshState();
    const rootForced = getSetting('root_forced', '0') === '1';
    const cloudProvider = getSetting('cloud_provider', 'auto');
    const serverUser = getSetting('server_user', process.env.SUDO_USER || process.env.USER || 'root');

    const diagnostics = {
      canCreateUsers: false,
      canChangePasswords: false,
      canManageServices: false
    };

    try {
      const out = privileged.run('which', ['useradd'], { ignoreError: true }).trim();
      diagnostics.canCreateUsers = !!out;
    } catch (e) {}

    try {
      const out = privileged.run('which', ['chpasswd'], { ignoreError: true }).trim();
      diagnostics.canChangePasswords = !!out;
    } catch (e) {}

    try {
      const sshState = privileged.run('systemctl', ['is-active', 'ssh'], { ignoreError: true }).trim();
      const sshdState = privileged.run('systemctl', ['is-active', 'sshd'], { ignoreError: true }).trim();
      diagnostics.canManageServices = sshState === 'active' || sshState === 'inactive' || sshdState === 'active' || sshdState === 'inactive';
    } catch (e) {}

    res.json({
      success: true,
      privilege,
      rootForced,
      cloudProvider,
      serverUser,
      ssh,
      diagnostics
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar estado root: ' + err.message });
  }
});

// POST /api/settings/vps/force-root
router.post('/vps/force-root', requireAuth, requireAdmin, (req, res) => {
  const currentUser = req.session && req.session.user;

  try {
    const rootPassword = crypto.randomBytes(18).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 22) + 'R!9';
    const provider = String((req.body && req.body.provider) || 'auto').toLowerCase();
    const serverUser = String((req.body && req.body.serverUser) || process.env.SUDO_USER || process.env.USER || 'root');

    privileged.run('chpasswd', [], { input: `root:${rootPassword}\n` });

    let configStr = privileged.readTextFile('/etc/ssh/sshd_config');
    configStr = ensureSshOption(configStr, 'PasswordAuthentication', 'yes');
    configStr = ensureSshOption(configStr, 'PermitRootLogin', 'yes');
    configStr = ensureSshOption(configStr, 'PubkeyAuthentication', 'yes');
    privileged.writeTextFile('/etc/ssh/sshd_config', configStr);

    privileged.run('systemctl', ['restart', 'ssh'], { ignoreError: true });
    privileged.run('systemctl', ['restart', 'sshd'], { ignoreError: true });

    setSetting('root_forced', '1');
    setSetting('privilege_mode', 'root_forced');
    setSetting('cloud_provider', provider || 'auto');
    setSetting('server_user', serverUser || 'root');

    db.prepare('INSERT INTO logs (admin_id, action, target, details, ip_address) VALUES (?, ?, ?, ?, ?)')
      .run(currentUser.id, 'force_root', 'vps', `Root forzado. Provider=${provider} user=${serverUser}`, req.ip || '');

    res.json({
      success: true,
      message: 'Root forzado correctamente. Guarda la contraseña en un lugar seguro.',
      rootPassword,
      ssh: readSshState()
    });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo forzar root: ' + err.message });
  }
});

module.exports = router;
