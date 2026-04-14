const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuid } = require('uuid');
const { db, parseListing } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const photoUpload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addUserInfo(listing) {
  if (!listing) return null;
  const user = db.prepare('SELECT id, name, photo, role, phone_verified, id_verified, avg_rating, rating_count FROM users WHERE id = ?').get(listing.user_id);
  return { ...listing, user };
}

// GET /api/listings
router.get('/', authMiddleware, (req, res) => {
  const { lat, lng, radius = 10, categories, dietary, search } = req.query;
  let rows = db.prepare("SELECT * FROM listings WHERE status = 'active' ORDER BY created_at DESC").all();
  let listings = rows.map(parseListing).map(addUserInfo);

  // Distance filter
  if (lat && lng) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const r = parseFloat(radius);
    listings = listings.map(l => ({
      ...l,
      distance: l.pickup_lat && l.pickup_lng ? haversine(userLat, userLng, l.pickup_lat, l.pickup_lng) : null
    })).filter(l => l.distance === null || l.distance <= r)
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  }

  // Category filter
  if (categories) {
    const cats = categories.split(',');
    listings = listings.filter(l => l.categories.some(c => cats.includes(c)));
  }

  // Dietary filter
  if (dietary) {
    const diets = dietary.split(',');
    listings = listings.filter(l => diets.every(d => l.dietary_tags.includes(d)));
  }

  // Keyword search
  if (search) {
    const q = search.toLowerCase();
    listings = listings.filter(l =>
      l.title.toLowerCase().includes(q) ||
      (l.description || '').toLowerCase().includes(q) ||
      l.neighborhood.toLowerCase().includes(q)
    );
  }

  res.json({ listings });
});

// GET /api/listings/:id
router.get('/:id', authMiddleware, (req, res) => {
  const listing = parseListing(db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id));
  if (!listing) return res.status(404).json({ error: 'Not found' });
  res.json({ listing: addUserInfo(listing) });
});

// POST /api/listings
router.post('/', authMiddleware, photoUpload.array('photos', 5), (req, res) => {
  const { title, description, expiry_date, categories, storage_condition, pickup_address, pickup_lat, pickup_lng, neighborhood, dietary_tags } = req.body;

  if (!title || !expiry_date || !storage_condition || !pickup_address) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'At least one photo is required' });
  }
  if (new Date(expiry_date) <= new Date()) {
    return res.status(400).json({ error: 'Expiry date must be in the future' });
  }

  const photos = req.files.map(f => `/uploads/${f.filename}`);
  const id = uuid();

  db.prepare(`
    INSERT INTO listings (id, user_id, title, description, photos, expiry_date, categories, storage_condition, pickup_address, pickup_lat, pickup_lng, neighborhood, dietary_tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.user.id, title, description || '', JSON.stringify(photos),
    expiry_date, categories || '[]', storage_condition,
    pickup_address, pickup_lat ? parseFloat(pickup_lat) : null,
    pickup_lng ? parseFloat(pickup_lng) : null,
    neighborhood || '', dietary_tags || '[]'
  );

  // Notify nearby users (basic: notify all active users)
  const notifyUsers = db.prepare(`SELECT id, dietary_prefs FROM users WHERE id != ? AND phone_verified = 1 AND is_suspended = 0`).all(req.user.id);
  const listing = parseListing(db.prepare('SELECT * FROM listings WHERE id = ?').get(id));
  const addedDiets = JSON.parse(dietary_tags || '[]');

  for (const u of notifyUsers) {
    const prefs = JSON.parse(u.dietary_prefs || '[]');
    const match = prefs.length === 0 || addedDiets.length === 0 || prefs.some(p => addedDiets.includes(p));
    if (match) {
      db.prepare('INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuid(), u.id, 'new_listing',
        'New item near you',
        `${title} — expires ${new Date(expiry_date).toLocaleDateString()}`,
        JSON.stringify({ listing_id: id })
      );
    }
  }

  res.json({ listing: addUserInfo(listing) });
});

// DELETE /api/listings/:id (lister removes own listing)
router.delete('/:id', authMiddleware, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Not found' });
  if (listing.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });

  db.prepare("UPDATE listings SET status = 'removed' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Listing removed' });
});

// GET /api/listings/user/mine
router.get('/user/mine', authMiddleware, (req, res) => {
  const rows = db.prepare("SELECT * FROM listings WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json({ listings: rows.map(parseListing).map(addUserInfo) });
});

module.exports = router;
