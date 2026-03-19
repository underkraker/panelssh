const privileged = require('./privileged-exec');

const isRoot = privileged.isRoot;

function restartSshService() {
  privileged.run('systemctl', ['restart', 'ssh'], { ignoreError: true });
  privileged.run('systemctl', ['restart', 'sshd'], { ignoreError: true });
}

function start(port) {
  const configFile = '/etc/ssh/sshd_config';
  let configStr = privileged.readTextFile(configFile);

  configStr = configStr.replace(/^#?Port\s+\d+/m, `Port ${port}`);
  if (!/^Port\s/m.test(configStr)) configStr = `Port ${port}\n${configStr}`;

  const settings = {
    PasswordAuthentication: 'yes',
    PermitRootLogin: 'yes',
    PubkeyAuthentication: 'yes'
  };

  for (const [key, val] of Object.entries(settings)) {
    const regex = new RegExp(`^#?${key}\\s+.*`, 'm');
    if (regex.test(configStr)) {
      configStr = configStr.replace(regex, `${key} ${val}`);
    } else {
      configStr += `\n${key} ${val}`;
    }
  }

  privileged.writeTextFile(configFile, configStr);
  restartSshService();

  if (!isRoot) {
    console.log('[SSH] Ejecutado con sudo para forzar compatibilidad root');
  }
  console.log(`[SSH] Iniciado en puerto ${port}`);
}

function stop() {
  console.log('[SSH] Nota: SSH no se detiene para mantener acceso remoto');
}

function isRunning() {
  try {
    const sshd = privileged.run('systemctl', ['is-active', 'sshd'], { ignoreError: true }).trim();
    if (sshd === 'active') return true;

    const ssh = privileged.run('systemctl', ['is-active', 'ssh'], { ignoreError: true }).trim();
    if (ssh === 'active') return true;

    const portCheck = privileged.run('ss', ['-tuln'], { ignoreError: true });
    return portCheck.includes(':22 ');
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
