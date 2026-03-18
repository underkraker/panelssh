const { execSync } = require('child_process');
const db = require('../database/db');

let monitorInterval = null;
let lastStatus = {};
let wsClients = new Set();

function getPortStatus() {
  const services = db.prepare('SELECT name, port, enabled FROM service_ports').all();
  const status = {};
  
  try {
    // Use ss -tuln for fast port check, netstat as fallback
    let ssOutput = '';
    try {
      ssOutput = execSync('ss -tuln', { encoding: 'utf8', timeout: 3000 });
    } catch (e) {
      ssOutput = execSync('netstat -tuln', { encoding: 'utf8', timeout: 3000 });
    }
    
    for (const svc of services) {
      // Check for port in output. Matches ":PORT " or ":PORT\n"
      // Handle both IPv4 (0.0.0.0:PORT) and IPv6 ([::]:PORT) formatted by ss/netstat
      const portRegex = new RegExp(`[:\\]]${svc.port}\\s`, 'm');
      const listening = portRegex.test(ssOutput);
      
      status[svc.name] = {
        name: svc.name,
        port: svc.port,
        enabled: !!svc.enabled,
        listening: listening
      };
    }
  } catch (e) {
    console.error('[Monitor] Error checking ports:', e.message);
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
