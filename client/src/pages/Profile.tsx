import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Upload, Settings, ShieldCheck, Flag } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import type { User, Rating, Listing } from '../types';
import UserBadge from '../components/UserBadge';
import { StarDisplay } from '../components/StarRating';
import ListingCard from '../components/ListingCard';
import { DIETARY_TAGS } from '../types';
import BottomNav from '../components/BottomNav';

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

    Promise.all([
      isOwn ? api.get('/auth/me') : api.get(`/auth/users/${userId}`),
      api.get(`/ratings/user/${userId}`),
      isOwn ? api.get('/listings/user/mine') : Promise.resolve(null)
    ]).then(([profileRes, ratingsRes, listingsRes]) => {
      const p = isOwn ? profileRes.data.user : profileRes.data.user;
      setProfile(p);
      setRatings(ratingsRes.data.ratings);
      if (listingsRes) setListings(listingsRes.data.listings);
      if (isOwn) {
        setEditName(p.name || '');
        setEditNeighborhood(p.neighborhood || '');
        setEditDietary(p.dietary_prefs || []);
        setEditRole(p.role || 'individual');
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  async function saveProfile() {
    setSaving(true);
    try {
      await api.post('/auth/complete-profile', { name: editName, neighborhood: editNeighborhood, role: editRole, dietary_prefs: editDietary });
      await refreshUser();
      setEditing(false);
    } catch {} finally { setSaving(false); }
  }

  async function uploadPhoto(file: File) {
    const form = new FormData();
    form.append('photo', file);
    await api.post('/auth/upload-photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    await refreshUser();
    setProfile(prev => prev ? { ...prev, photo: URL.createObjectURL(file) } : prev);
  }

  async function uploadId(file: File) {
    const form = new FormData();
    form.append('doc', file);
    await api.post('/auth/upload-id', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setIdStatus('pending');
    await refreshUser();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center text-gray-400">User not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-4">
          {!isOwn ? (
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
          ) : (
            <div className="w-10" />
          )}
          <h1 className="font-bold text-gray-900">{isOwn ? 'My Profile' : profile.name}</h1>
          {isOwn ? (
            <div className="flex gap-1">
              {profile.is_admin ? (
                <button onClick={() => navigate('/admin')} className="p-2 rounded-full hover:bg-gray-100 text-brand-600">
                  <Settings size={20} />
                </button>
              ) : null}
              <button onClick={() => { logout(); navigate('/'); }} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
                <LogOut size={20} />
              </button>
            </div>
          ) : <div className="w-10" />}
        </div>
      </div>

      {/* Profile header card */}
      <div className="bg-white px-4 py-6 mb-3">
        <div className="flex items-center gap-4">
          <div className="relative">
            {profile.photo ? (
              <img src={profile.photo} className="w-20 h-20 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center text-3xl font-bold text-brand-700">
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

          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
            {profile.neighborhood && <p className="text-sm text-gray-500 mt-0.5">📍 {profile.neighborhood}</p>}
            <div className="mt-2">
              <UserBadge user={profile} size="md" />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex justify-around mt-6 pt-4 border-t border-gray-100">
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{profile.total_shared}</div>
            <div className="text-xs text-gray-500">Shared</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{profile.total_claimed}</div>
            <div className="text-xs text-gray-500">Claimed</div>
          </div>
          <div className="text-center">
            <StarDisplay rating={profile.avg_rating} count={profile.rating_count} />
            <div className="text-xs text-gray-500 mt-0.5">Rating</div>
          </div>
        </div>

        {/* ID Verification for own profile */}
        {isOwn && !profile.id_verified && (
          <div className="mt-4 bg-brand-50 border border-brand-100 rounded-2xl p-4">
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

        {/* Edit profile */}
        {isOwn && !editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary w-full mt-4">Edit profile</button>
        )}

        {isOwn && editing && (
          <div className="mt-4 space-y-3">
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
            <div className="flex gap-2">
              <button className="flex-1 btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button className="flex-1 btn-primary" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {isOwn && (
        <>
          <div className="flex bg-white border-b border-gray-100 sticky top-16 z-20">
            {(['listings', 'reviews'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400'}`}>
                {t === 'listings' ? `My listings (${listings.length})` : `Reviews (${ratings.length})`}
              </button>
            ))}
          </div>

          <div className="px-4 py-4">
            {tab === 'listings' && (
              listings.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-3">🍱</p>
                  <p className="font-medium">No listings yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {listings.map(l => <ListingCard key={l.id} listing={l} />)}
                </div>
              )
            )}

            {tab === 'reviews' && (
              ratings.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-3">⭐</p>
                  <p className="font-medium">No reviews yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ratings.map(r => (
                    <div key={r.id} className="card p-4">
                      <div className="flex items-center gap-3 mb-2">
                        {r.rater_photo ? (
                          <img src={r.rater_photo} className="w-8 h-8 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
                            {r.rater_name?.[0] || '?'}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{r.rater_name}</p>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s => <span key={s} className={s <= r.stars ? 'text-yellow-400' : 'text-gray-200'}>★</span>)}
                          </div>
                        </div>
                      </div>
                      {r.review && <p className="text-sm text-gray-600">{r.review}</p>}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* Public profile reviews */}
      {!isOwn && (
        <div className="px-4 py-4">
          <h3 className="font-semibold text-gray-700 mb-3">Reviews ({ratings.length})</h3>
          {ratings.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No reviews yet</div>
          ) : (
            <div className="space-y-3">
              {ratings.map(r => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center gap-3 mb-2">
                    {r.rater_photo ? <img src={r.rater_photo} className="w-8 h-8 rounded-full object-cover" alt="" /> : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">{r.rater_name?.[0] || '?'}</div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.rater_name}</p>
                      <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <span key={s} className={s <= r.stars ? 'text-yellow-400' : 'text-gray-200'}>★</span>)}</div>
                    </div>
                  </div>
                  {r.review && <p className="text-sm text-gray-600">{r.review}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isOwn && <BottomNav />}
    </div>
  );
}
