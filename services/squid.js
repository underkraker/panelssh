const { execSync } = require('child_process');
const fs = require('fs');

const isRoot = process.getuid && process.getuid() === 0;

function exec(cmd) {
  if (!isRoot) {
    console.log(`[Squid] (simulado) ${cmd}`);
    return '';
  }
  return execSync(cmd, { encoding: 'utf8', timeout: 10000 });
}

function generateConfig(port) {
  return `# Squid Proxy Config - La Casita Panel
http_port ${port}
visible_hostname LaCasita

# ACL
acl localhost src 127.0.0.1/32 ::1
acl to_localhost dst 127.0.0.0/8 0.0.0.0/32 ::1
acl SSL_ports port 443
acl Safe_ports port 80
acl Safe_ports port 21
acl Safe_ports port 443
acl Safe_ports port 70
acl Safe_ports port 210
acl Safe_ports port 1025-65535
acl Safe_ports port 280
acl Safe_ports port 488
acl Safe_ports port 591
acl Safe_ports port 777
acl CONNECT method CONNECT

# Headers for HTTP Custom / HTTP Injector
request_header_access Allow allow all
request_header_access Authorization allow all
request_header_access WWW-Authenticate allow all
request_header_access Proxy-Authorization allow all
request_header_access Proxy-Authenticate allow all
request_header_access Cache-Control allow all
request_header_access Content-Encoding allow all
request_header_access Content-Length allow all
request_header_access Content-Type allow all
request_header_access Date allow all
request_header_access Expires allow all
request_header_access Host allow all
request_header_access If-Modified-Since allow all
request_header_access Last-Modified allow all
request_header_access Location allow all
request_header_access Pragma allow all
request_header_access Accept allow all
request_header_access Accept-Charset allow all
request_header_access Accept-Encoding allow all
request_header_access Accept-Language allow all
request_header_access Content-Language allow all
request_header_access Mime-Version allow all
request_header_access Retry-After allow all
request_header_access Title allow all
request_header_access Connection allow all
request_header_access Proxy-Connection allow all
request_header_access User-Agent allow all
request_header_access Cookie allow all
request_header_access Upgrade allow all
request_header_access X-Forwarded-For allow all
request_header_access X-Forwarded-Proto allow all
request_header_access X-Requested-With allow all
request_header_access All allow all

http_access allow all
forwarded_for delete
via off
`;
}

function start(port) {
  if (isRoot) {
    const configContent = generateConfig(port);
    fs.writeFileSync('/etc/squid/squid.conf', configContent);
    exec('systemctl restart squid');
  }
  console.log(`[Squid] Iniciado en puerto ${port}`);
}

function stop() {
  exec('systemctl stop squid');
  console.log('[Squid] Detenido');
}

function isRunning() {
  try {
    const result = execSync('systemctl is-active squid 2>/dev/null', { encoding: 'utf8' });
    return result.trim() === 'active';
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
