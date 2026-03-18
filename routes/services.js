const express = require('express');
const db = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
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
  badvpn: require('../services/badvpn')
};

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
      mod.start(svc.port);
    } else {
      mod.stop();
    }
    
    db.prepare('UPDATE service_ports SET enabled = ? WHERE name = ?').run(newState ? 1 : 0, name);
    
    db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
      .run(req.session.user.id, 'service_toggle', name, `${newState ? 'Activado' : 'Desactivado'} en puerto ${svc.port}`);
    
    res.json({ success: true, enabled: newState, running: newState });
  } catch (err) {
    console.error(`[Services] Toggle ${name} error:`, err.message);
    res.status(500).json({ error: 'Error al cambiar servicio: ' + err.message });
  }
});

// PUT /api/services/:name/port — change service port
router.put('/:name/port', requireAuth, requireAdmin, (req, res) => {
  const { name } = req.params;
  const { port } = req.body;
  
  if (!port || port < 1 || port > 65535) {
    return res.status(400).json({ error: 'Puerto inválido.' });
  }
  
  db.prepare('UPDATE service_ports SET port = ? WHERE name = ?').run(port, name);
  
  db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
    .run(req.session.user.id, 'port_change', name, `Puerto cambiado a ${port}`);
  
  res.json({ success: true });
});

module.exports = router;
