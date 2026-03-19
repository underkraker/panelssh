const fs = require('fs');
const config = require('../config');
const privileged = require('./privileged-exec');

let hysteriaProcess = null;

function start(port = 4434) {
  stop();
  const configPath = '/etc/hysteria/server.yaml';
  const domain = config.DOMAIN || 'localhost';
  const authPassword = process.env.HYSTERIA_PASSWORD || 'hysteria_pass';
  
  // Ensure config directory exists
  privileged.run('mkdir', ['-p', '/etc/hysteria']);

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

  privileged.writeTextFile(configPath, yamlConfig);

  // We should ideally run this as a service, but for now we follow the existing spawn pattern
  // but using sudo if not root via privileged.run  // Launch hysteria
  const hysteriaBin = '/usr/local/bin/hysteria';
  const cmd = privileged.isRoot ? hysteriaBin : 'sudo';
  const args = privileged.isRoot ? ['server', '--config', configPath] : ['-n', hysteriaBin, 'server', '--config', configPath];

  const { spawn } = require('child_process');
  hysteriaProcess = spawn(cmd, args, {
    detached: true,
    stdio: 'ignore'
  });
  hysteriaProcess.unref();
  
  console.log(`[Hysteria] Iniciado en puerto ${port}`);
}

function stop() {
  privileged.run('pkill', ['-f', 'hysteria'], { ignoreError: true });
  if (hysteriaProcess) {
    hysteriaProcess.kill();
    hysteriaProcess = null;
  }
  console.log('[Hysteria] Detenido');
}

function isRunning() {
  try {
    const result = privileged.run('pgrep', ['-f', 'hysteria'], { ignoreError: true });
    return result && result.trim().length > 0;
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
