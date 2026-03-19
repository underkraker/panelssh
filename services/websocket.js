const fs = require('fs');
const privileged = require('./privileged-exec');

let wsProcess = null;

const pythonScript = `
import socket
import threading
import sys
import os

# WebSocket Tunnel v2026 - Optimized for Stability
REMOTE_HOST = '127.0.0.1'
REMOTE_PORT = 22
BUFFER_SIZE = 8192

def pipe(src, dst):
    try:
        while True:
            data = src.recv(BUFFER_SIZE)
            if not data:
                break
            dst.sendall(data)
    except:
        pass
    finally:
        try: src.close()
        except: pass
        try: dst.close()
        except: pass

def handle_client(client_socket):
    try:
        # Establish connection to local SSH
        remote_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        remote_socket.connect((REMOTE_HOST, REMOTE_PORT))
        
        # Bi-directional pipe
        threading.Thread(target=pipe, args=(client_socket, remote_socket), daemon=True).start()
        threading.Thread(target=pipe, args=(remote_socket, client_socket), daemon=True).start()
    except Exception as e:
        print(f"Error connecting to SSH: {e}")
        client_socket.close()

def start_server(port):
    try:
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(('0.0.0.0', port))
        server.listen(500)
        print(f"WebSocket tunnel active on port {port}")
    except Exception as e:
        print(f"Failed to start server: {e}")
        sys.exit(1)
    
    while True:
        try:
            client, addr = server.accept()
            # Initial handshake for WebSocket bypass
            data = client.recv(BUFFER_SIZE).decode('utf-8', errors='ignore')
            if 'HTTP/' in data and 'Upgrade: websocket' in data:
                response = "HTTP/1.1 101 Switching Protocols\\r\\n"
                response += "Upgrade: websocket\\r\\n"
                response += "Connection: Upgrade\\r\\n\\r\\n"
                client.sendall(response.encode())
            
            handle_client(client)
        except Exception as e:
            print(f"Client handling error: {e}")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8880
    # Run as a daemon-like process
    try:
        start_server(port)
    except KeyboardInterrupt:
        sys.exit(0)
`;

function start(port) {
  const scriptPath = '/usr/local/bin/ws-tunnel.py';
  privileged.writeTextFile(scriptPath, pythonScript);
  
  // Kill existing
  privileged.run('pkill', ['-f', 'ws-tunnel.py'], { ignoreError: true });
  
  // Launch in background
  const pythonCmd = commandExists('python3') ? 'python3' : 'python';
  
  const cmd = privileged.isRoot ? pythonCmd : 'sudo';
  const args = privileged.isRoot ? [scriptPath, port.toString()] : ['-n', pythonCmd, scriptPath, port.toString()];

  const { spawn } = require('child_process');
  const child = spawn(cmd, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  wsProcess = child;
  
  console.log(`[WebSocket] Iniciado en puerto ${port}`);
}

function commandExists(cmd) {
  try {
    privileged.run('command', ['-v', cmd]);
    return true;
  } catch (e) {
    return false;
  }
}

function stop() {
  privileged.run('pkill', ['-f', 'ws-tunnel.py'], { ignoreError: true });
  if (wsProcess) {
    try { wsProcess.kill(); } catch (e) {}
    wsProcess = null;
  }
  console.log('[WebSocket] Detenido');
}

function isRunning() {
  try {
    const result = privileged.run('pgrep', ['-f', 'ws-tunnel.py'], { ignoreError: true });
    return result && result.trim().length > 0;
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
