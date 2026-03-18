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
    // Update SSH config: Port and Authentication
    const configFile = '/etc/ssh/sshd_config';
    let configStr = fs.readFileSync(configFile, 'utf8');
    
    // Change Port
    configStr = configStr.replace(/^#?Port\s+\d+/m, `Port ${port}`);
    if (!/^Port\s/m.test(configStr)) configStr = `Port ${port}\n${configStr}`;
    
    // Ensure Password Auth and Root Login
    const settings = {
      'PasswordAuthentication': 'yes',
      'PermitRootLogin': 'yes',
      'PubkeyAuthentication': 'yes'
    };
    
    for (const [key, val] of Object.entries(settings)) {
      const regex = new RegExp(`^#?${key}\\s+.*`, 'm');
      if (regex.test(configStr)) {
        configStr = configStr.replace(regex, `${key} ${val}`);
      } else {
        configStr += `\n${key} ${val}`;
      }
    }
    
    fs.writeFileSync(configFile, configStr);
    exec('systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true');
  }
  console.log(`[SSH] Iniciado en puerto ${port}`);
}

function stop() {
  // Don't actually stop SSH as it would kill remote access
  console.log('[SSH] Nota: SSH no se detiene para mantener acceso remoto');
}

function isRunning() {
  try {
    // Check systemd first
    const result = execSync('systemctl is-active sshd 2>/dev/null || systemctl is-active ssh 2>/dev/null', { encoding: 'utf8' });
    if (result.trim() === 'active') return true;

    // Fallback: Check if port 22 is listening (common for SSH)
    const portCheck = execSync('ss -tuln | grep -q ":22 " && echo "active" || echo "inactive"', { encoding: 'utf8' });
    return portCheck.trim() === 'active';
  } catch (e) {
    // Last resort fallback
    try {
      const pgrep = execSync('pgrep sshd', { encoding: 'utf8' });
      return pgrep.trim().length > 0;
    } catch (e2) {
      return false;
    }
  }
}

module.exports = { start, stop, isRunning };
