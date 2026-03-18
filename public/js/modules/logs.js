// Logs Module
const LogsModule = {
  currentPage: 1,

  async render(page = 1) {
    const content = document.getElementById('content');
    if (page === 1) content.innerHTML = '<div class="spinner"></div>';
    this.currentPage = page;

    try {
      const data = await API.get(`/api/logs?page=${page}&limit=30`);
      const logs = data.logs || [];
      const { pagination } = data;

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="search-box">
              <i class="fas fa-search"></i>
              <input type="text" id="log-search" placeholder="Buscar en logs..." />
            </div>
          </div>
          <span style="color:var(--text-secondary);font-size:0.82rem">${pagination.total} registros</span>
        </div>

        <div class="card">
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Objetivo</th>
                  <th>Detalles</th>
                  <th>Admin</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody id="logs-body">
                ${logs.length === 0 ? `
                  <tr><td colspan="6"><div class="empty-state"><i class="fas fa-scroll"></i><p>No hay logs</p></div></td></tr>
                ` : logs.map(l => `
                  <tr>
                    <td style="font-size:0.78rem;color:var(--text-secondary)">${Utils.formatDateTime(l.created_at)}</td>
                    <td>${this.actionBadge(l.action)}</td>
                    <td><strong>${Utils.escapeHtml(l.target || '—')}</strong></td>
                    <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis" title="${Utils.escapeHtml(l.details || '')}">${Utils.escapeHtml(l.details || '—')}</td>
                    <td>${Utils.escapeHtml(l.admin_name || 'Sistema')}</td>
                    <td style="font-size:0.78rem;color:var(--text-muted)">${l.ip_address || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          ${pagination.pages > 1 ? `
          <div class="pagination">
            <button ${page <= 1 ? 'disabled' : ''} onclick="LogsModule.render(${page - 1})">
              <i class="fas fa-chevron-left"></i>
            </button>
            ${this.paginationButtons(pagination)}
            <button ${page >= pagination.pages ? 'disabled' : ''} onclick="LogsModule.render(${page + 1})">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
          ` : ''}
        </div>
      `;

      document.getElementById('log-search').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#logs-body tr').forEach(row => {
          row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${err.message}</p></div>`;
    }
  },

  actionBadge(action) {
    const colors = {
      login_success: 'green', login_failed: 'red', logout: 'blue',
      user_create: 'green', user_edit: 'blue', user_delete: 'red',
      user_ban: 'orange', user_unban: 'green', password_reset: 'blue',
      password_change: 'blue',
      demo_create: 'accent', demo_delete: 'red', demo_expire: 'orange',
      reseller_create: 'green', reseller_edit: 'blue', reseller_delete: 'red',
      credits_update: 'accent', service_toggle: 'blue', port_change: 'orange',
      auto_expire: 'orange'
    };
    const color = colors[action] || 'blue';
    return `<span class="badge badge-${color}">${action}</span>`;
  },

  paginationButtons(p) {
    let html = '';
    const start = Math.max(1, p.page - 2);
    const end = Math.min(p.pages, p.page + 2);
    for (let i = start; i <= end; i++) {
      html += `<button class="${i === p.page ? 'active' : ''}" onclick="LogsModule.render(${i})">${i}</button>`;
    }
    return html;
  }
};
