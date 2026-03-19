const { spawnSync } = require('child_process');
const fs = require('fs');
const privileged = require('./privileged-exec');

const isRoot = privileged.isRoot;

function validateUsername(username) {
  return /^[a-z_][a-z0-9_-]{0,31}$/.test(String(username || ''));
}

function validateExpiryDate(expiryDate) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(expiryDate || ''));
}

function run(command, args = [], options = {}) {
  const { ignoreError = false, input } = options;
  return privileged.run(command, args, { ignoreError, input });
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

  // Determine shell (prefer nologin for security)
  let shell = '/bin/false';
  if (fs.existsSync('/usr/sbin/nologin')) shell = '/usr/sbin/nologin';
  else if (fs.existsSync('/usr/bin/nologin')) shell = '/usr/bin/nologin';

  console.log(`[System] Creando usuario ${username} con shell ${shell}...`);
  
  // Create Linux user with shell for SSH tunnel only
  try {
    // Check if user already exists in system to avoid confusing errors
    const checkUser = spawnSync('id', [username]);
    if (checkUser.status === 0) {
      console.warn(`[System] El usuario ${username} ya existe en el sistema. Intentando actualizar contraseña...`);
    } else {
      run('useradd', ['-M', '-s', shell, '-e', expiryDate, username]);
    }
    
    setPassword(username, password);
    console.log(`[System] Usuario creado/actualizado: ${username}, expira: ${expiryDate}`);
  } catch (err) {
    console.error(`[System] Error al crear usuario ${username}:`, err.message);
    throw new Error(`Error de sistema al crear usuario: ${err.message}`);
  }
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
