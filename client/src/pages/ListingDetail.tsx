import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Flag, ChevronLeft, ChevronRight } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import type { Listing } from '../types';
import { STORAGE_CONDITIONS } from '../types';
import UserBadge from '../components/UserBadge';
import { StarDisplay } from '../components/StarRating';

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [error, setError] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportCategory, setReportCategory] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    api.get(`/listings/${id}`).then(({ data }) => {
      setListing(data.listing);
    }).catch(() => navigate('/home')).finally(() => setLoading(false));
  }, [id]);

  async function claim() {
    if (!listing) return;
    setClaiming(true); setError('');
    try {
      const { data } = await api.post('/claims', { listing_id: listing.id });
      setClaimed(true);
      navigate(`/chat/${data.claim.id}`);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to claim');
    } finally { setClaiming(false); }
  }

  async function submitReport() {
    if (!reportCategory) return;
    try {
      await api.post('/reports', { listing_id: id, category: reportCategory, description: reportDesc });
      setReportSent(true);
    } catch {}
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!listing) return null;

  const daysLeft = differenceInDays(parseISO(listing.expiry_date), new Date());
  const isUrgent = daysLeft <= 2;
  const isOwn = listing.user_id === user?.id;
  const storage = STORAGE_CONDITIONS.find(s => s.value === listing.storage_condition);
  const REPORT_CATS = ['Item appears unsealed or tampered', 'Expiry date appears incorrect', 'No-show / pickup not completed', 'Inappropriate content', 'Other'];

  return (
    <div className="min-h-screen bg-gray-50 pb-32 max-w-lg mx-auto">
      {/* Photos */}
      <div className="relative bg-gray-900 aspect-[4/3]">
        {listing.photos.length > 0 ? (
          <>
            <img src={listing.photos[photoIdx]} alt={listing.title} className="w-full h-full object-cover" />
            {listing.photos.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx(Math.max(0, photoIdx - 1))} disabled={photoIdx === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white disabled:opacity-30">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => setPhotoIdx(Math.min(listing.photos.length - 1, photoIdx + 1))} disabled={photoIdx === listing.photos.length - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white disabled:opacity-30">
                  <ChevronRight size={18} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {listing.photos.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === photoIdx ? 'bg-white' : 'bg-white/40'}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">🍱</div>
        )}
        <button onClick={() => navigate(-1)} className="absolute top-12 left-4 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center text-white">
          <ArrowLeft size={18} />
        </button>
        {!isOwn && (
          <button onClick={() => setShowReport(true)} className="absolute top-12 right-4 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center text-white">
            <Flag size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-5 space-y-5">
        {/* Title + expiry */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900 flex-1">{listing.title}</h1>
            <span className={`badge font-semibold text-sm px-3 py-1 ${isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
              {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`}
            </span>
          </div>
          <p className="text-sm text-gray-500">Expires {format(parseISO(listing.expiry_date), 'MMMM d, yyyy')}</p>
          {isUrgent && (
            <div className="mt-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-xs text-orange-700">
              ⚠️ This item expires soon — claim quickly and arrange pickup right away
            </div>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-2">
          {storage && (
            <span className="badge bg-blue-50 text-blue-700 border border-blue-100 text-xs px-3 py-1">
              {storage.icon} {storage.label}
            </span>
          )}
          {listing.dietary_tags.map(tag => (
            <span key={tag} className="badge bg-brand-50 text-brand-700 border border-brand-100 text-xs px-3 py-1">{tag}</span>
          ))}
          {listing.categories.map(cat => (
            <span key={cat} className="badge bg-gray-100 text-gray-600 text-xs px-3 py-1">{cat}</span>
          ))}
        </div>

        {/* Description */}
        {listing.description && (
          <p className="text-gray-600 text-sm leading-relaxed">{listing.description}</p>
        )}

        {/* Location */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <MapPin size={14} className="text-brand-600" /> Pickup location
          </h3>
          <p className="text-sm text-gray-600">
            {listing.neighborhood ? (
              <><strong>{listing.neighborhood}</strong> — exact address revealed after claiming</>
            ) : (
              'Exact address revealed after claiming'
            )}
          </p>
          {listing.pickup_lat && listing.pickup_lng && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${listing.pickup_lat}&mlon=${listing.pickup_lng}&zoom=16`}
              target="_blank" rel="noreferrer"
              className="text-xs text-brand-600 font-medium mt-2 block">
              View on map →
            </a>
          )}
        </div>

        {/* Lister */}
        {listing.user && (
          <div className="card p-4 cursor-pointer" onClick={() => navigate(`/profile/${listing.user_id}`)}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Posted by</h3>
            <div className="flex items-center gap-3">
              {listing.user.photo ? (
                <img src={listing.user.photo} className="w-12 h-12 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-xl font-bold text-brand-700">
                  {listing.user.name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{listing.user.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {(listing.user.avg_rating ?? 0) > 0 && (
                    <StarDisplay rating={listing.user.avg_rating ?? 0} count={listing.user.rating_count} />
                  )}
                  <UserBadge user={listing.user} />
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      {/* CTA */}
      {!isOwn && listing.status === 'active' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-100 px-4 pb-6 pt-3">
          <button className="btn-primary w-full text-lg" onClick={claim} disabled={claiming || claimed}>
            {claiming ? 'Claiming…' : claimed ? '✓ Claimed!' : 'Claim this item'}
          </button>
          <p className="text-xs text-center text-gray-400 mt-2">Pickup only · coordinate via in-app chat</p>
        </div>
      )}
      {listing.status === 'reserved' && !isOwn && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-100 px-4 pb-6 pt-3">
          <div className="w-full bg-gray-100 text-gray-500 text-center py-3 rounded-xl font-medium">Already claimed by someone</div>
        </div>
      )}
      {isOwn && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-100 px-4 pb-6 pt-3">
          <button onClick={() => api.delete(`/listings/${id}`).then(() => navigate('/home'))} className="btn-secondary w-full">
            Remove listing
          </button>
        </div>
      )}

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6" onClick={e => e.stopPropagation()}>
            {reportSent ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="font-bold text-gray-900 mb-1">Report submitted</h3>
                <p className="text-sm text-gray-500">Our team will review this shortly.</p>
                <button className="btn-primary mt-4 w-full" onClick={() => setShowReport(false)}>Done</button>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-gray-900 mb-4">Report this listing</h3>
                <div className="space-y-2 mb-4">
                  {REPORT_CATS.map(cat => (
                    <button key={cat} onClick={() => setReportCategory(cat)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${reportCategory === cat ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                <textarea className="input resize-none mb-4" rows={2} placeholder="Additional details (optional)"
                  value={reportDesc} onChange={e => setReportDesc(e.target.value)} />
                <button className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold disabled:opacity-50" onClick={submitReport} disabled={!reportCategory}>
                  Submit Report
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
