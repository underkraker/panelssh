const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function createBackup() {
  const dbPath = path.join(__dirname, '../database/lacasita.db');
  const backupDir = path.join(__dirname, '../backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${timestamp}.sqlite`;
  const backupPath = path.join(backupDir, backupFileName);
  
  try {
    // For SQLite, a simple file copy is usually fine if not writing, 
    // but sqlite3 .backup is safer. Since we use better-sqlite3, we can just copy
    // OR use the .backup command if the CLI is installed.
    fs.copyFileSync(dbPath, backupPath);
    
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
