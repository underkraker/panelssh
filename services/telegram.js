const config = require('../config');

// We use native fetch to avoid extra dependencies if possible, 
// or simple https module. Node 18+ has fetch.
async function sendMessage(text) {
  const token = config.TELEGRAM_BOT_TOKEN;
  const chatId = config.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) return;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      console.error('[Telegram] Error sending message:', await response.text());
    }
  } catch (err) {
    console.error('[Telegram] Fetch error:', err.message);
  }
}

// Example usage:
// telegram.sendAlert('⚠️ <b>Alerta de Sistema</b>\nNuevo usuario creado: kraker');

module.exports = { sendMessage };
