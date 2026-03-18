// Dashboard Module
const DashboardModule = {
  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
      const data = await API.get('/api/dashboard');
      
      content.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon green"><i class="fas fa-users"></i></div>
            <div class="stat-value">${data.totalUsers}</div>
            <div class="stat-label">Total Usuarios</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue"><i class="fas fa-user-check"></i></div>
            <div class="stat-value">${data.activeUsers}</div>
            <div class="stat-label">Activos</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon orange"><i class="fas fa-user-clock"></i></div>
            <div class="stat-value">${data.expiredUsers}</div>
            <div class="stat-label">Expirados</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon red"><i class="fas fa-user-slash"></i></div>
            <div class="stat-value">${data.bannedUsers || 0}</div>
            <div class="stat-label">Baneados</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon accent"><i class="fas fa-clock"></i></div>
            <div class="stat-value">${data.activeDemos}</div>
            <div class="stat-label">Demos Activas</div>
          </div>
          ${App.user.role === 'admin' ? `
          <div class="stat-card">
            <div class="stat-icon blue"><i class="fas fa-store"></i></div>
            <div class="stat-value">${data.totalResellers}</div>
            <div class="stat-label">Resellers</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green"><i class="fas fa-server"></i></div>
            <div class="stat-value">${data.activeServices}</div>
            <div class="stat-label">Servicios Activos</div>
          </div>
          ` : `
          <div class="stat-card">
            <div class="stat-icon accent"><i class="fas fa-coins"></i></div>
            <div class="stat-value">${data.credits || 0}</div>
            <div class="stat-label">Créditos</div>
          </div>
          `}
        </div>

        <div class="dashboard-charts">
          <div class="card chart-card">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-chart-pie"></i> Estado de Usuarios</h3>
            </div>
            <div class="chart-container">
              <canvas id="userStatusChart"></canvas>
            </div>
          </div>
          
          <div class="card chart-card">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-chart-bar"></i> Distribución de Servicios</h3>
            </div>
            <div class="chart-container">
              <canvas id="servicesChart"></canvas>
            </div>
          </div>
        </div>

        ${data.recentLogs && data.recentLogs.length > 0 ? `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-scroll"></i> Actividad Reciente</h3>
          </div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Acción</th>
                  <th>Objetivo</th>
                  <th>Admin</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${data.recentLogs.map(log => `
                  <tr>
                    <td><span class="log-action"><i class="fas fa-circle" style="font-size:6px;color:var(--accent)"></i> ${Utils.escapeHtml(log.action)}</span></td>
                    <td>${Utils.escapeHtml(log.target || '—')}</td>
                    <td>${Utils.escapeHtml(log.admin_name || 'Sistema')}</td>
                    <td>${Utils.formatDateTime(log.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ` : ''}
      `;

      // Initialize Charts
      setTimeout(() => {
        const userCtx = document.getElementById('userStatusChart')?.getContext('2d');
        if (userCtx) {
          new Chart(userCtx, {
            type: 'doughnut',
            data: {
              labels: ['Activos', 'Expirados', 'Baneados'],
              datasets: [{
                data: [data.activeUsers, data.expiredUsers, data.bannedUsers || 0],
                backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 10
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10 } } }
            }
          });
        }

        const svcCtx = document.getElementById('servicesChart')?.getContext('2d');
        if (svcCtx && data.serviceStats) {
          new Chart(svcCtx, {
            type: 'bar',
            data: {
              labels: ['Activos', 'Inactivos'],
              datasets: [{
                label: 'Servicios',
                data: [data.serviceStats.active, data.serviceStats.inactive],
                backgroundColor: ['#6366f1', '#1e293b'],
                borderRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: { 
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
              },
              plugins: { legend: { display: false } }
            }
          });
        }
      }, 100);

    } catch (err) {
      content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error cargando dashboard: ${err.message}</p></div>`;
    }
  }
};
