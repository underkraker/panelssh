const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('express');

const isRoot = process.getuid && process.getuid() === 0;
let hysteriaProcess = null;

function start(port = 4434) {
  if (isRoot) {
    stop();
    const configPath = '/etc/hysteria/server.yaml';
    
    // Ensure config directory exists
    if (!fs.existsSync('/etc/hysteria')) {
      fs.mkdirSync('/etc/hysteria', { recursive: true });
    }

    // Basic Hysteria 2 config
    const config = `listen: :${port}
acme:
  domains:
    - krakerpanel.duckdns.org # This should be dynamic
  email: admin@panel.local
auth:
  type: password
  password: hysteria_pass
`;

    fs.writeFileSync(configPath, config);

    hysteriaProcess = spawn('hysteria', ['server', '--config', configPath], {
      detached: true,
      stdio: 'ignore'
    });
    hysteriaProcess.unref();
  }
}

function stop() {
  if (isRoot) {
    try { execSync('pkill -f hysteria', { stdio: 'ignore' }); } catch (e) {}
    if (hysteriaProcess) {
      hysteriaProcess.kill();
      hysteriaProcess = null;
    }
  }
}

function isRunning() {
  if (!isRoot) return false;
  try {
    const result = execSync('pgrep -f hysteria', { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
