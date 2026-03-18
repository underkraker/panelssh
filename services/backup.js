const fs = require('fs');
const path = require('path');
const db = require('../database/db');

async function createBackup() {
  const backupDir = path.join(__dirname, '../backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${timestamp}.sqlite`;
  const backupPath = path.join(backupDir, backupFileName);
  
  try {
    // Consistent SQLite backup with better-sqlite3 API.
    if (typeof db.backup === 'function') {
      await db.backup(backupPath);
    } else {
      db.pragma('wal_checkpoint(TRUNCATE)');
      fs.copyFileSync(path.join(__dirname, '../database/lacasita.db'), backupPath);
    }
    
    // Keep only last 5 backups
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
    
    if (files.length > 5) {
      files.slice(5).forEach(f => {
        fs.unlinkSync(path.join(backupDir, f.name));
      });
    }
    
    return { success: true, filename: backupFileName, path: backupPath };
  } catch (err) {
    console.error('[Backup] Error:', err.message);
    throw err;
  }
}

function getLatestBackup() {
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) return null;
  
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-'))
    .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);
    
  return files.length > 0 ? files[0] : null;
}

module.exports = { createBackup, getLatestBackup };
