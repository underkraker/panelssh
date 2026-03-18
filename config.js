const path = require('path');

module.exports = {
  // Panel port (should NOT conflict with 80/443)
  PORT: process.env.PANEL_PORT || 2026,
  
  // Domain
  DOMAIN: process.env.PANEL_DOMAIN || 'localhost',
  
  // SSL cert paths (populated by installer)
  SSL_CERT: process.env.SSL_CERT || '/etc/letsencrypt/live/domain/fullchain.pem',
  SSL_KEY: process.env.SSL_KEY || '/etc/letsencrypt/live/domain/privkey.pem',
  
  // Database
  DB_PATH: path.join(__dirname, 'database', 'lacasita.db'),
  
  // Session
  SESSION_SECRET: process.env.SESSION_SECRET || 'lacasita-secret-2026-change-me',
  
  // Brute force
  MAX_LOGIN_ATTEMPTS: 3,
  LOCKOUT_MINUTES: 15,
  
  // Port monitor interval (ms)
  PORT_MONITOR_INTERVAL: 5000,
  
  // Telegram Bot (Optional)
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  
  // Services default ports
  SERVICES: {
    ssh: { port: 22, configFile: '/etc/ssh/sshd_config' },
    stunnel: { port: 443, configFile: '/etc/stunnel/stunnel.conf' },
    squid: { port: 3128, configFile: '/etc/squid/squid.conf' },
    v2ray: { port: 10085, configFile: '/etc/v2ray/config.json' },
    websocket: { port: 8880, scriptFile: '/usr/local/bin/ws-tunnel.py' }
  }
};
