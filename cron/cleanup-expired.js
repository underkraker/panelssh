const db = require('../database/db');
const systemUsers = require('../services/system-users');

function cleanupExpiredUsers() {
  const expired = db.prepare(`
    SELECT * FROM users 
    WHERE expiry_date < date('now') AND status != 'expired'
  `).all();
  
  for (const user of expired) {
    try {
      systemUsers.deleteSystemUser(user.username);
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run('expired', user.id);
      
      db.prepare('INSERT INTO logs (action, target, details) VALUES (?, ?, ?)')
        .run('auto_expire', user.username, 'Usuario expirado automáticamente');
      
      console.log(`[Cleanup] Usuario expirado eliminado: ${user.username}`);
    } catch (err) {
      console.error(`[Cleanup] Error eliminando ${user.username}:`, err.message);
    }
  }
  
  if (expired.length > 0) {
    console.log(`[Cleanup] ${expired.length} usuarios expirados procesados`);
  }
}

module.exports = cleanupExpiredUsers;
