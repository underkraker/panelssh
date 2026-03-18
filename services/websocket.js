const { execSync, spawn } = require('child_process');
const fs = require('fs');

const isRoot = process.getuid && process.getuid() === 0;
let wsProcess = null;

function exec(cmd) {
  if (!isRoot) {
    console.log(`[WebSocket] (simulado) ${cmd}`);
    return '';
  }
  return execSync(cmd, { encoding: 'utf8', timeout: 10000 });
}

const pythonScript = `
import socket
import threading
import sys

def handle_client(client_socket, remote_host, remote_port):
    try:
        remote_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        remote_socket.connect((remote_host, remote_port))
        
        def forward(src, dst):
            try:
                while True:
                    data = src.recv(4096)
                    if not data:
                        break
                    dst.sendall(data)
            except:
                pass
            finally:
                src.close()
                dst.close()
        
        t1 = threading.Thread(target=forward, args=(client_socket, remote_socket))
        t2 = threading.Thread(target=forward, args=(remote_socket, client_socket))
        t1.daemon = True
        t2.daemon = True
        t1.start()
        t2.start()
    except Exception as e:
        print(f"Error: {e}")
        client_socket.close()

def start_server(port):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', port))
    server.listen(100)
    print(f"WebSocket tunnel listening on port {port}")
    
    while True:
        client, addr = server.accept()
        # Read initial HTTP header
        data = client.recv(4096).decode('utf-8', errors='ignore')
        if 'HTTP/' in data:
            response = "HTTP/1.1 101 Switching Protocols\\r\\n"
            response += "Upgrade: websocket\\r\\n"
            response += "Connection: Upgrade\\r\\n\\r\\n"
            client.sendall(response.encode())
        
        handler = threading.Thread(target=handle_client, args=(client, '127.0.0.1', 22))
        handler.daemon = True
        handler.start()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8880
    start_server(port)
`;

function start(port) {
  if (isRoot) {
    const scriptPath = '/usr/local/bin/ws-tunnel.py';
    fs.writeFileSync(scriptPath, pythonScript);
    
    // Kill existing
    try { exec('pkill -f ws-tunnel.py'); } catch (e) {}
    
    // Launch in background
    wsProcess = spawn('python3', [scriptPath, port.toString()], {
      detached: true,
      stdio: 'ignore'
    });
    wsProcess.unref();
  }
  console.log(`[WebSocket] Iniciado en puerto ${port}`);
}

function stop() {
  try { exec('pkill -f ws-tunnel.py'); } catch (e) {}
  if (wsProcess) {
    try { wsProcess.kill(); } catch (e) {}
    wsProcess = null;
  }
  console.log('[WebSocket] Detenido');
}

function isRunning() {
  try {
    const result = execSync('pgrep -f ws-tunnel.py 2>/dev/null', { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch (e) {
    return false;
  }
}

module.exports = { start, stop, isRunning };
