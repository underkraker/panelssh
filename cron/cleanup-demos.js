const db = require('../database/db');
const systemUsers = require('../services/system-users');

function cleanupDemos() {
  const expired = db.prepare(`
    SELECT * FROM demos 
    WHERE expires_at <= datetime('now') AND status = 'active'
  `).all();
  
  for (const demo of expired) {
    try {
      systemUsers.deleteSystemUser(demo.username);
      db.prepare('UPDATE demos SET status = ? WHERE id = ?').run('expired', demo.id);
      
      db.prepare('INSERT INTO logs (action, target, details) VALUES (?, ?, ?)')
        .run('demo_expire', demo.username, `Demo de ${demo.duration_minutes} min expirada`);
      
      console.log(`[Demos] Demo expirada eliminada: ${demo.username}`);
    } catch (err) {
      console.error(`[Demos] Error eliminando ${demo.username}:`, err.message);
    }
  }
  
  if (expired.length > 0) {
    console.log(`[Demos] ${expired.length} demos expiradas procesadas`);
  }
}

module.exports = cleanupDemos;
