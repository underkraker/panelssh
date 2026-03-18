const { execSync } = require('child_process');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const isRoot = process.getuid && process.getuid() === 0;

function exec(cmd) {
  if (!isRoot) {
    console.log(`[V2Ray] (simulado) ${cmd}`);
    return '';
  }
  return execSync(cmd, { encoding: 'utf8', timeout: 15000 });
}

function generateConfig(port) {
  const vmessId = uuidv4();
  
  return JSON.stringify({
    log: { loglevel: "warning" },
    inbounds: [
      {
        port: port,
        protocol: "vmess",
        settings: {
          clients: [
            { id: vmessId, alterId: 0 }
          ]
        },
        streamSettings: {
          network: "ws",
          wsSettings: { path: "/vmess" }
        }
      },
      {
        port: port + 1,
        protocol: "vless",
        settings: {
          clients: [
            { id: vmessId, level: 0 }
          ],
          decryption: "none"
        },
        streamSettings: {
          network: "ws",
          wsSettings: { path: "/vless" }
        }
      }
    ],
    outbounds: [
      { protocol: "freedom", settings: {} },
      { protocol: "blackhole", settings: {}, tag: "blocked" }
    ]
  }, null, 2);
}

function start(port) {
  if (isRoot) {
    const configContent = generateConfig(port);
    const configPath = '/etc/v2ray/config.json';
    
    // Create dir if needed
    try { fs.mkdirSync('/etc/v2ray', { recursive: true }); } catch (e) {}
    fs.writeFileSync(configPath, configContent);
    
    // Try xray first, then v2ray
    try {
      exec('systemctl restart xray');
    } catch (e) {
      try {
        exec('systemctl restart v2ray');
      } catch (e2) {
        console.error('[V2Ray] No se pudo iniciar xray ni v2ray');
        throw e2;
      }
    }
  }
  console.log(`[V2Ray] Iniciado VMess/VLESS en puerto ${port}/${port + 1}`);
}

function stop() {
  try { exec('systemctl stop xray'); } catch (e) {}
  try { exec('systemctl stop v2ray'); } catch (e) {}
  console.log('[V2Ray] Detenido');
}

function isRunning() {
  try {
    const xray = execSync('systemctl is-active xray 2>/dev/null', { encoding: 'utf8' });
    if (xray.trim() === 'active') return true;
  } catch (e) {}
  try {
    const v2ray = execSync('systemctl is-active v2ray 2>/dev/null', { encoding: 'utf8' });
    return v2ray.trim() === 'active';
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
