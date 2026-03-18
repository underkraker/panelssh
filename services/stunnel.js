const { execSync } = require('child_process');
const fs = require('fs');
const config = require('../config');

const isRoot = process.getuid && process.getuid() === 0;

function exec(cmd) {
  if (!isRoot) {
    console.log(`[Stunnel] (simulado) ${cmd}`);
    return '';
  }
  return execSync(cmd, { encoding: 'utf8', timeout: 10000 });
}

const db = require('../database/db');

function generateConfig(port) {
  // Get current SSH port from DB
  let sshPort = 22;
  try {
    const svc = db.prepare('SELECT port FROM service_ports WHERE name = ?').get('ssh');
    if (svc) sshPort = svc.port;
  } catch (e) {}

  return `pid = /var/run/stunnel4/stunnel.pid
cert = ${config.SSL_CERT}
key = ${config.SSL_KEY}
client = no
socket = a:SO_REUSEADDR=1
socket = l:TCP_NODELAY=1
socket = r:TCP_NODELAY=1

[ssh-ssl]
accept = 0.0.0.0:${port}
connect = 127.0.0.1:${sshPort}
`;
}

function start(port) {
  if (isRoot) {
    // Verify certificates exist
    if (!fs.existsSync(config.SSL_CERT) || !fs.existsSync(config.SSL_KEY)) {
      console.error(`[Stunnel] Error: Certificados no encontrados en ${config.SSL_CERT} o ${config.SSL_KEY}`);
      console.warn('[Stunnel] Por favor, genere los certificados SSL antes de activar este servicio.');
      return;
    }

    const configContent = generateConfig(port);
    fs.writeFileSync('/etc/stunnel/stunnel.conf', configContent);
    
    try {
      exec('systemctl restart stunnel4');
    } catch (err) {
      console.error('[Stunnel] Falló el reinicio de stunnel4:', err.message);
    }
  }
  console.log(`[Stunnel] Iniciado SSL en puerto ${port}`);
}

function stop() {
  exec('systemctl stop stunnel4');
  console.log('[Stunnel] Detenido');
}

function isRunning() {
  try {
    const result = execSync('systemctl is-active stunnel4 2>/dev/null', { encoding: 'utf8' });
    return result.trim() === 'active';
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
