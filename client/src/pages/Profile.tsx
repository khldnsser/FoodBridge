import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Settings, ShieldCheck, LogOut, Trophy } from 'lucide-react';

// ─── Gamification helpers ────────────────────────────────────────────────────
function getLevel(shared: number, claimed: number) {
  const total = shared + claimed;
  if (total >= 30) return { label: 'Food Hero', emoji: '⭐', color: 'text-yellow-600', bg: 'bg-yellow-50', next: null, progress: 100 };
  if (total >= 15) return { label: 'Champion', emoji: '🏆', color: 'text-purple-600', bg: 'bg-purple-50', next: 30, progress: Math.round(((total - 15) / 15) * 100) };
  if (total >= 5)  return { label: 'Helper',   emoji: '🌿', color: 'text-brand-600',  bg: 'bg-brand-50',  next: 15, progress: Math.round(((total - 5) / 10) * 100) };
  return { label: 'Sprout', emoji: '🌱', color: 'text-green-600', bg: 'bg-green-50', next: 5, progress: Math.round((total / 5) * 100) };
}

function getBadges(profile: { total_shared: number; total_claimed: number; id_verified: boolean; avg_rating: number; rating_count: number; role: string }) {
  const badges: { label: string; emoji: string; desc: string }[] = [];
  if (profile.total_shared >= 1)  badges.push({ label: 'First Share',  emoji: '🤝', desc: 'Shared your first item' });
  if (profile.total_shared >= 5)  badges.push({ label: '5 Shares',     emoji: '📦', desc: 'Shared 5 items' });
  if (profile.total_shared >= 10) badges.push({ label: 'Food Saver',   emoji: '🌍', desc: 'Saved 10 meals from waste' });
  if (profile.total_claimed >= 1) badges.push({ label: 'First Claim',  emoji: '🛒', desc: 'Claimed your first item' });
  if (profile.total_claimed >= 5) badges.push({ label: '5 Claims',     emoji: '🎯', desc: 'Claimed 5 items' });
  if (profile.id_verified)        badges.push({ label: 'Verified',     emoji: '✅', desc: 'ID verified by FoodBridge' });
  if (profile.avg_rating >= 4.5 && profile.rating_count >= 3) badges.push({ label: 'Top Rated', emoji: '⭐', desc: '4.5+ star average rating' });
  if (profile.role === 'restaurant') badges.push({ label: 'Partner',   emoji: '🏪', desc: 'Restaurant partner' });
  return badges;
}
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { User, Rating, Listing } from '../types';
import UserBadge from '../components/UserBadge';
import { StarDisplay } from '../components/StarRating';
import ListingCard from '../components/ListingCard';
import { DIETARY_TAGS } from '../types';
import { resolveAssetUrl } from '../lib/assetUrl';

