const { execSync } = require('child_process');
const fs = require('fs');

const isRoot = process.getuid && process.getuid() === 0;

function exec(cmd) {
  if (!isRoot) {
    console.log(`[SSH] (simulado) ${cmd}`);
    return '';
  }
  return execSync(cmd, { encoding: 'utf8', timeout: 10000 });
}

function start(port) {
  if (isRoot) {
    // Update SSH config port
    const configFile = '/etc/ssh/sshd_config';
    let config = fs.readFileSync(configFile, 'utf8');
    config = config.replace(/^#?Port\s+\d+/m, `Port ${port}`);
    if (!/^Port\s/m.test(config)) {
      config = `Port ${port}\n${config}`;
    }
    fs.writeFileSync(configFile, config);
    exec('systemctl restart sshd');
  }
  console.log(`[SSH] Iniciado en puerto ${port}`);
}

function stop() {
  // Don't actually stop SSH as it would kill remote access
  console.log('[SSH] Nota: SSH no se detiene para mantener acceso remoto');
}

function isRunning() {
  try {
    const result = execSync('systemctl is-active sshd 2>/dev/null || systemctl is-active ssh 2>/dev/null', { encoding: 'utf8' });
    return result.trim() === 'active';
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
