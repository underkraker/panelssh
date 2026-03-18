const { execSync, spawn } = require('child_process');
const fs = require('fs');
const config = require('../config');

const isRoot = process.getuid && process.getuid() === 0;
let hysteriaProcess = null;

function start(port = 4434) {
  if (isRoot) {
    stop();
    const configPath = '/etc/hysteria/server.yaml';
    const domain = config.DOMAIN || 'localhost';
    const authPassword = process.env.HYSTERIA_PASSWORD || 'hysteria_pass';
    
    // Ensure config directory exists
    if (!fs.existsSync('/etc/hysteria')) {
      fs.mkdirSync('/etc/hysteria', { recursive: true });
    }

    // Basic Hysteria 2 config
    const yamlConfig = `listen: :${port}
acme:
  domains:
    - ${domain}
  email: admin@panel.local
auth:
  type: password
  password: ${authPassword}
`;

    fs.writeFileSync(configPath, yamlConfig);

    hysteriaProcess = spawn('hysteria', ['server', '--config', configPath], {
      detached: true,
      stdio: 'ignore'
    });
    hysteriaProcess.unref();
  }
  console.log(`[Hysteria] Iniciado en puerto ${port}`);
}

function stop() {
  if (isRoot) {
    try { execSync('pkill -f hysteria', { stdio: 'ignore' }); } catch (e) {}
    if (hysteriaProcess) {
      hysteriaProcess.kill();
      hysteriaProcess = null;
    }
  }
  console.log('[Hysteria] Detenido');
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
