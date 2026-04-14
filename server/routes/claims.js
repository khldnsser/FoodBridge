const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { db, parseListing } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// POST /api/claims — claim a listing
router.post('/', authMiddleware, (req, res) => {
  const { listing_id } = req.body;
  if (!listing_id) return res.status(400).json({ error: 'listing_id required' });

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listing_id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'active') return res.status(400).json({ error: 'Listing is not available' });
  if (listing.user_id === req.user.id) return res.status(400).json({ error: 'Cannot claim your own listing' });

  const existing = db.prepare("SELECT * FROM claims WHERE listing_id = ? AND claimer_id = ? AND status = 'active'").get(listing_id, req.user.id);
  if (existing) return res.status(400).json({ error: 'Already claimed' });

  const claimId = uuid();
  db.prepare('INSERT INTO claims (id, listing_id, claimer_id) VALUES (?, ?, ?)').run(claimId, listing_id, req.user.id);
  db.prepare("UPDATE listings SET status = 'reserved' WHERE id = ?").run(listing_id);

  // Notify lister
  const claimer = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
  db.prepare('INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuid(), listing.user_id, 'claim',
    'Someone claimed your listing!',
    `${claimer.name || 'A user'} claimed "${listing.title}"`,
    JSON.stringify({ claim_id: claimId, listing_id })
  );

  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId);
  req.app.get('io')?.to(`user:${listing.user_id}`).emit('notification', { type: 'claim', claim_id: claimId });

  res.json({ claim });
});

// GET /api/claims — get my claims (as claimer or lister)
router.get('/', authMiddleware, (req, res) => {
  const claims = db.prepare(`
    SELECT c.*, l.title, l.photos, l.expiry_date, l.status as listing_status,
           u.name as claimer_name, u.photo as claimer_photo,
           lu.name as lister_name, lu.photo as lister_photo
    FROM claims c
    JOIN listings l ON c.listing_id = l.id
    JOIN users u ON c.claimer_id = u.id
    JOIN users lu ON l.user_id = lu.id
    WHERE (c.claimer_id = ? OR l.user_id = ?) AND c.status = 'active'
    ORDER BY c.created_at DESC
  `).all(req.user.id, req.user.id);

  const enriched = claims.map(c => ({
    ...c,
    photos: JSON.parse(c.photos || '[]'),
    is_lister: db.prepare('SELECT user_id FROM listings WHERE id = ?').get(c.listing_id)?.user_id === req.user.id,
    other_user: db.prepare('SELECT user_id FROM listings WHERE id = ?').get(c.listing_id)?.user_id === req.user.id
      ? { name: c.claimer_name, photo: c.claimer_photo }
      : { name: c.lister_name, photo: c.lister_photo }
  }));

  res.json({ claims: enriched });
});

// DELETE /api/claims/:id — cancel a claim
router.delete('/:id', authMiddleware, (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Not found' });

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(claim.listing_id);
  const isParty = claim.claimer_id === req.user.id || listing?.user_id === req.user.id;
  if (!isParty) return res.status(403).json({ error: 'Forbidden' });

  db.prepare("UPDATE claims SET status = 'cancelled' WHERE id = ?").run(claim.id);
  db.prepare("UPDATE listings SET status = 'active' WHERE id = ?").run(claim.listing_id);

  // Notify the other party
  const otherId = claim.claimer_id === req.user.id ? listing.user_id : claim.claimer_id;
  const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
  db.prepare('INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)').run(
    uuid(), otherId, 'cancel',
    'Claim cancelled',
    `${actor.name || 'A user'} cancelled the claim on "${listing.title}"`,
    JSON.stringify({ listing_id: claim.listing_id })
  );

  req.app.get('io')?.to(`user:${otherId}`).emit('notification', { type: 'cancel' });
  res.json({ message: 'Claim cancelled' });
});

// POST /api/claims/:id/confirm — confirm pickup
router.post('/:id/confirm', authMiddleware, (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Not found' });
  if (claim.status !== 'active') return res.status(400).json({ error: 'Claim not active' });

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(claim.listing_id);
  const isLister = listing?.user_id === req.user.id;
  const isClaimer = claim.claimer_id === req.user.id;
  if (!isLister && !isClaimer) return res.status(403).json({ error: 'Forbidden' });

  if (isLister) db.prepare('UPDATE claims SET pickup_confirmed_lister = 1 WHERE id = ?').run(claim.id);
  if (isClaimer) db.prepare('UPDATE claims SET pickup_confirmed_claimer = 1 WHERE id = ?').run(claim.id);

  const updated = db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id);

  if (updated.pickup_confirmed_lister && updated.pickup_confirmed_claimer) {
    // Both confirmed — complete the exchange
    db.prepare("UPDATE claims SET status = 'completed' WHERE id = ?").run(claim.id);
    db.prepare("UPDATE listings SET status = 'claimed' WHERE id = ?").run(claim.listing_id);
    db.prepare('UPDATE users SET total_shared = total_shared + 1 WHERE id = ?').run(listing.user_id);
    db.prepare('UPDATE users SET total_claimed = total_claimed + 1 WHERE id = ?').run(claim.claimer_id);

    // Notify both to rate
    for (const uid of [listing.user_id, claim.claimer_id]) {
      db.prepare('INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuid(), uid, 'rate',
        'How did the exchange go?',
        `Rate your experience with "${listing.title}"`,
        JSON.stringify({ claim_id: claim.id })
      );
    }

    req.app.get('io')?.to(`claim:${claim.id}`).emit('pickup_complete', { claim_id: claim.id });
    return res.json({ completed: true, claim: updated });
  }

  req.app.get('io')?.to(`claim:${claim.id}`).emit('pickup_confirmed', { by: isLister ? 'lister' : 'claimer' });
  res.json({ completed: false, claim: updated });
});

// GET /api/claims/:id — single claim detail
router.get('/:id', authMiddleware, (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Not found' });
  const listing = parseListing(db.prepare('SELECT * FROM listings WHERE id = ?').get(claim.listing_id));
  const claimer = db.prepare('SELECT id, name, photo, phone_verified, id_verified, avg_rating FROM users WHERE id = ?').get(claim.claimer_id);
  const lister = db.prepare('SELECT id, name, photo, phone_verified, id_verified, avg_rating FROM users WHERE id = ?').get(listing?.user_id);
  res.json({ claim, listing: listing ? { ...listing, user: lister } : null, claimer });
});

module.exports = router;
