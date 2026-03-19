const fs = require('fs');
const config = require('../config');
const privileged = require('./privileged-exec');
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
  // Verify certificates exist (need to read them or check existence)
  // Check existence via privileged if possible or just rely on start failure
  const hasCert = privileged.isRoot ? fs.existsSync(config.SSL_CERT) : true; // assume true if not root, or use ls
  
  const configContent = generateConfig(port);
  privileged.run('mkdir', ['-p', '/etc/stunnel']);
  privileged.writeTextFile('/etc/stunnel/stunnel.conf', configContent);
  
  try {
    privileged.run('systemctl', ['restart', 'stunnel4']);
    console.log(`[Stunnel] Iniciado SSL en puerto ${port}`);
  } catch (err) {
    console.error('[Stunnel] Falló el reinicio de stunnel4:', err.message);
  }
}

function stop() {
  privileged.run('systemctl', ['stop', 'stunnel4'], { ignoreError: true });
  console.log('[Stunnel] Detenido');
}

function isRunning() {
  try {
    const result = privileged.run('systemctl', ['is-active', 'stunnel4'], { ignoreError: true });
    return result.trim() === 'active';
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
