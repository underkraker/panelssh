const { execSync, spawn } = require('child_process');

const isRoot = process.getuid && process.getuid() === 0;
let badvpnProcess = null;

function exec(cmd) {
  if (!isRoot) {
    console.log(`[BadVPN] (simulado) ${cmd}`);
    return '';
  }
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000 });
  } catch (err) {
    return '';
  }
}

function start(port = 7300) {
  if (isRoot) {
    // Kill existing
    stop();
    
    // Launch badvpn-udpgw
    // Note: badvpn-udpgw must be installed. Usually: apt install badvpn
    // On Ubuntu 24/22 it might need to be compiled or downloaded if not in repos
    badvpnProcess = spawn('badvpn-udpgw', [
      '--listen-addr', `0.0.0.0:${port}`,
      '--max-clients', '1000',
      '--max-connections-for-client', '10'
    ], {
      detached: true,
      stdio: 'ignore'
    });
    badvpnProcess.unref();
  }
  console.log(`[BadVPN] Iniciado en puerto ${port}`);
}

function stop() {
  if (isRoot) {
    try { exec('pkill -f badvpn-udpgw'); } catch (e) {}
    if (badvpnProcess) {
      try { badvpnProcess.kill(); } catch (e) {}
      badvpnProcess = null;
    }
  }
  console.log('[BadVPN] Detenido');
}

function isRunning() {
  if (!isRoot) return false;
  try {
    // Check for badvpn-udpgw specifically
    const result = execSync('pgrep -f badvpn-udpgw', { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch (e) {
    // Fallback: check if any process matches
    try {
      const ps = execSync('ps aux | grep -v grep | grep badvpn-udpgw', { encoding: 'utf8' });
      return ps.trim().length > 0;
    } catch (e2) {
      return false;
    }
  }
}

module.exports = { start, stop, isRunning };
