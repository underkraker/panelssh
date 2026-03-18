// Sidebar Component
const Sidebar = {
  init() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    
    // Desktop toggle
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    });
    
    // Restore state
    if (localStorage.getItem('sidebar-collapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }
    
    // Mobile toggle
    document.getElementById('mobile-menu-toggle').addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
    
    // Close on mobile nav click
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('mobile-open');
        }
      });
    });
    
    // Close on outside click (mobile)
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && 
          !sidebar.contains(e.target) && 
          e.target !== document.getElementById('mobile-menu-toggle') &&
          !document.getElementById('mobile-menu-toggle').contains(e.target)) {
        sidebar.classList.remove('mobile-open');
      }
    });
  },

  setActiveItem(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
  },

  hideAdminItems() {
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = 'none';
    });
  },

  showAllItems() {
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = '';
    });
  }
};
