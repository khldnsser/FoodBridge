const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const multer = require('multer');
const path = require('path');
const { db, parseUser } = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const idUpload = multer({ dest: path.join(__dirname, '../uploads/') });

// Request OTP (register or login)
router.post('/request-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  db.prepare('INSERT OR REPLACE INTO otps (phone, code, expires_at) VALUES (?, ?, ?)').run(phone, code, expires);

  // In production: send SMS. For demo, return code in response.
  console.log(`[OTP] Phone: ${phone} → Code: ${code}`);
  res.json({ message: 'OTP sent', demo_otp: code });
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });

  const otp = db.prepare('SELECT * FROM otps WHERE phone = ?').get(phone);
  if (!otp || otp.code !== code) return res.status(400).json({ error: 'Invalid OTP' });
  if (new Date(otp.expires_at) < new Date()) return res.status(400).json({ error: 'OTP expired' });

  db.prepare('DELETE FROM otps WHERE phone = ?').run(phone);

  // Create user if doesn't exist
  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    const id = uuid();
    const isFirst = db.prepare('SELECT COUNT(*) as c FROM users').get().c === 0;
    db.prepare('INSERT INTO users (id, phone, phone_verified, is_admin) VALUES (?, ?, 1, ?)').run(id, phone, isFirst ? 1 : 0);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } else {
    db.prepare('UPDATE users SET phone_verified = 1 WHERE id = ?').run(user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: parseUser(user) });
});

// Complete profile
router.post('/complete-profile', authMiddleware, (req, res) => {
  const { name, neighborhood, role, dietary_prefs } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  db.prepare(`
    UPDATE users SET name = ?, neighborhood = ?, role = ?, dietary_prefs = ?, profile_complete = 1
    WHERE id = ?
  `).run(name, neighborhood || '', role || 'individual', JSON.stringify(dietary_prefs || []), req.user.id);

  const user = parseUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));
  res.json({ user });
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  const user = parseUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));
  res.json({ user });
});

// Upload ID for verification
router.post('/upload-id', authMiddleware, idUpload.single('doc'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const docPath = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET id_doc = ?, id_doc_status = ? WHERE id = ?').run(docPath, 'pending', req.user.id);
  res.json({ message: 'ID document submitted for review' });
});

// Update profile photo
router.post('/upload-photo', authMiddleware, idUpload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const photoPath = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET photo = ? WHERE id = ?').run(photoPath, req.user.id);
  const user = parseUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));
  res.json({ user });
});

// Get public user profile
router.get('/users/:id', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, photo, neighborhood, role, phone_verified, id_verified, avg_rating, rating_count, total_shared, total_claimed, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;
