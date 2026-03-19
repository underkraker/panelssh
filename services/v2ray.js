const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const privileged = require('./privileged-exec');
const db = require('../database/db');

function getVmessId() {
  let setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('v2ray_vmess_id');
  if (!setting) {
    const newId = uuidv4();
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('v2ray_vmess_id', newId);
    return newId;
  }
  return setting.value;
}

function generateConfig(port) {
  const vmessId = getVmessId();
  
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
  const configContent = generateConfig(port);
  const configPathXray = '/usr/local/etc/xray/config.json';
  const configPathV2ray = '/etc/v2ray/config.json';
  
  // Ensure directories exist
  privileged.run('mkdir', ['-p', '/usr/local/etc/xray']);
  privileged.run('mkdir', ['-p', '/etc/v2ray']);
  
  // Write to both just in case
  privileged.writeTextFile(configPathXray, configContent);
  privileged.writeTextFile(configPathV2ray, configContent);
  
  // Try xray first (most common now), then v2ray
  try {
    privileged.run('systemctl', ['restart', 'xray']);
    console.log(`[V2Ray] Xray reiniciado en puerto ${port}/${port + 1}`);
  } catch (e) {
    try {
      privileged.run('systemctl', ['restart', 'v2ray']);
      console.log(`[V2Ray] V2Ray reiniciado en puerto ${port}/${port + 1}`);
    } catch (e2) {
      console.error('[V2Ray] No se pudo iniciar xray ni v2ray via systemctl. Intentando pkill/spawn...');
      // Fallback: kill any existing and no-op (let watchdog or manual restart handle it if systemd is broken)
      privileged.run('pkill', ['-x', 'xray'], { ignoreError: true });
      privileged.run('pkill', ['-x', 'v2ray'], { ignoreError: true });
    }
  }
}

function stop() {
  privileged.run('systemctl', ['stop', 'xray'], { ignoreError: true });
  privileged.run('systemctl', ['stop', 'v2ray'], { ignoreError: true });
  console.log('[V2Ray] Detenido');
}

function isRunning() {
  try {
    const xray = privileged.run('systemctl', ['is-active', 'xray'], { ignoreError: true });
    if (xray.trim() === 'active') return true;
  } catch (e) {}
  
  try {
    const v2ray = privileged.run('systemctl', ['is-active', 'v2ray'], { ignoreError: true });
    if (v2ray.trim() === 'active') return true;
  } catch (e) {}

  // Fallback: pgrep
  try {
    const pgrep = privileged.run('pgrep', ['-x', 'xray'], { ignoreError: true }) || 
                  privileged.run('pgrep', ['-x', 'v2ray'], { ignoreError: true });
    return pgrep && pgrep.trim().length > 0;
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
