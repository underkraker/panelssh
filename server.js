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

const config = require('./config');
// Import DB with error handling already inside its module
const db = require('./database/db');
const portMonitor = require('./services/port-monitor');
const cleanupExpired = require('./cron/cleanup-expired');
const cleanupDemos = require('./cron/cleanup-demos');

const serviceModules = {
  ssh: require('./services/ssh'),
  stunnel: require('./services/stunnel'),
  squid: require('./services/squid'),
  v2ray: require('./services/v2ray'),
  websocket: require('./services/websocket'),
  badvpn: require('./services/badvpn'),
  hysteria: require('./services/hysteria')
};

function startEnabledServices() {
  const services = db.prepare('SELECT * FROM service_ports WHERE enabled = 1').all();
  services.forEach(svc => {
    const mod = serviceModules[svc.name];
    if (!mod) return;

    const targetPort = svc.port;

    console.log(`[AutoStart] Iniciando ${svc.name} en puerto ${targetPort}...`);
    try {
      mod.start(targetPort);
    } catch (e) {
      console.error(`[AutoStart] Error al iniciar ${svc.name}:`, e.message);
    }
  });
}

function startServiceWatchdog() {
  const isRoot = process.getuid && process.getuid() === 0;
  if (!isRoot) return;

  setInterval(() => {
    try {
      const enabledServices = db.prepare('SELECT * FROM service_ports WHERE enabled = 1').all();
      for (const svc of enabledServices) {
        const mod = serviceModules[svc.name];
        if (!mod || typeof mod.isRunning !== 'function') continue;

        let running = false;
        try {
          running = !!mod.isRunning();
        } catch (e) {
          running = false;
        }

        if (!running) {
          const targetPort = svc.port;
          
          // Check for port conflict before restarting
          try {
            const conflict = db.prepare('SELECT name FROM service_ports WHERE port = ? AND name != ? AND enabled = 1').get(targetPort, svc.name);
            if (conflict) {
              console.error(`[Watchdog] ❌ Conflicto de puerto detected: ${svc.name} no puede iniciar en ${targetPort} porque ${conflict.name} lo está usando.`);
              continue;
            }
          } catch (e) {}

          console.warn(`[Watchdog] ⚠️ ${svc.name} caído, reiniciando en puerto ${targetPort}...`);
          try {
            mod.start(targetPort);
          } catch (restartErr) {
            console.error(`[Watchdog] ❌ Error al reiniciar ${svc.name}:`, restartErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[Watchdog] Error general:', err.message);
    }
  }, 30000);
}

// ── Express App ──────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
if (isProduction) {
  app.set('trust proxy', 1);
}

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions
const sessionMiddleware = session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  }
});

app.use(sessionMiddleware);

// Basic CSRF mitigation for browser requests using cookies
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const host = req.get('host');
  const origin = req.get('origin');
  const referer = req.get('referer');

  try {
    if (origin && new URL(origin).host !== host) {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }
    if (!origin && referer && new URL(referer).host !== host) {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }
  } catch (err) {
    return res.status(403).json({ error: 'Encabezado de origen inválido.' });
  }

  next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/demos', require('./routes/demos'));
app.use('/api/resellers', require('./routes/resellers'));
app.use('/api/services', require('./routes/services'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/settings', require('./routes/settings'));

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
      serviceStats: {
        active: db.prepare('SELECT COUNT(*) as c FROM service_ports WHERE enabled = 1').get().c,
        inactive: db.prepare('SELECT COUNT(*) as c FROM service_ports WHERE enabled = 0').get().c
      },
      recentLogs: db.prepare('SELECT l.*, a.username as admin_name FROM logs l LEFT JOIN admins a ON l.admin_id = a.id ORDER BY l.created_at DESC LIMIT 10').all()
    };
  } else {
    const reseller = db.prepare('SELECT credits FROM admins WHERE id = ?').get(user.id);
    stats = {
      totalUsers: db.prepare('SELECT COUNT(*) as c FROM users WHERE created_by = ?').get(user.id).c,
      activeUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE created_by = ? AND status = 'active'").get(user.id).c,
      expiredUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE created_by = ? AND status = 'expired'").get(user.id).c,
      credits: reseller ? reseller.credits : 0,
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
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (!request.url || !request.url.startsWith('/ws')) {
    socket.destroy();
    return;
  }

  const fakeRes = {
    statusCode: 200,
    getHeader: () => undefined,
    setHeader: () => {},
    writeHead: () => {},
    end: () => {}
  };

  sessionMiddleware(request, fakeRes, () => {
    if (!request.session || !request.session.user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', (ws, req) => {
  console.log(`[WS] Cliente conectado: ${req.session.user.username}`);
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

  const isRoot = process.getuid && process.getuid() === 0;
  if (!isRoot) {
    console.warn('');
    console.warn('⚠️  [ADVERTENCIA] El panel NO se está ejecutando como ROOT.');
    console.warn('   Muchos servicios (SSH, SSL, Squid) fallarán al intentar iniciarse o monitorearse.');
    console.warn('   Se recomienda ejecutar con: sudo node server.js');
    console.warn('');
  }

  // Check system requirements
  const checkCmd = (cmd) => {
    try { require('child_process').execSync(`command -v ${cmd} >/dev/null 2>&1`); return true; }
    catch (e) { return false; }
  };
  
  const requirements = ['ss', 'netstat', 'pgrep'];
  requirements.forEach(req => {
    if (!checkCmd(req)) console.warn(`⚠️  [SISTEMA] Falta comando esencial: ${req}. El monitoreo puede fallar.`);
  });

  // Auto-start enabled services
  try {
    startEnabledServices();
    startServiceWatchdog();
  } catch (err) {
    console.error('[AutoStart] Error al cargar servicios:', err.message);
  }
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
