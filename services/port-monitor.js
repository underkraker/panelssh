const { execSync } = require('child_process');
const db = require('../database/db');

let monitorInterval = null;
let lastStatus = {};
let wsClients = new Set();

function getPortStatus() {
  const services = db.prepare('SELECT name, port, enabled FROM service_ports').all();
  const status = {};
  
  try {
    const ssOutput = execSync('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null', { 
      encoding: 'utf8', timeout: 5000 
    });
    
    for (const svc of services) {
      const portRegex = new RegExp(`:${svc.port}\\b`);
      status[svc.name] = {
        name: svc.name,
        port: svc.port,
        enabled: !!svc.enabled,
        listening: portRegex.test(ssOutput)
      };
    }
  } catch (e) {
    // If ss/netstat fails, mark all as unknown
    for (const svc of services) {
      status[svc.name] = {
        name: svc.name,
        port: svc.port,
        enabled: !!svc.enabled,
        listening: false
      };
    }
  }
  
  return status;
}

function startMonitor(interval = 5000) {
  if (monitorInterval) clearInterval(monitorInterval);
  
  monitorInterval = setInterval(() => {
    const status = getPortStatus();
    const statusStr = JSON.stringify(status);
    
    // Only broadcast if changed
    if (statusStr !== JSON.stringify(lastStatus)) {
      lastStatus = status;
      broadcastStatus(status);
    }
  }, interval);
  
  console.log(`[Monitor] Monitoreo de puertos iniciado (cada ${interval / 1000}s)`);
}

function stopMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

function broadcastStatus(status) {
  const message = JSON.stringify({ type: 'port_status', data: status });
  for (const client of wsClients) {
    try {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    } catch (e) {
      wsClients.delete(client);
    }
  }
}

function addClient(ws) {
  wsClients.add(ws);
  // Send initial status
  try {
    ws.send(JSON.stringify({ type: 'port_status', data: getPortStatus() }));
  } catch (e) {}
  
  ws.on('close', () => wsClients.delete(ws));
}

function getLastStatus() {
  return lastStatus;
}

module.exports = { startMonitor, stopMonitor, addClient, getPortStatus, getLastStatus };
