require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── helpers ──────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const future = (daysMin, daysMax) => {
  const d = new Date();
  d.setDate(d.getDate() + rand(daysMin, daysMax));
  return d.toISOString().split('T')[0];
};

async function uploadLocalPhoto(filePath, storagePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    await sb.storage.from('listing-photos').remove([storagePath]);
    const { error } = await sb.storage.from('listing-photos').upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });
    if (error) { console.error('Upload error:', error.message); return null; }
    const { data: { publicUrl } } = sb.storage.from('listing-photos').getPublicUrl(storagePath);
    return publicUrl;
  } catch (e) {
    console.error('uploadLocalPhoto error:', e.message);
    return null;
  }
}

// ─── data pools ───────────────────────────────────────────────────────────────
const NEIGHBORHOODS = ['Hamra', 'Gemmayzeh', 'Ashrafieh', 'Mar Mikhael', 'Verdun', 'Raouche', 'Achrafieh', 'Badaro', 'Sodeco', 'Dekwaneh'];

const LISTING_DATA = [
  // original_price = supermarket value; listing_price = 0 means free
  { title: 'Sealed Greek yoghurt (500g)', description: 'Unopened Fage yoghurt, bought too many. Still has 10 days until expiry. Great for breakfast or cooking.', categories: ['Dairy'], dietary_tags: ['Vegetarian'], storage_condition: 'refrigerated',
    photos: ['images/greek-yoghurt-tub.png'], original_price: 4.50, listing_price: 0 },
  { title: 'Canned chickpeas × 4', description: 'Surplus from a bulk buy. All sealed, best before 2026. Perfect for hummus or curries.', categories: ['Canned goods'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free'], storage_condition: 'room_temperature',
    photos: ['images/canned-chickpeas.png'], original_price: 6.00, listing_price: 0 },
  { title: 'Penne pasta 1kg (unopened)', description: 'De Cecco brand. Just moved and bought duplicates. High quality Italian pasta.', categories: ['Boxed meals & pasta'], dietary_tags: ['Vegetarian'], storage_condition: 'room_temperature',
    photos: ['images/penne-pasta-box.png'], original_price: 5.50, listing_price: 1.00 },
  { title: 'Brioche loaf (sealed)', description: 'Picked up by mistake — we don\'t eat white bread. Still fully sealed, best before in 4 days.', categories: ['Bread & bakery'], dietary_tags: ['Vegetarian'], storage_condition: 'room_temperature',
    photos: ['images/loaf.png'], original_price: 3.50, listing_price: 0 },
  { title: 'Almond milk 1L (unopened)', description: 'Oatly oat milk, bought wrong type. Refrigerated, unopened. Great for coffee or cereal.', categories: ['Beverages'], dietary_tags: ['Vegan', 'Gluten-free', 'Nut-free'], storage_condition: 'refrigerated',
    photos: ['images/almond-milk-carton.png'], original_price: 7.00, listing_price: 2.00 },
  { title: 'Frozen peas 500g', description: 'Birdseye, straight from freezer. Pick up quick! Must stay frozen during transport.', categories: ['Other'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free'], storage_condition: 'frozen',
    photos: ['images/frozen-peas-and-carrots-bag.png'], original_price: 3.00, listing_price: 0 },
  { title: 'Kellogg\'s cornflakes (large box)', description: 'Bought 2 by accident, giving away the extra. Unopened, 750g box. Expires in 3 months.', categories: ['Snacks'], dietary_tags: ['Vegetarian', 'Gluten-free'], storage_condition: 'room_temperature',
    photos: ['images/cornflakes-box.png'], original_price: 8.00, listing_price: 0 },
  { title: 'San Pellegrino × 6 cans', description: 'Sparkling water, flavoured citrus. All sealed. Mixed flavours — blood orange and lemon.', categories: ['Beverages'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'room_temperature',
    photos: [], original_price: 6.50, listing_price: 1.50 },
  { title: 'Labneh tub 400g', description: 'Original Kiri labneh, refrigerated, not opened. Great with zaatar and olive oil.', categories: ['Dairy'], dietary_tags: ['Vegetarian', 'Halal', 'Gluten-free'], storage_condition: 'refrigerated',
    photos: ['images/labneh.png'], original_price: 5.00, listing_price: 0 },
  { title: 'Canned tomatoes × 6', description: 'Mutti brand. Bought in bulk for a party that got cancelled. Perfect for sauces and soups.', categories: ['Canned goods'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'room_temperature',
    photos: ['images/canned-tomatoes.png'], original_price: 9.00, listing_price: 0 },
  { title: 'Organic granola 500g', description: 'Jordans Country Crisp, sealed, expires next month. Full of oats, nuts, and honey clusters.', categories: ['Snacks'], dietary_tags: ['Vegetarian'], storage_condition: 'room_temperature',
    photos: ['images/granola-bag.png'], original_price: 12.00, listing_price: 3.00 },
  { title: 'Hummus tub 200g (sealed)', description: 'Supermarket brand, refrigerated. Best before tomorrow — please pick up today if possible!', categories: ['Canned goods'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free'], storage_condition: 'refrigerated',
    photos: ['images/hummus-tub-sealed.png'], original_price: 3.50, listing_price: 0 },
  // restaurant extras
  { title: 'Surplus dinner rolls × 12', description: 'Freshly baked this morning, sealed in a bag. All halal. Soft inside with a golden crust.', categories: ['Bread & bakery'], dietary_tags: ['Halal', 'Vegetarian'], storage_condition: 'room_temperature',
    photos: [], original_price: 8.00, listing_price: 2.00 },
  { title: 'Prepped veggie wrap kits × 4', description: 'Sealed wrap + filling pouches, made for today\'s lunch service. Includes tortilla, roasted veg, and tahini.', categories: ['Other'], dietary_tags: ['Vegetarian', 'Vegan'], storage_condition: 'refrigerated',
    photos: [], original_price: 16.00, listing_price: 4.00 },
  { title: 'Bottled smoothies × 8 (unsold)', description: 'Today\'s batch, never opened, cold pressed mango-ginger. Made fresh this morning at the café.', categories: ['Beverages'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'refrigerated',
    photos: ['images/bottled-smoothie.png'], original_price: 24.00, listing_price: 5.00 },
  // new image listings
  { title: 'Sliced red peppers (sealed container)', description: 'Pre-sliced red peppers in a sealed plastic container. Perfect for stir-fry or salads. Refrigerated, picked up from Spinneys today.', categories: ['Other'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'refrigerated',
    photos: ['images/sliced-red-peppers.jpg'], original_price: 4.00, listing_price: 0 },
  { title: 'Cherry tomatoes 500g (red)', description: 'Juicy red cherry tomatoes, still on the vine. Bought too many for the week. Great for salads or roasting.', categories: ['Other'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'room_temperature',
    photos: ['images/cherry-tomatoes-red.jpg'], original_price: 3.50, listing_price: 0 },
  { title: 'Fresh produce box (mixed)', description: 'Assorted vegetables from this morning\'s market run — we over-ordered. All fresh, nothing pre-cut.', categories: ['Other'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'room_temperature',
    photos: ['images/fresh-produce-box.jpg'], original_price: 15.00, listing_price: 3.00 },
  { title: 'Yellow cherry tomatoes (sealed tub)', description: 'Sweet yellow cherry tomatoes in a sealed store container. Perfect for snacking or salads. Expires in 3 days.', categories: ['Other'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'refrigerated',
    photos: ['images/yellow-cherry-tomatoes.jpg'], original_price: 4.00, listing_price: 0 },
  // extra listings
  { title: 'Lentil soup (2 portions, sealed)', description: 'Home-cooked red lentil soup in airtight containers. Made this morning, no meat. Great reheated.', categories: ['Other'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'refrigerated',
    photos: [], original_price: 8.00, listing_price: 0 },
  { title: 'Basmati rice 2kg (unopened)', description: 'Extra bag from bulk buy. Sealed, long shelf life. Indian gate brand.', categories: ['Other'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'room_temperature',
    photos: [], original_price: 7.50, listing_price: 1.00 },
  { title: 'Mixed dried fruits 300g', description: 'Sealed bag of raisins, apricots, and cranberries. Healthy snack. Best before in 2 months.', categories: ['Snacks'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'room_temperature',
    photos: [], original_price: 6.00, listing_price: 0 },
  { title: 'Full-fat milk 2L (sealed)', description: 'Unopened pasteurised whole milk, best before in 5 days. Picked up two by accident.', categories: ['Dairy'], dietary_tags: ['Vegetarian', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'refrigerated',
    photos: [], original_price: 4.00, listing_price: 0 },
  { title: 'Protein bars × 6 (assorted)', description: 'Clif Bar assortment — chocolate chip, peanut butter, blueberry. All sealed. Bought for a trip that got cancelled.', categories: ['Snacks'], dietary_tags: ['Vegetarian'], storage_condition: 'room_temperature',
    photos: [], original_price: 14.00, listing_price: 3.00 },
  { title: 'Leftover mini croissants × 10', description: 'Sealed in a bakery bag from this morning. Buttery and flaky, made in-house. Please pick up today.', categories: ['Bread & bakery'], dietary_tags: ['Vegetarian'], storage_condition: 'room_temperature',
    photos: [], original_price: 10.00, listing_price: 2.00 },
  { title: 'Olive oil 750ml (sealed, extra virgin)', description: 'Unopened bottle of Lebanese EVOO. Bought as a gift but recipient doesn\'t cook. Best before 2027.', categories: ['Other'], dietary_tags: ['Vegan', 'Halal', 'Gluten-free', 'Nut-free'], storage_condition: 'room_temperature',
    photos: [], original_price: 18.00, listing_price: 5.00 },
  { title: 'Frozen falafel balls × 20', description: 'Supermarket brand, sealed bag. Just pop in the oven. Halal certified.', categories: ['Other'], dietary_tags: ['Vegan', 'Halal', 'Nut-free'], storage_condition: 'frozen',
    photos: [], original_price: 5.50, listing_price: 0 },
];

const MESSAGES = [
  ['Hi! Is this still available?', 'Yes it is! When can you pick up?', 'Tomorrow morning works — around 10am?', 'Perfect, I\'ll be here. See you then!'],
  ['Hello, I claimed your item. Where exactly should I come?', 'I\'m at the main entrance of the building. Ring the bell for apt 4.', 'Got it, I\'ll be there in 20 mins.', 'Great, I\'ll leave it at the door if I step out.'],
  ['Thanks for sharing! Any parking nearby?', 'Yes there\'s street parking on the side street. Easy to find.', 'Coming now, should be 15 mins.', 'Perfect, see you soon!'],
  ['Is the item still cold?', 'Just took it from the fridge, still very cold!', 'On my way now, ETA 10 minutes.', 'Confirmed pickup done, thanks so much!'],
];

const REVIEW_TEXTS = [
  'Super easy pickup, the item was exactly as described. Would claim again!',
  'Wonderful experience. The lister was very responsive and the food was in perfect condition.',
  'Quick and seamless. Great way to reduce waste!',
  'Item was exactly as described. Pick up was smooth.',
  'Very kind sharer, even helped me carry it to my car. Five stars!',
  '',
  'Good communication and the food was fresh.',
  'Pickup was a bit late but overall great experience.',
];

// ─── main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🗑  Clearing existing data...');

  // Delete all auth users (cascades to public.users)
  const { data: existingUsers } = await sb.auth.admin.listUsers();
  for (const u of existingUsers?.users || []) {
    await sb.auth.admin.deleteUser(u.id);
  }
  console.log(`   Deleted ${existingUsers?.users?.length || 0} existing users`);

  // ── CREATE USERS ────────────────────────────────────────────────────────────
  console.log('\n👤 Creating users...');

  const usersToCreate = [
    // admin
    { username: 'admin', email: 'admin@foodbridge.app', password: 'password', name: 'Admin', neighborhood: 'Hamra', role: 'individual', dietary_prefs: [], is_admin: true, total_shared: 5, total_claimed: 3, avg_rating: 4.3 },
    // individuals — spread across levels: Sprout(<5), Helper(5-14), Champion(15-29), Food Hero(30+)
    { username: 'test1', email: 'test1@example.com', password: 'password', name: 'Sarah K.', neighborhood: 'Hamra', role: 'individual', dietary_prefs: ['Vegetarian'], total_shared: 18, total_claimed: 7,  avg_rating: 4.6 },   // Champion
    { username: 'test2', email: 'test2@example.com', password: 'password', name: 'Omar B.', neighborhood: 'Gemmayzeh', role: 'individual', dietary_prefs: ['Halal'], total_shared: 2, total_claimed: 1,    avg_rating: 3.7 },   // Sprout w/ some activity
    { username: 'test3', email: 'test3@example.com', password: 'password', name: 'Lara M.', neighborhood: 'Ashrafieh', role: 'individual', dietary_prefs: ['Vegan', 'Gluten-free'], total_shared: 34, total_claimed: 12, avg_rating: 4.8 }, // Food Hero
    { username: 'test4', email: 'test4@example.com', password: 'password', name: 'Karim N.', neighborhood: 'Mar Mikhael', role: 'individual', dietary_prefs: [], total_shared: 6, total_claimed: 3,        avg_rating: 4.2 },   // Helper
    { username: 'test5', email: 'test5@example.com', password: 'password', name: 'Maya H.', neighborhood: 'Verdun', role: 'individual', dietary_prefs: ['Halal', 'Gluten-free'], total_shared: 0, total_claimed: 0, avg_rating: 0 }, // Sprout — no activity
    // more individuals
    { username: 'test9',  email: 'test9@example.com',  password: 'password', name: 'Nour Z.',        neighborhood: 'Sodeco',     role: 'individual', dietary_prefs: ['Vegan', 'Halal'],              total_shared: 9,  total_claimed: 4,  avg_rating: 4.0 },  // Helper
    { username: 'test10', email: 'test10@example.com', password: 'password', name: 'Rami F.',        neighborhood: 'Badaro',     role: 'individual', dietary_prefs: ['Vegetarian'],                  total_shared: 22, total_claimed: 9,  avg_rating: 4.7 },  // Champion
    { username: 'test11', email: 'test11@example.com', password: 'password', name: 'Tia L.',         neighborhood: 'Raouche',    role: 'individual', dietary_prefs: ['Gluten-free', 'Nut-free'],     total_shared: 1,  total_claimed: 2,  avg_rating: 3.9 },  // Sprout w/ some activity
    { username: 'test12', email: 'test12@example.com', password: 'password', name: 'Hassan A.',      neighborhood: 'Dekwaneh',   role: 'individual', dietary_prefs: ['Halal'],                      total_shared: 41, total_claimed: 15, avg_rating: 4.9 },  // Food Hero
    { username: 'test13', email: 'test13@example.com', password: 'password', name: 'Dalia R.',       neighborhood: 'Achrafieh',  role: 'individual', dietary_prefs: ['Vegetarian', 'Gluten-free'],  total_shared: 5,  total_claimed: 1,  avg_rating: 4.3 },  // Helper
    { username: 'test14', email: 'test14@example.com', password: 'password', name: 'Joe M.',         neighborhood: 'Gemmayzeh',  role: 'individual', dietary_prefs: [],                             total_shared: 0,  total_claimed: 3,  avg_rating: 3.6 },  // Sprout w/ claims
    // restaurants
    { username: 'test6', email: 'test6@example.com', password: 'password', name: 'Tawlet Kitchen',    neighborhood: 'Mar Mikhael', role: 'restaurant', dietary_prefs: [],                          total_shared: 28, total_claimed: 0, avg_rating: 4.5 },  // Champion
    { username: 'test7', email: 'test7@example.com', password: 'password', name: 'Zaatar & Zeit',     neighborhood: 'Hamra',       role: 'restaurant', dietary_prefs: ['Halal'],                   total_shared: 55, total_claimed: 0, avg_rating: 4.9 },  // Food Hero
    { username: 'test8', email: 'test8@example.com', password: 'password', name: 'Souk el Tayeb Café',neighborhood: 'Gemmayzeh',  role: 'restaurant', dietary_prefs: ['Vegetarian'],                total_shared: 13, total_claimed: 0, avg_rating: 4.1 },  // Helper
    { username: 'test15', email: 'test15@example.com', password: 'password', name: 'Urban Bites',    neighborhood: 'Verdun',      role: 'restaurant', dietary_prefs: ['Halal', 'Vegetarian'],      total_shared: 7,  total_claimed: 0, avg_rating: 3.8 },  // Helper
    { username: 'test16', email: 'test16@example.com', password: 'password', name: 'The Green Bowl', neighborhood: 'Badaro',      role: 'restaurant', dietary_prefs: ['Vegan', 'Gluten-free'],    total_shared: 38, total_claimed: 0, avg_rating: 4.7 },  // Food Hero
  ];

  const createdUsers = [];
  let isFirstUser = true;
  for (const u of usersToCreate) {
    const { data, error } = await sb.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) { console.error(`   ✗ ${u.username}:`, error.message); continue; }
    const userId = data.user.id;

    // Insert into public.users directly (trigger is removed)
    const publicUser = {
      id: userId,
      username: u.username,
      email: u.email,
      name: u.name,
      neighborhood: u.neighborhood,
      role: u.role,
      dietary_prefs: u.dietary_prefs,
      profile_complete: true,
      is_admin: u.is_admin || isFirstUser,
      id_verified: ['test1','test3','test6','test7','test10','test15'].includes(u.username),
      id_doc_status: ['test1','test3','test6','test7','test10','test15'].includes(u.username)
        ? 'approved'
        : ['test2','test9','test14'].includes(u.username)
        ? 'pending'
        : 'none',
      total_shared: u.total_shared ?? 0,
      total_claimed: u.total_claimed ?? 0,
      avg_rating: u.avg_rating ?? 0,
    };
    isFirstUser = false;

    const { error: insertErr } = await sb.from('users').insert(publicUser);
    if (insertErr) { console.error(`   ✗ ${u.username} profile:`, insertErr.message); continue; }

    createdUsers.push({ ...u, id: userId });
    console.log(`   ✓ ${u.username} (${u.role})`);
  }

  // ── CREATE LISTINGS ─────────────────────────────────────────────────────────
  console.log('\n🍱 Creating listings...');

  // Listing authors: all users including admin
  const listers = createdUsers;
  const insertedListings = [];

  for (let i = 0; i < LISTING_DATA.length; i++) {
    const lister = listers[i % listers.length];
    const ld = LISTING_DATA[i];
    const nbhood = lister.neighborhood;
    const daysMin = i < 3 ? 1 : 2;  // first few urgent

    // Upload photos from local files to Supabase Storage
    const uploadedPhotos = [];
    for (let j = 0; j < (ld.photos || []).length; j++) {
      const localPath = path.join(__dirname, ld.photos[j]);
      const storagePath = `seed/listing_${i}_${j}${path.extname(ld.photos[j])}`;
      const publicUrl = await uploadLocalPhoto(localPath, storagePath);
      if (publicUrl) uploadedPhotos.push(publicUrl);
    }

    const { data, error } = await sb.from('listings').insert({
      user_id: lister.id,
      title: ld.title,
      description: ld.description,
      photos: uploadedPhotos,
      expiry_date: future(daysMin, 12),
      categories: ld.categories,
      storage_condition: ld.storage_condition,
      pickup_address: `${rand(1,99)} Rue ${nbhood}`,
      pickup_lat: 33.88 + (Math.random() - 0.5) * 0.1,
      pickup_lng: 35.50 + (Math.random() - 0.5) * 0.1,
      neighborhood: nbhood,
      dietary_tags: ld.dietary_tags,
      status: 'active',
      original_price: ld.original_price ?? null,
      listing_price: ld.listing_price ?? 0,
    }).select().single();
    if (error) { console.error(`   ✗ ${ld.title}:`, error.message); continue; }
    insertedListings.push({ ...data, lister });
    console.log(`   ✓ "${ld.title}" by ${lister.username}`);
  }

  // ── CREATE CLAIMS + MESSAGES ─────────────────────────────────────────────────
  console.log('\n💬 Creating claims & messages...');

  const claimers = createdUsers;
  const claimedListings = insertedListings.slice(0, 14);  // claim first 14
  const insertedClaims = [];

  for (let i = 0; i < claimedListings.length; i++) {
    const listing = claimedListings[i];
    // pick a claimer that isn't the lister
    const eligibleClaimers = claimers.filter(c => c.id !== listing.lister.id);
    const claimer = eligibleClaimers[i % eligibleClaimers.length];

    const isCompleted = i < 6;
    const status = isCompleted ? 'completed' : 'active';
    const listerConfirmed = isCompleted;
    const claimerConfirmed = isCompleted;

    const { data: claim, error: claimErr } = await sb.from('claims').insert({
      listing_id: listing.id,
      claimer_id: claimer.id,
      status,
      pickup_confirmed_lister: listerConfirmed,
      pickup_confirmed_claimer: claimerConfirmed,
      rated_by_lister: isCompleted,
      rated_by_claimer: isCompleted,
    }).select().single();

    if (claimErr) { console.error(`   ✗ claim ${i}:`, claimErr.message); continue; }

    // Update listing status
    await sb.from('listings').update({ status: isCompleted ? 'claimed' : 'reserved' }).eq('id', listing.id);
    insertedClaims.push({ ...claim, listing, claimer });
    console.log(`   ✓ claim: ${claimer.username} → "${listing.title}" [${status}]`);

    // Insert messages
    const msgThread = MESSAGES[i % MESSAGES.length];
    const participants = [listing.lister, claimer];
    for (let m = 0; m < msgThread.length; m++) {
      const sender = participants[m % 2];
      await sb.from('messages').insert({
        claim_id: claim.id,
        sender_id: sender.id,
        content: msgThread[m],
      });
    }
  }

  // ── CREATE RATINGS ───────────────────────────────────────────────────────────
  console.log('\n⭐ Creating ratings...');

  const completedClaims = insertedClaims.filter(c => c.status === 'completed');
  for (const claim of completedClaims) {
    // claimer rates lister
    const r1 = await sb.from('ratings').insert({
      claim_id: claim.id,
      rater_id: claim.claimer.id,
      ratee_id: claim.listing.lister.id,
      stars: rand(4, 5),
      review: pick(REVIEW_TEXTS),
    });
    if (r1.error) console.error('    rating error:', r1.error.message);

    // lister rates claimer
    const r2 = await sb.from('ratings').insert({
      claim_id: claim.id,
      rater_id: claim.listing.lister.id,
      ratee_id: claim.claimer.id,
      stars: rand(3, 5),
      review: pick(REVIEW_TEXTS),
    });
    if (r2.error) console.error('    rating error:', r2.error.message);

    console.log(`   ✓ ratings for claim ${claim.id.slice(0, 8)}…`);
  }

  // ── CREATE REPORTS ───────────────────────────────────────────────────────────
  console.log('\n🚩 Creating sample reports...');

  const reporter = createdUsers.find(u => u.username === 'test3');
  const reportedListing = insertedListings.find(l => l.lister.username === 'test2');
  if (reporter && reportedListing) {
    await sb.from('reports').insert({
      reporter_id: reporter.id,
      listing_id: reportedListing.id,
      reason: 'Item appears unsealed or tampered',
      status: 'open',
    });
    console.log('   ✓ 1 open report');
  }

  // ── CREATE NOTIFICATIONS ─────────────────────────────────────────────────────
  console.log('\n🔔 Creating notifications...');

  for (const claim of insertedClaims.slice(0, 6)) {
    await sb.from('notifications').insert({
      user_id: claim.listing.lister.id,
      type: 'new_claim',
      title: 'Someone claimed your item!',
      body: `${claim.claimer.name} claimed "${claim.listing.title}". Coordinate pickup via chat.`,
      data: { claim_id: claim.id, listing_id: claim.listing.id },
    });
  }
  // expired listing notification for admin
  const adminUser = createdUsers.find(u => u.username === 'admin');
  if (adminUser) {
    await sb.from('notifications').insert({
      user_id: adminUser.id,
      type: 'info',
      title: 'Welcome to FoodBridge Admin',
      body: 'You have admin access. Use the Admin panel to manage reports and users.',
      data: {},
    });
  }
  console.log(`   ✓ ${insertedClaims.slice(0, 6).length + 1} notifications`);

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('Accounts (all password: "password"):');
  console.log('  admin    → admin@foodbridge.app  [admin]');
  for (let i = 1; i <= 16; i++) {
    const u = createdUsers.find(u => u.username === `test${i}`);
    if (u) console.log(`  test${i.toString().padEnd(2)}   → ${u.email.padEnd(30)} [${u.role}]  ${u.name}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
