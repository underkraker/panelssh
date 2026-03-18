// ── Global Error Handling (Expert Troubleshooting) ──────────
process.on('uncaughtException', (err) => {
  console.error('❌ [CRASH] Uncaught Exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [CRASH] Unhandled Rejection at:', promise, 'reason:', reason);
});

const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const cron = require('node-cron');
const fs = require('fs');

const config = require('./config');
// Import DB with error handling already inside its module
const db = require('./database/db');
const portMonitor = require('./services/port-monitor');
const cleanupExpired = require('./cron/cleanup-expired');
const cleanupDemos = require('./cron/cleanup-demos');

// ── Express App ──────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/demos', require('./routes/demos'));
app.use('/api/resellers', require('./routes/resellers'));
app.use('/api/services', require('./routes/services'));
app.use('/api/logs', require('./routes/logs'));

// Dashboard stats endpoint
app.get('/api/dashboard', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  
  const { user } = req.session;
  let stats;
  
  if (user.role === 'admin') {
    stats = {
      totalUsers: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
      activeUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'active'").get().c,
      expiredUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'expired'").get().c,
      bannedUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'banned'").get().c,
      activeDemos: db.prepare("SELECT COUNT(*) as c FROM demos WHERE status = 'active'").get().c,
      totalResellers: db.prepare("SELECT COUNT(*) as c FROM admins WHERE role = 'reseller'").get().c,
      activeServices: db.prepare('SELECT COUNT(*) as c FROM service_ports WHERE enabled = 1').get().c,
      recentLogs: db.prepare('SELECT l.*, a.username as admin_name FROM logs l LEFT JOIN admins a ON l.admin_id = a.id ORDER BY l.created_at DESC LIMIT 10').all()
    };
  } else {
    stats = {
      totalUsers: db.prepare('SELECT COUNT(*) as c FROM users WHERE created_by = ?').get(user.id).c,
      activeUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE created_by = ? AND status = 'active'").get(user.id).c,
      expiredUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE created_by = ? AND status = 'expired'").get(user.id).c,
      credits: db.prepare('SELECT credits FROM admins WHERE id = ?').get(user.id).credits,
      activeDemos: 0,
      totalResellers: 0,
      activeServices: 0,
      recentLogs: []
    };
  }
  
  res.json(stats);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── WebSocket Server (Port Monitor) ─────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  console.log('[WS] Cliente conectado');
  portMonitor.addClient(ws);
});

// ── Cron Jobs ────────────────────────────────────────────────
// Cleanup expired users every hour
cron.schedule('0 * * * *', cleanupExpired);

// Cleanup expired demos every 30 seconds
setInterval(cleanupDemos, 30000);

// ── Start Server ─────────────────────────────────────────────
const PORT = config.PORT;

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║         🏠 Panel La Casita v2026             ║');
  console.log(`║         Puerto: ${PORT}                         ║`);
  console.log('║         Estado: ✅ Activo                     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`🌐 http://localhost:${PORT}`);
  console.log('👤 Admin: admin / admin123');
  console.log('');
  
  // Start port monitor
  portMonitor.startMonitor(config.PORT_MONITOR_INTERVAL);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Cerrando...');
  portMonitor.stopMonitor();
  server.close();
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] Cerrando...');
  portMonitor.stopMonitor();
  server.close();
  db.close();
  process.exit(0);
});
