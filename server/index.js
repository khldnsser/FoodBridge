const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const { db } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');
const { v4: uuid } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:5173', credentials: true }
});

app.set('io', io);
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/claims', require('./routes/claims'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api', require('./routes/misc'));

// Socket.io — real-time chat + notifications
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  console.log(`[WS] User ${socket.userId} connected`);

  socket.on('join-claim', (claimId) => {
    socket.join(`claim:${claimId}`);
  });

  socket.on('leave-claim', (claimId) => {
    socket.leave(`claim:${claimId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[WS] User ${socket.userId} disconnected`);
  });
});

// Cron: auto-delist expired items every hour
cron.schedule('0 * * * *', () => {
  const now = new Date().toISOString().split('T')[0];
  const expired = db.prepare("SELECT * FROM listings WHERE status = 'active' AND expiry_date < ?").all(now);

  for (const listing of expired) {
    db.prepare("UPDATE listings SET status = 'expired' WHERE id = ?").run(listing.id);
    db.prepare('INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)').run(
      uuid(), listing.user_id, 'expired',
      'Listing expired',
      `Your listing "${listing.title}" has been removed — the item has passed its expiry date.`,
      JSON.stringify({ listing_id: listing.id })
    );
    console.log(`[CRON] Expired listing: ${listing.id} — ${listing.title}`);
  }
});

// Also run expiry check on startup
const expiredOnStart = db.prepare("SELECT * FROM listings WHERE status = 'active' AND expiry_date < ?").all(new Date().toISOString().split('T')[0]);
for (const listing of expiredOnStart) {
  db.prepare("UPDATE listings SET status = 'expired' WHERE id = ?").run(listing.id);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🌱 FoodBridge server running on http://localhost:${PORT}`);
  console.log(`   Admin: register first — first account gets admin access\n`);
});
