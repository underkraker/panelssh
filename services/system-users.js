const { spawnSync } = require('child_process');

const isRoot = process.getuid && process.getuid() === 0;

function validateUsername(username) {
  return /^[a-z_][a-z0-9_-]{0,31}$/.test(String(username || ''));
}

function validateExpiryDate(expiryDate) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(expiryDate || ''));
}

function run(command, args = [], options = {}) {
  const { ignoreError = false, input } = options;
  if (!isRoot) {
    console.log(`[System] (simulado) ${command} ${args.join(' ')}`);
    return '';
  }

  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 10000,
    input: input || undefined
  });

  if (result.status !== 0) {
    if (ignoreError) {
      console.warn(`[System] Ignored error for: ${command} ${args.join(' ')}`);
      return '';
    }
    const errorOutput = result.stderr || result.stdout || 'unknown error';
    throw new Error(errorOutput.trim());
  }

  return result.stdout || '';
}

function setPassword(username, password) {
  run('chpasswd', [], { input: `${username}:${password}\n` });
}

function createSystemUser(username, password, expiryDate) {
  if (!validateUsername(username)) {
    throw new Error('Nombre de usuario inválido para sistema Linux.');
  }
  if (!validateExpiryDate(expiryDate)) {
    throw new Error('Fecha de expiración inválida. Use formato YYYY-MM-DD.');
  }

  // Create Linux user with shell /bin/false for SSH tunnel only
  // ignoreError=true in case user already exists in system
  run('useradd', ['-M', '-s', '/bin/false', '-e', expiryDate, username], { ignoreError: true });
  setPassword(username, password);
  console.log(`[System] Usuario creado: ${username}, expira: ${expiryDate}`);
}

function deleteSystemUser(username) {
  if (!validateUsername(username)) {
    throw new Error('Nombre de usuario inválido para sistema Linux.');
  }

  // Kill active sessions first
  run('pkill', ['-u', username], { ignoreError: true });
  run('userdel', ['-f', username], { ignoreError: true });
  console.log(`[System] Usuario eliminado: ${username}`);
}

function changePassword(username, newPassword) {
  if (!validateUsername(username)) {
    throw new Error('Nombre de usuario inválido para sistema Linux.');
  }

  setPassword(username, newPassword);
  console.log(`[System] Contraseña cambiada: ${username}`);
}

function setExpiry(username, date) {
  if (!validateUsername(username)) {
    throw new Error('Nombre de usuario inválido para sistema Linux.');
  }
  if (!validateExpiryDate(date)) {
    throw new Error('Fecha de expiración inválida. Use formato YYYY-MM-DD.');
  }

  run('chage', ['-E', date, username]);
  console.log(`[System] Expiración actualizada: ${username} -> ${date}`);
}

function lockUser(username) {
  if (!validateUsername(username)) {
    throw new Error('Nombre de usuario inválido para sistema Linux.');
  }

  run('usermod', ['-L', username]);
  try { run('pkill', ['-u', username], { ignoreError: true }); } catch (e) {}
  console.log(`[System] Usuario bloqueado: ${username}`);
}

function unlockUser(username) {
  if (!validateUsername(username)) {
    throw new Error('Nombre de usuario inválido para sistema Linux.');
  }

  run('usermod', ['-U', username]);
  console.log(`[System] Usuario desbloqueado: ${username}`);
}

module.exports = { createSystemUser, deleteSystemUser, changePassword, setExpiry, lockUser, unlockUser };
