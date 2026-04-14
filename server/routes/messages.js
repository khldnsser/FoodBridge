const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/messages/:claimId
router.get('/:claimId', authMiddleware, (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.claimId);
  if (!claim) return res.status(404).json({ error: 'Not found' });

  const listing = db.prepare('SELECT user_id FROM listings WHERE id = ?').get(claim.listing_id);
  const isParty = claim.claimer_id === req.user.id || listing?.user_id === req.user.id;
  if (!isParty) return res.status(403).json({ error: 'Forbidden' });

  const messages = db.prepare(`
    SELECT m.*, u.name as sender_name, u.photo as sender_photo
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.claim_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.claimId);

  res.json({ messages });
});

// POST /api/messages/:claimId
router.post('/:claimId', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.claimId);
  if (!claim) return res.status(404).json({ error: 'Not found' });

  const listing = db.prepare('SELECT user_id FROM listings WHERE id = ?').get(claim.listing_id);
  const isParty = claim.claimer_id === req.user.id || listing?.user_id === req.user.id;
  if (!isParty) return res.status(403).json({ error: 'Forbidden' });

  const id = uuid();
  db.prepare('INSERT INTO messages (id, claim_id, sender_id, content) VALUES (?, ?, ?, ?)').run(
    id, req.params.claimId, req.user.id, content.trim()
  );

  const message = db.prepare(`
    SELECT m.*, u.name as sender_name, u.photo as sender_photo
    FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?
  `).get(id);

  req.app.get('io')?.to(`claim:${req.params.claimId}`).emit('message', message);

  // Notify the other party
  const otherId = claim.claimer_id === req.user.id ? listing?.user_id : claim.claimer_id;
  if (otherId) {
    const sender = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    db.prepare('INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)').run(
      uuid(), otherId, 'message',
      `Message from ${sender?.name || 'someone'}`,
      content.trim().length > 60 ? content.trim().slice(0, 60) + '…' : content.trim(),
      JSON.stringify({ claim_id: req.params.claimId })
    );
    req.app.get('io')?.to(`user:${otherId}`).emit('notification', { type: 'message', claim_id: req.params.claimId });
  }

  res.json({ message });
});

module.exports = router;
