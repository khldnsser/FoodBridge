const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { db, parseListing, parseUser } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ── RATINGS ──────────────────────────────────────────────────────────────────

// POST /api/ratings
router.post('/ratings', authMiddleware, (req, res) => {
  const { claim_id, stars, review } = req.body;
  if (!claim_id || !stars) return res.status(400).json({ error: 'claim_id and stars required' });
  if (stars < 1 || stars > 5) return res.status(400).json({ error: 'Stars must be 1–5' });

  const claim = db.prepare("SELECT * FROM claims WHERE id = ? AND status = 'completed'").get(claim_id);
  if (!claim) return res.status(404).json({ error: 'Completed claim not found' });

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(claim.listing_id);
  const isLister = listing?.user_id === req.user.id;
  const isClaimer = claim.claimer_id === req.user.id;
  if (!isLister && !isClaimer) return res.status(403).json({ error: 'Not a party to this claim' });

  if (isLister && claim.rated_by_lister) return res.status(400).json({ error: 'Already rated' });
  if (isClaimer && claim.rated_by_claimer) return res.status(400).json({ error: 'Already rated' });

  const ratee_id = isLister ? claim.claimer_id : listing.user_id;

  db.prepare('INSERT INTO ratings (id, claim_id, rater_id, ratee_id, stars, review) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuid(), claim_id, req.user.id, ratee_id, parseInt(stars), review || ''
  );

  if (isLister) db.prepare('UPDATE claims SET rated_by_lister = 1 WHERE id = ?').run(claim_id);
  if (isClaimer) db.prepare('UPDATE claims SET rated_by_claimer = 1 WHERE id = ?').run(claim_id);

  // Recalculate ratee avg
  const stats = db.prepare('SELECT AVG(stars) as avg, COUNT(*) as cnt FROM ratings WHERE ratee_id = ?').get(ratee_id);
  db.prepare('UPDATE users SET avg_rating = ?, rating_count = ? WHERE id = ?').run(
    Math.round(stats.avg * 10) / 10, stats.cnt, ratee_id
  );

  res.json({ message: 'Rating submitted' });
});

// GET /api/ratings/user/:userId
router.get('/ratings/user/:userId', authMiddleware, (req, res) => {
  const ratings = db.prepare(`
    SELECT r.*, u.name as rater_name, u.photo as rater_photo
    FROM ratings r JOIN users u ON r.rater_id = u.id
    WHERE r.ratee_id = ? ORDER BY r.created_at DESC
  `).all(req.params.userId);
  res.json({ ratings });
});

// ── REPORTS ───────────────────────────────────────────────────────────────────

// POST /api/reports
router.post('/reports', authMiddleware, (req, res) => {
  const { listing_id, reported_user_id, category, description } = req.body;
  if (!category) return res.status(400).json({ error: 'Category required' });
  if (!listing_id && !reported_user_id) return res.status(400).json({ error: 'Must report a listing or user' });

  db.prepare('INSERT INTO reports (id, reporter_id, listing_id, reported_user_id, category, description) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuid(), req.user.id, listing_id || null, reported_user_id || null, category, description || ''
  );
  res.json({ message: 'Report submitted' });
});

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

// GET /api/notifications
router.get('/notifications', authMiddleware, (req, res) => {
  const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(req.user.id);
  const parsed = notifications.map(n => ({ ...n, data: JSON.parse(n.data || '{}') }));
  res.json({ notifications: parsed });
});

// PATCH /api/notifications/read-all
router.patch('/notifications/read-all', authMiddleware, (req, res) => {
  db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(req.user.id);
  res.json({ message: 'All notifications marked as read' });
});

// PATCH /api/notifications/:id/read
router.patch('/notifications/:id/read', authMiddleware, (req, res) => {
  db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────

// GET /api/admin/reports
router.get('/admin/reports', authMiddleware, adminMiddleware, (req, res) => {
  const reports = db.prepare(`
    SELECT r.*,
      u.name as reporter_name,
      l.title as listing_title, l.status as listing_status,
      ru.name as reported_user_name, ru.is_suspended as reported_user_suspended
    FROM reports r
    JOIN users u ON r.reporter_id = u.id
    LEFT JOIN listings l ON r.listing_id = l.id
    LEFT JOIN users ru ON r.reported_user_id = ru.id
    ORDER BY r.created_at DESC
  `).all();
  res.json({ reports });
});

// PATCH /api/admin/reports/:id
router.patch('/admin/reports/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { status, admin_note } = req.body;
  db.prepare('UPDATE reports SET status = ?, admin_note = ? WHERE id = ?').run(status || 'reviewed', admin_note || '', req.params.id);
  res.json({ message: 'Report updated' });
});

// DELETE /api/admin/listings/:id
router.delete('/admin/listings/:id', authMiddleware, adminMiddleware, (req, res) => {
  db.prepare("UPDATE listings SET status = 'removed' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Listing removed' });
});

// PATCH /api/admin/users/:id
router.patch('/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { action, note } = req.body;
  if (action === 'suspend') {
    db.prepare('UPDATE users SET is_suspended = 1 WHERE id = ?').run(req.params.id);
  } else if (action === 'unsuspend') {
    db.prepare('UPDATE users SET is_suspended = 0 WHERE id = ?').run(req.params.id);
  } else if (action === 'verify_id') {
    db.prepare("UPDATE users SET id_verified = 1, id_doc_status = 'approved' WHERE id = ?").run(req.params.id);
  } else if (action === 'reject_id') {
    db.prepare("UPDATE users SET id_doc_status = 'rejected' WHERE id = ?").run(req.params.id);
  } else if (action === 'warn') {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (user) {
      db.prepare('INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuid(), req.params.id, 'admin_warning', 'Account Warning',
        note || 'Your account has received a warning from the FoodBridge team.',
        JSON.stringify({})
      );
    }
  }
  res.json({ message: 'User updated' });
});

// GET /api/admin/users — list all users
router.get('/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, name, phone, role, phone_verified, id_verified, id_doc_status, avg_rating, rating_count, total_shared, total_claimed, is_suspended, is_admin, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users });
});

// GET /api/admin/listings — all listings
router.get('/admin/listings', authMiddleware, adminMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM listings ORDER BY created_at DESC').all();
  res.json({ listings: rows.map(parseListing) });
});

module.exports = router;
