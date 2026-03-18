// Resellers Module
const ResellersModule = {
  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
      const data = await API.get('/api/resellers');
      const resellers = data.resellers || [];

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <span style="color:var(--text-secondary)"><i class="fas fa-store"></i> ${resellers.length} reseller(s)</span>
          </div>
          <button class="btn btn-primary" onclick="ResellersModule.showCreateModal()">
            <i class="fas fa-user-plus"></i> Nuevo Reseller
          </button>
        </div>

        <div class="card">
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Reseller</th>
                  <th>Créditos</th>
                  <th>Usuarios</th>
                  <th>Subdominio</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${resellers.length === 0 ? `
                  <tr><td colspan="6"><div class="empty-state"><i class="fas fa-store"></i><p>No hay resellers</p></div></td></tr>
                ` : resellers.map(r => `
                  <tr>
                    <td><strong>${Utils.escapeHtml(r.username)}</strong></td>
                    <td><span class="badge badge-accent"><i class="fas fa-coins"></i> ${r.credits}</span></td>
                    <td>${r.user_count}</td>
                    <td>${r.subdomain ? Utils.escapeHtml(r.subdomain) : '—'}</td>
                    <td>${Utils.formatDate(r.created_at)}</td>
                    <td>
                      <div style="display:flex;gap:4px">
                        <button class="btn-icon" title="Editar créditos" onclick="ResellersModule.editCredits(${r.id}, '${Utils.escapeJsString(r.username)}', ${r.credits})"><i class="fas fa-coins"></i></button>
                        <button class="btn-icon" title="Editar" onclick="ResellersModule.showEditModal(${r.id})"><i class="fas fa-pen"></i></button>
                        <button class="btn-icon danger" title="Eliminar" onclick="ResellersModule.deleteReseller(${r.id}, '${Utils.escapeJsString(r.username)}')"><i class="fas fa-trash"></i></button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${err.message}</p></div>`;
    }
  },

  showCreateModal() {
    Modal.show('Nuevo Reseller', `
      <div class="form-group">
        <label>Nombre de Usuario</label>
        <input class="form-control" id="reseller-username" placeholder="reseller1" required />
      </div>
      <div class="form-group">
        <label>Contraseña</label>
        <input class="form-control" id="reseller-password" type="text" placeholder="contraseña" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Créditos</label>
          <input class="form-control" id="reseller-credits" type="number" min="0" value="10" />
        </div>
        <div class="form-group">
          <label>Subdominio (opcional)</label>
          <input class="form-control" id="reseller-subdomain" placeholder="sub.dominio.com" />
        </div>
      </div>
    `, `
      <button class="btn btn-outline" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" id="btn-create-reseller"><i class="fas fa-plus"></i> Crear</button>
    `);

    document.getElementById('btn-create-reseller').onclick = async () => {
      const username = document.getElementById('reseller-username').value.trim();
      const password = document.getElementById('reseller-password').value;
      const credits = parseInt(document.getElementById('reseller-credits').value) || 0;
      const subdomain = document.getElementById('reseller-subdomain').value.trim();

      if (!username || !password) return Toast.error('Complete los campos requeridos');

      try {
        await API.post('/api/resellers', { username, password, credits, subdomain: subdomain || undefined });
        Toast.success(`Reseller ${username} creado`);
        Modal.hide();
        this.render();
      } catch (err) {
        Toast.error(err.message);
      }
    };
  },

  editCredits(id, username, currentCredits) {
    Modal.show('Ajustar Créditos', `
      <p style="color:var(--text-secondary);margin-bottom:16px">Créditos para <strong>${username}</strong>:</p>
      <div class="form-group">
        <input class="form-control" id="edit-credits" type="number" min="0" value="${currentCredits}" />
      </div>
    `, `
      <button class="btn btn-outline" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-credits"><i class="fas fa-save"></i> Guardar</button>
    `);

    document.getElementById('btn-save-credits').onclick = async () => {
      const credits = parseInt(document.getElementById('edit-credits').value);
      try {
        await API.put(`/api/resellers/${id}/credits`, { credits });
        Toast.success('Créditos actualizados');
        Modal.hide();
        this.render();
      } catch (err) {
        Toast.error(err.message);
      }
    };
  },

  async showEditModal(id) {
    try {
      const data = await API.get('/api/resellers');
      const r = data.resellers.find(x => x.id === id);
      if (!r) return Toast.error('No encontrado');

      Modal.show('Editar Reseller', `
        <div class="form-group">
          <label>Usuario</label>
          <input class="form-control" value="${Utils.escapeHtml(r.username)}" disabled />
        </div>
        <div class="form-group">
          <label>Nueva Contraseña (vacío = no cambiar)</label>
          <input class="form-control" id="edit-reseller-pass" type="text" placeholder="nueva contraseña" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Créditos</label>
            <input class="form-control" id="edit-reseller-credits" type="number" min="0" value="${r.credits}" />
          </div>
          <div class="form-group">
            <label>Subdominio</label>
            <input class="form-control" id="edit-reseller-subdomain" value="${r.subdomain || ''}" />
          </div>
        </div>
      `, `
        <button class="btn btn-outline" onclick="Modal.hide()">Cancelar</button>
        <button class="btn btn-primary" id="btn-edit-reseller"><i class="fas fa-save"></i> Guardar</button>
      `);

      document.getElementById('btn-edit-reseller').onclick = async () => {
        const body = {};
        const pass = document.getElementById('edit-reseller-pass').value;
        const credits = parseInt(document.getElementById('edit-reseller-credits').value);
        const subdomain = document.getElementById('edit-reseller-subdomain').value.trim();
        if (pass) body.password = pass;
        if (!isNaN(credits)) body.credits = credits;
        body.subdomain = subdomain || null;

        try {
          await API.put(`/api/resellers/${id}`, body);
          Toast.success('Reseller actualizado');
          Modal.hide();
          this.render();
        } catch (err) {
          Toast.error(err.message);
        }
      };
    } catch (err) {
      Toast.error(err.message);
    }
  },

  deleteReseller(id, username) {
    Modal.confirm(
      'Eliminar Reseller',
      `¿Eliminar a <strong>${username}</strong> y todos sus usuarios?`,
      async () => {
        try {
          await API.delete(`/api/resellers/${id}`);
          Toast.success('Reseller eliminado');
          this.render();
        } catch (err) {
          Toast.error(err.message);
        }
      }
    );
  }
};
