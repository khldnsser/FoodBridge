require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const ALLOWED_ORIGINS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const allowedOrigins = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS;

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow local network Vite URLs in development for phone testing.
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/192\.168\./.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'admin-api' });
});

app.get('/api/health/supabase', async (_req, res) => {
  const { error } = await adminSupabase
    .from('users')
    .select('id', { count: 'exact', head: true });

  if (error) {
    return res.status(503).json({ ok: false, service: 'supabase', error: error.message });
  }

  return res.json({ ok: true, service: 'supabase' });
});

// Verify Supabase JWT and check is_admin
async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const { data: profile } = await adminSupabase
    .from('users')
    .select('is_admin, is_suspended')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) return res.status(403).json({ error: 'Forbidden' });
  if (profile?.is_suspended) return res.status(403).json({ error: 'Account suspended' });

  req.userId = user.id;
  next();
}

// PATCH /api/admin/users/:id — suspend/unsuspend/verify_id/reject_id
app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  const updates = {
    suspend:   { is_suspended: true },
    unsuspend: { is_suspended: false },
    verify_id: { id_verified: true, id_doc_status: 'approved' },
    reject_id: { id_doc_status: 'rejected' },
  };

  if (!updates[action]) return res.status(400).json({ error: 'Unknown action' });

  const { error } = await adminSupabase.from('users').update(updates[action]).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n🌱 FoodBridge admin server on http://localhost:${PORT}`);
});