export default function Profile() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user: me, logout, refreshUser } = useAuth();
  const isOwn = !id || id === me?.id;
  const fileRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<User | null>(isOwn ? me : null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'listings' | 'reviews'>('listings');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editDietary, setEditDietary] = useState<string[]>([]);
  const [editRole, setEditRole] = useState<'individual' | 'restaurant'>('individual');
  const [saving, setSaving] = useState(false);
  const [idStatus, setIdStatus] = useState('');

  useEffect(() => {
    const userId = id || me?.id;
    if (!userId) return;

    async function load() {
      const [{ data: p }, { data: ratingRows }, { data: listingRows }] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('ratings').select('*, users!rater_id ( name, photo )').eq('ratee_id', userId).order('created_at', { ascending: false }),
        isOwn
          ? supabase.from('listings').select('*').eq('user_id', userId).neq('status', 'removed').order('created_at', { ascending: false })
          : { data: [] },
      ]);
      if (p) {
        setProfile(p as User);
        if (isOwn) {
          setEditName(p.name || '');
          setEditNeighborhood(p.neighborhood || '');
          setEditDietary(p.dietary_prefs || []);
          setEditRole(p.role || 'individual');
        }
      }
      if (ratingRows) setRatings(ratingRows as unknown as Rating[]);
      if (listingRows) setListings(listingRows as Listing[]);
      setLoading(false);
    }
    load();
  }, [id]);

  async function saveProfile() {
    if (!me) return;
    setSaving(true);
    try {
      await supabase.from('users').update({
        name: editName.trim(),
        neighborhood: editNeighborhood.trim(),
        role: editRole,
        dietary_prefs: editDietary,
        profile_complete: true,
      }).eq('id', me.id);
      await refreshUser();
      setEditing(false);
    } catch {} finally { setSaving(false); }
  }

  async function uploadPhoto(file: File) {
    if (!me) return;
    const ext = file.name.split('.').pop();
    const path = `${me.id}/avatar.${ext}`;
    await supabase.storage.from('profile-photos').upload(path, file, { upsert: true, contentType: file.type });
    const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path);
    const normalizedPhotoUrl = resolveAssetUrl(publicUrl);
    await supabase.from('users').update({ photo: normalizedPhotoUrl }).eq('id', me.id);
    await refreshUser();
    setProfile(prev => prev ? { ...prev, photo: normalizedPhotoUrl } : prev);
  }

  async function uploadId(file: File) {
    if (!me) return;
    const ext = file.name.split('.').pop();
    const path = `${me.id}/id.${ext}`;
    const { error } = await supabase.storage.from('id-documents').upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      await supabase.from('users').update({ id_doc_status: 'pending' }).eq('id', me.id);
      setIdStatus('pending');
      await refreshUser();
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center text-gray-400">User not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between py-4">
          {!isOwn ? (
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
          ) : (
            <h1 className="font-bold text-lg text-gray-900">My Profile</h1>
          )}
          {!isOwn && <h1 className="font-bold text-gray-900">{profile.name}</h1>}
          {isOwn ? (
            <div className="flex gap-1">
              {profile.is_admin && (
                <button onClick={() => navigate('/admin')} className="p-2 rounded-full hover:bg-gray-100 text-brand-600">
                  <Settings size={20} />
                </button>
              )}
              <button onClick={() => { logout(); navigate('/'); }} className="md:hidden p-2 rounded-full hover:bg-gray-100 text-gray-500">
                <LogOut size={20} />
              </button>
            </div>
          ) : <div className="w-10" />}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="md:grid md:grid-cols-[280px_1fr] md:gap-8 md:items-start">

          {/* Left column — profile card */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex md:flex-col md:items-center items-center gap-4 mb-5 md:mb-4">
                <div className="relative flex-shrink-0">
                  {profile.photo ? (
                    <img src={resolveAssetUrl(profile.photo)} className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-brand-100 flex items-center justify-center text-3xl font-bold text-brand-700">
                      {profile.name?.[0] || '?'}
                    </div>
                  )}
                  {isOwn && (
                    <>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
                      <button onClick={() => fileRef.current?.click()}
                        className="absolute bottom-0 right-0 w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center border-2 border-white">
                        <Upload size={12} className="text-white" />
                      </button>
                    </>
                  )}
                </div>
                <div className="md:text-center">
                  <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
                  {profile.neighborhood && <p className="text-sm text-gray-500 mt-0.5">📍 {profile.neighborhood}</p>}
                  <div className="mt-2">
                    <UserBadge user={profile} size="md" />
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex justify-around pt-4 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{profile.total_shared}</div>
                  <div className="text-xs text-gray-500">Shared</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{profile.total_claimed}</div>
                  <div className="text-xs text-gray-500">Claimed</div>
                </div>
                <div className="text-center">
                  {profile.avg_rating > 0 ? (
                    <StarDisplay rating={profile.avg_rating} count={profile.rating_count} />
                  ) : (
                    <div className="text-sm font-medium text-gray-400">—</div>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">Rating</div>
                </div>
              </div>

              {/* Level + progress */}
              {(() => {
                const lvl = getLevel(profile.total_shared, profile.total_claimed);
                return (
                  <div className={`mt-4 rounded-2xl p-3 ${lvl.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{lvl.emoji}</span>
                        <div>
                          <p className={`text-sm font-bold ${lvl.color}`}>{lvl.label}</p>
                          {lvl.next != null && (
                            <p className="text-xs text-gray-500">{profile.total_shared + profile.total_claimed}/{lvl.next} actions to next level</p>
                          )}
                        </div>
                      </div>
                      <Trophy size={16} className={lvl.color} />
                    </div>
                    {lvl.next != null && (
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${lvl.color.replace('text-', 'bg-')}`} style={{ width: `${lvl.progress}%` }} />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Badges */}
            {(() => {
              const badges = getBadges(profile);
              if (badges.length === 0) return null;
              return (
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Trophy size={14} className="text-yellow-500" /> Achievements
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {badges.map(b => (
                      <div key={b.label} title={b.desc}
                        className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-xl px-2.5 py-1.5">
                        <span className="text-base">{b.emoji}</span>
                        <span className="text-xs font-medium text-gray-700">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ID Verification */}
            {isOwn && !profile.id_verified && (
              <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={20} className="text-brand-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-brand-800">Get ID Verified</p>
                    <p className="text-xs text-brand-600 mt-0.5">Upload a government ID to earn the trust badge</p>
                    {profile.id_doc_status === 'pending' || idStatus === 'pending' ? (
                      <p className="text-xs text-orange-600 mt-2 font-medium">⏳ Under review</p>
                    ) : profile.id_doc_status === 'rejected' ? (
                      <p className="text-xs text-red-600 mt-2">Rejected — please resubmit</p>
                    ) : (
                      <>
                        <input ref={idRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files?.[0] && uploadId(e.target.files[0])} />
                        <button onClick={() => idRef.current?.click()} className="mt-2 text-xs text-brand-700 font-semibold underline">
                          Upload ID document
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isOwn && !editing && (
              <button onClick={() => setEditing(true)} className="btn-secondary w-full">Edit profile</button>
            )}

            {isOwn && editing && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">Edit profile</h3>
                <input className="input" placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} />
                <input className="input" placeholder="Neighbourhood" value={editNeighborhood} onChange={e => setEditNeighborhood(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  {(['individual', 'restaurant'] as const).map(r => (
                    <button key={r} onClick={() => setEditRole(r)}
                      className={`py-2 rounded-xl border-2 text-sm font-medium transition-all ${editRole === r ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>
                      {r === 'individual' ? '👤 Individual' : '🏪 Restaurant'}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_TAGS.map(tag => (
                    <button key={tag} onClick={() => setEditDietary(p => p.includes(tag) ? p.filter(x => x !== tag) : [...p, tag])}
                      className={`badge border transition-all ${editDietary.includes(tag) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button className="flex-1 btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                  <button className="flex-1 btn-primary" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div>
            {isOwn ? (
              <>
                <div className="flex border-b border-gray-200 mb-5">
                  {(['listings', 'reviews'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      {t === 'listings' ? `Listings (${listings.length})` : `Reviews (${ratings.length})`}
                    </button>
                  ))}
                </div>

                {tab === 'listings' && (
                  listings.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <p className="text-4xl mb-3">🍱</p>
                      <p className="font-medium">No listings yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                      {listings.map(l => <ListingCard key={l.id} listing={l} />)}
                    </div>
                  )
                )}

                {tab === 'reviews' && (
                  ratings.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <p className="text-4xl mb-3">⭐</p>
                      <p className="font-medium">No reviews yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ratings.map(r => <ReviewCard key={r.id} r={r} />)}
                    </div>
                  )
                )}
              </>
            ) : (
              <>
                <h3 className="font-semibold text-gray-700 mb-4">Reviews ({ratings.length})</h3>
                {ratings.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No reviews yet</div>
                ) : (
                  <div className="space-y-3">
                    {ratings.map(r => <ReviewCard key={r.id} r={r} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ r }: { r: Rating }) {
  const rater = (r as any).users;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-2">
        {rater?.photo ? (
          <img src={resolveAssetUrl(rater.photo)} className="w-8 h-8 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
            {rater?.name?.[0] || '?'}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-gray-900">{rater?.name || 'Anonymous'}</p>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(s => <span key={s} className={s <= r.stars ? 'text-yellow-400' : 'text-gray-200'}>★</span>)}
          </div>
        </div>
      </div>
      {r.review && <p className="text-sm text-gray-600">{r.review}</p>}
    </div>
  );
}
