const express = require('express');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/logs — paginated logs
router.get('/', requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  
  let whereClause = '';
  let params = [];
  
  if (search) {
    whereClause = 'WHERE l.action LIKE ? OR l.target LIKE ? OR l.details LIKE ?';
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }
  
  const totalRow = db.prepare(`SELECT COUNT(*) as total FROM logs l ${whereClause}`).get(...params);
  const total = totalRow.total;
  
  const logs = db.prepare(`
    SELECT l.*, a.username as admin_name 
    FROM logs l 
    LEFT JOIN admins a ON l.admin_id = a.id 
    ${whereClause}
    ORDER BY l.created_at DESC 
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  
  res.json({ 
    logs, 
    pagination: { page, limit, total, pages: Math.ceil(total / limit) } 
  });
});

module.exports = router;
