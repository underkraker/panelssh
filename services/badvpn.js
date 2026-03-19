const privileged = require('./privileged-exec');

let badvpnProcess = null;

function start(port = 7300) {
  // Kill existing
  stop();
  
  // Launch badvpn-udpgw
  const cmd = privileged.isRoot ? 'badvpn-udpgw' : 'sudo';
  const args = privileged.isRoot ? [
    '--listen-addr', `0.0.0.0:${port}`,
    '--max-clients', '1000',
    '--max-connections-for-client', '10'
  ] : [
    '-n', 'badvpn-udpgw',
    '--listen-addr', `0.0.0.0:${port}`,
    '--max-clients', '1000',
    '--max-connections-for-client', '10'
  ];

  const { spawn } = require('child_process');
  badvpnProcess = spawn(cmd, args, {
    detached: true,
    stdio: 'ignore'
  });
  badvpnProcess.unref();
  
  console.log(`[BadVPN] Iniciado en puerto ${port}`);
}

function stop() {
  privileged.run('pkill', ['-f', 'badvpn-udpgw'], { ignoreError: true });
  if (badvpnProcess) {
    try { badvpnProcess.kill(); } catch (e) {}
    badvpnProcess = null;
  }
  console.log('[BadVPN] Detenido');
}

function isRunning() {
  try {
    const result = privileged.run('pgrep', ['-f', 'badvpn-udpgw'], { ignoreError: true });
    return result && result.trim().length > 0;
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
