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

function generateConfig(port) {
  return `pid = /var/run/stunnel4/stunnel.pid
cert = ${config.SSL_CERT}
key = ${config.SSL_KEY}
client = no
socket = a:SO_REUSEADDR=1
socket = l:TCP_NODELAY=1
socket = r:TCP_NODELAY=1

[ssh]
accept = ${port}
connect = 127.0.0.1:22

[dropbear]
accept = ${port + 1}
connect = 127.0.0.1:22
`;
}

function start(port) {
  if (isRoot) {
    const configContent = generateConfig(port);
    fs.writeFileSync('/etc/stunnel/stunnel.conf', configContent);
    exec('systemctl restart stunnel4');
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
