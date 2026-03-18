// Topbar Component
const Topbar = {
  setTitle(title) {
    document.getElementById('page-title').textContent = title;
  },

  setConnectionStatus(online) {
    const el = document.getElementById('connection-status');
    const dot = el.querySelector('.status-dot');
    const text = el.querySelector('span:last-child');
    
    if (online) {
      dot.className = 'status-dot online';
      text.textContent = 'Conectado';
    } else {
      dot.className = 'status-dot offline';
      text.textContent = 'Desconectado';
    }
  }
};
