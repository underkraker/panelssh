const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const systemUsers = require('../services/system-users');

const router = express.Router();

// GET /api/demos — list active demos
router.get('/', requireAuth, (req, res) => {
  const demos = db.prepare(`
    SELECT *, 
      ROUND((julianday(expires_at) - julianday('now')) * 24 * 60, 1) as minutes_left
    FROM demos 
    WHERE status = 'active' 
    ORDER BY created_at DESC
  `).all();
  
  res.json({ demos });
});

// POST /api/demos — create demo
router.post('/', requireAuth, (req, res) => {
  const { duration } = req.body; // in minutes: 30, 60, 120
  const validDurations = [30, 60, 120];
  const durationMin = validDurations.includes(parseInt(duration)) ? parseInt(duration) : 30;
  
  // Generate random username
  const randomId = Math.floor(1000 + Math.random() * 9000);
  const username = `demo_${randomId}`;
  const password = `demo${randomId}`;
  
  // Calculate expiry
  const expiresAt = new Date(Date.now() + durationMin * 60000).toISOString();
  const expiryDate = expiresAt.split('T')[0];
  
  try {
    // Create system user
    systemUsers.createSystemUser(username, password, expiryDate);
    
    // Insert in database
    db.prepare(
      'INSERT INTO demos (username, duration_minutes, expires_at) VALUES (?, ?, ?)'
    ).run(username, durationMin, expiresAt);
    
    // Log
    db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
      .run(req.session.user.id, 'demo_create', username, `Demo de ${durationMin} minutos`);
    
    res.json({ 
      success: true, 
      demo: { username, password, duration: durationMin, expires_at: expiresAt } 
    });
  } catch (err) {
    console.error('[Demos] Create error:', err.message);
    res.status(500).json({ error: 'Error al crear demo: ' + err.message });
  }
});

// DELETE /api/demos/:id — delete demo manually
router.delete('/:id', requireAuth, (req, res) => {
  const demo = db.prepare('SELECT * FROM demos WHERE id = ?').get(req.params.id);
  if (!demo) return res.status(404).json({ error: 'Demo no encontrada.' });
  
  try {
    systemUsers.deleteSystemUser(demo.username);
    db.prepare('DELETE FROM demos WHERE id = ?').run(req.params.id);
    
    db.prepare('INSERT INTO logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)')
      .run(req.session.user.id, 'demo_delete', demo.username, 'Demo eliminada manualmente');
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar demo: ' + err.message });
  }
});

module.exports = router;
