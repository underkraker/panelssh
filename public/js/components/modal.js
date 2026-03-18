// Modal Component
const Modal = {
  show(title, bodyHtml, footerHtml = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-overlay').style.display = 'flex';
  },

  hide() {
    document.getElementById('modal-overlay').style.display = 'none';
  },

  confirm(title, message, onConfirm) {
    this.show(title, `<p style="color:var(--text-secondary)">${message}</p>`, `
      <button class="btn btn-outline" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-danger" id="modal-confirm-btn">Confirmar</button>
    `);
    document.getElementById('modal-confirm-btn').onclick = () => {
      Modal.hide();
      onConfirm();
    };
  }
};

// Events
document.getElementById('modal-close').addEventListener('click', Modal.hide);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) Modal.hide();
});
