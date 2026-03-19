const express = require('express');
const db = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const portMonitor = require('../services/port-monitor');
const sshService = require('../services/ssh');
const stunnelService = require('../services/stunnel');
const squidService = require('../services/squid');
const v2rayService = require('../services/v2ray');
const websocketService = require('../services/websocket');

const router = express.Router();

const serviceModules = {
  ssh: sshService,
  stunnel: stunnelService,
  squid: squidService,
  v2ray: v2rayService,
  websocket: websocketService,
  badvpn: require('../services/badvpn'),
  hysteria: require('../services/hysteria')
};

const protocolProfiles = [
  { type: 'ssh', service: 'ssh', label: 'SSH Directo' },
  { type: 'ssl', service: 'stunnel', label: 'SSL/TLS (Stunnel)' },
  { type: 'websocket', service: 'websocket', label: 'WebSocket Tunnel' },
  { type: 'squid', service: 'squid', label: 'Squid Proxy' },
  { type: 'v2ray', service: 'v2ray', label: 'V2Ray / Xray' },
  { type: 'hysteria', service: 'hysteria', label: 'Hysteria v2' }
];

function buildHealthSnapshot() {
  const services = db.prepare('SELECT * FROM service_ports').all();
  const portStatus = portMonitor.getPortStatus();
  const details = [];

  for (const svc of services) {
    const mod = serviceModules[svc.name];
    let running = false;
    try {
      running = mod ? !!mod.isRunning() : false;
    } catch (e) {
      running = false;
    }

    const listening = !!(portStatus[svc.name] && portStatus[svc.name].listening);
    const enabled = !!svc.enabled;
    const issues = [];

    if (svc.name === 'ssh' && svc.port !== 22) {
      issues.push('Puerto SSH distinto de 22');
    }

    if (enabled && !running) {
      issues.push('Proceso no activo');
    }

    if (enabled && !listening) {
      issues.push('Puerto no está escuchando');
    }

    const healthy = enabled ? issues.length === 0 : false;

    details.push({
      name: svc.name,
      port: svc.port,
      enabled,
      running,
      listening,
      healthy,
      issues
    });
  }

  const enabled = details.filter(x => x.enabled).length;
  const healthy = details.filter(x => x.enabled && x.healthy).length;
  const unhealthy = details.filter(x => x.enabled && !x.healthy).length;

  const profileStatus = protocolProfiles.map(profile => {
    const target = details.find(x => x.name === profile.service);
    return {
      ...profile,
      enabled: target ? target.enabled : false,
      healthy: target ? target.healthy : false,
      ready: !!(target && target.enabled && target.healthy),
      port: target ? target.port : null,
      issues: target ? target.issues : ['Servicio no encontrado']
    };
  });

  return {
    summary: {
      enabled,
      healthy,
      unhealthy,
      allGood: enabled > 0 && unhealthy === 0
    },
    services: details,
    protocols: profileStatus
  };
}

// GET /api/services/status — get all service status
router.get('/status', requireAuth, (req, res) => {
  const services = db.prepare('SELECT * FROM service_ports').all();
  const statuses = services.map(svc => {
    const mod = serviceModules[svc.name];
    let running = false;
    try {
      running = mod ? mod.isRunning() : false;
    } catch (e) {}
    return {
      name: svc.name,
      port: svc.port,
      enabled: !!svc.enabled,
      running
    };
  });
  res.json({ services: statuses });
});

// GET /api/services/health — detailed service diagnostics
router.get('/health', requireAuth, (req, res) => {
  try {
    const health = buildHealthSnapshot();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: 'Error al evaluar estado de servicios: ' + err.message });
  }
});

// POST /api/services/health/repair — try auto-repair on unhealthy enabled services
router.post('/health/repair', requireAuth, requireAdmin, (req, res) => {
  try {
    const before = buildHealthSnapshot();
    const repaired = [];
    const failed = [];

    for (const svc of before.services.filter(s => s.enabled && !s.healthy)) {
      const mod = serviceModules[svc.name];
      if (!mod || typeof mod.start !== 'function') continue;

      const targetPort = svc.name === 'ssh' ? 22 : svc.port;
      try {
        mod.start(targetPort);
        repaired.push(svc.name);
      } catch (err) {
        failed.push({ name: svc.name, error: err.message });
      }
    }

    db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
      .run(req.session.user.id, 'service_repair', 'services', `Auto-repair ejecutado. Reiniciados: ${repaired.join(', ') || 'ninguno'}`);

    const after = buildHealthSnapshot();

    res.json({
      success: true,
      repaired,
      failed,
      before: before.summary,
      after: after.summary,
      services: after.services,
      protocols: after.protocols
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en auto-reparación: ' + err.message });
  }
});

// POST /api/services/:name/toggle — toggle service on/off
router.post('/:name/toggle', requireAuth, requireAdmin, (req, res) => {
  const { name } = req.params;
  const mod = serviceModules[name];
  
  if (!mod) {
    return res.status(404).json({ error: 'Servicio no encontrado.' });
  }
  
  const svc = db.prepare('SELECT * FROM service_ports WHERE name = ?').get(name);
  if (!svc) return res.status(404).json({ error: 'Servicio no configurado.' });
  
  try {
    const newState = !svc.enabled;

    if (newState) {
      const targetPort = svc.port;
      mod.start(targetPort);
    } else {
      mod.stop();
    }
    
    db.prepare('UPDATE service_ports SET enabled = ? WHERE name = ?').run(newState ? 1 : 0, name);
    
    db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
      .run(req.session.user.id, 'service_toggle', name, `${newState ? 'Activado' : 'Desactivado'} en puerto ${svc.port}`);

    let runningNow = false;
    try {
      runningNow = mod ? !!mod.isRunning() : false;
    } catch (e) {
      runningNow = false;
    }
    
    res.json({ success: true, enabled: newState, running: runningNow });
  } catch (err) {
    console.error(`[Services] Toggle ${name} error:`, err.message);
    res.status(500).json({ error: 'Error al cambiar servicio: ' + err.message });
  }
});

// PUT /api/services/:name/port — change service port
router.put('/:name/port', requireAuth, requireAdmin, (req, res) => {
  const { name } = req.params;
  const port = parseInt(req.body.port, 10);

  if (name === 'ssh') {
    return res.status(400).json({ error: 'El puerto SSH está fijado en 22 y no se puede cambiar.' });
  }
  
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return res.status(400).json({ error: 'Puerto inválido.' });
  }
  
  db.prepare('UPDATE service_ports SET port = ? WHERE name = ?').run(port, name);
  
  db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
    .run(req.session.user.id, 'port_change', name, `Puerto cambiado a ${port}`);
  
  res.json({ success: true });
});

module.exports = router;
