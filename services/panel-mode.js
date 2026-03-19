const config = require('../config');

const MODE_FULL = 'full';
const MODE_CLIENT_LITE = 'client_lite';

function getMode() {
  return config.PANEL_MODE === MODE_CLIENT_LITE ? MODE_CLIENT_LITE : MODE_FULL;
}

function isClientLite() {
  return getMode() === MODE_CLIENT_LITE;
}

function getAllowedPages() {
  if (isClientLite()) {
    return ['users', 'services'];
  }
  return ['dashboard', 'users', 'demos', 'resellers', 'services', 'logs', 'settings'];
}

function isPageAllowed(page) {
  return getAllowedPages().includes(String(page || ''));
}

function featureFlags() {
  const lite = isClientLite();
  return {
    canManageUsers: true,
    canManageServices: true,
    canViewDashboard: !lite,
    canManageDemos: !lite,
    canManageResellers: !lite,
    canViewLogs: !lite,
    canManageAdvancedSettings: !lite
  };
}

module.exports = {
  MODE_FULL,
  MODE_CLIENT_LITE,
  getMode,
  isClientLite,
  getAllowedPages,
  isPageAllowed,
  featureFlags
};
