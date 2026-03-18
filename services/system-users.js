const { execSync } = require('child_process');

const isRoot = process.getuid && process.getuid() === 0;

function exec(cmd, ignoreError = false) {
  if (!isRoot) {
    console.log(`[System] (simulado) ${cmd}`);
    return '';
  }
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 10000 });
  } catch (err) {
    if (ignoreError) {
      console.warn(`[System] Ignored error for: ${cmd}`);
      return '';
    }
    console.error(`[System] Error: ${cmd}`, err.message);
    throw err;
  }
}

function createSystemUser(username, password, expiryDate) {
  // Create Linux user with shell /bin/false for SSH tunnel only
  // ignoreError=true in case user already exists in system
  exec(`useradd -M -s /bin/false -e ${expiryDate} ${username}`, true);
  exec(`echo "${username}:${password}" | chpasswd`);
  console.log(`[System] Usuario creado: ${username}, expira: ${expiryDate}`);
}

function deleteSystemUser(username) {
  // Kill active sessions first
  exec(`pkill -u ${username}`, true);
  exec(`userdel -f ${username}`, true);
  console.log(`[System] Usuario eliminado: ${username}`);
}

function changePassword(username, newPassword) {
  exec(`echo "${username}:${newPassword}" | chpasswd`);
  console.log(`[System] Contraseña cambiada: ${username}`);
}

function setExpiry(username, date) {
  exec(`chage -E ${date} ${username}`);
  console.log(`[System] Expiración actualizada: ${username} -> ${date}`);
}

function lockUser(username) {
  exec(`usermod -L ${username}`);
  try { exec(`pkill -u ${username}`); } catch (e) {}
  console.log(`[System] Usuario bloqueado: ${username}`);
}

function unlockUser(username) {
  exec(`usermod -U ${username}`);
  console.log(`[System] Usuario desbloqueado: ${username}`);
}

module.exports = { createSystemUser, deleteSystemUser, changePassword, setExpiry, lockUser, unlockUser };
