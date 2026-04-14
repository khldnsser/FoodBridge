const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'foodbridge.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    photo TEXT,
    neighborhood TEXT,
    role TEXT DEFAULT 'individual',
    dietary_prefs TEXT DEFAULT '[]',
    phone_verified INTEGER DEFAULT 0,
    id_verified INTEGER DEFAULT 0,
    id_doc TEXT,
    id_doc_status TEXT DEFAULT 'none',
    avg_rating REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    total_shared INTEGER DEFAULT 0,
    total_claimed INTEGER DEFAULT 0,
    is_suspended INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    profile_complete INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otps (
    phone TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    photos TEXT DEFAULT '[]',
    expiry_date TEXT NOT NULL,
    categories TEXT DEFAULT '[]',
    storage_condition TEXT NOT NULL,
    pickup_address TEXT NOT NULL,
    pickup_lat REAL,
    pickup_lng REAL,
    neighborhood TEXT DEFAULT '',
    dietary_tags TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    claimer_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    pickup_confirmed_lister INTEGER DEFAULT 0,
    pickup_confirmed_claimer INTEGER DEFAULT 0,
    rated_by_lister INTEGER DEFAULT 0,
    rated_by_claimer INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (listing_id) REFERENCES listings(id),
    FOREIGN KEY (claimer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (claim_id) REFERENCES claims(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    rater_id TEXT NOT NULL,
    ratee_id TEXT NOT NULL,
    stars INTEGER NOT NULL,
    review TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (claim_id) REFERENCES claims(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL,
    listing_id TEXT,
    reported_user_id TEXT,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    admin_note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Helper to parse JSON fields on a listing row
function parseListing(row) {
  if (!row) return null;
  return {
    ...row,
    photos: JSON.parse(row.photos || '[]'),
    categories: JSON.parse(row.categories || '[]'),
    dietary_tags: JSON.parse(row.dietary_tags || '[]'),
  };
}

function parseUser(row) {
  if (!row) return null;
  return {
    ...row,
    dietary_prefs: JSON.parse(row.dietary_prefs || '[]'),
  };
}

module.exports = { db, parseListing, parseUser };
