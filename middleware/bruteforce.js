const db = require('../database/db');
const config = require('../config');

function bruteForceProtection(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  
  let record = db.prepare('SELECT * FROM login_attempts WHERE ip_address = ?').get(ip);
  
  if (record && record.locked_until) {
    const lockExpires = new Date(record.locked_until);
    if (lockExpires > new Date()) {
      const minutesLeft = Math.ceil((lockExpires - new Date()) / 60000);
      return res.status(429).json({ 
        error: `IP bloqueada. Intente de nuevo en ${minutesLeft} minuto(s).`,
        locked: true,
        minutesLeft 
      });
    } else {
      // Lock expired, reset
      db.prepare('UPDATE login_attempts SET attempts = 0, locked_until = NULL WHERE ip_address = ?').run(ip);
    }
  }
  
  next();
}

function recordFailedAttempt(ip) {
  let record = db.prepare('SELECT * FROM login_attempts WHERE ip_address = ?').get(ip);
  
  if (!record) {
    db.prepare('INSERT INTO login_attempts (ip_address, attempts) VALUES (?, 1)').run(ip);
    record = { attempts: 1 };
  } else {
    const newAttempts = record.attempts + 1;
    db.prepare('UPDATE login_attempts SET attempts = ?, last_attempt = datetime("now") WHERE ip_address = ?')
      .run(newAttempts, ip);
    record.attempts = newAttempts;
  }
  
  if (record.attempts >= config.MAX_LOGIN_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + config.LOCKOUT_MINUTES * 60000).toISOString();
    db.prepare('UPDATE login_attempts SET locked_until = ? WHERE ip_address = ?').run(lockUntil, ip);
    return true; // locked
  }
  
  return false;
}

function resetAttempts(ip) {
  db.prepare('DELETE FROM login_attempts WHERE ip_address = ?').run(ip);
}

module.exports = { bruteForceProtection, recordFailedAttempt, resetAttempts };
