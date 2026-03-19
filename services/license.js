const config = require('../config');

async function validateLicense() {
  if (!config.LICENSE_ENFORCE) {
    return { valid: true, reason: 'disabled' };
  }

  if (!config.LICENSE_KEY) {
    return { valid: false, reason: 'missing_key' };
  }

  if (!config.LICENSE_API_URL) {
    return { valid: false, reason: 'missing_api' };
  }

  if (typeof fetch !== 'function') {
    return { valid: false, reason: 'fetch_unavailable' };
  }

  try {
    const response = await fetch(config.LICENSE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: config.LICENSE_KEY,
        product: 'la-casita-panel',
        mode: config.PANEL_MODE,
        hostname: process.env.HOSTNAME || ''
      })
    });

    if (!response.ok) {
      return { valid: false, reason: `api_status_${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    if (!data || data.valid !== true) {
      return { valid: false, reason: data.reason || 'invalid' };
    }

    return { valid: true, reason: 'ok', data };
  } catch (err) {
    return { valid: false, reason: err.message || 'network_error' };
  }
}

module.exports = { validateLicense };
