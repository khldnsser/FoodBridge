import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Flag, ChevronLeft, ChevronRight } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Listing } from '../types';
import { STORAGE_CONDITIONS } from '../types';
import UserBadge from '../components/UserBadge';
import { StarDisplay } from '../components/StarRating';
import { SinglePinMap } from '../components/ListingMap';
import { resolveAssetUrl } from '../lib/assetUrl';

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isModal = !!(location.state as any)?.background;
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [lister, setLister] = useState<any>(null);
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
    async function load() {
      const { data: l, error: lErr } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();
      if (lErr || !l) { isModal ? navigate(-1) : navigate('/home'); return; }
      setListing(l as Listing);

      const { data: u } = await supabase
        .from('users')
        .select('id, name, photo, avg_rating, rating_count, role, id_verified, is_admin')
        .eq('id', l.user_id)
        .single();
      setLister(u);
      setLoading(false);
    }
    load();
  }, [id]);

  async function claim() {
    if (!listing) return;
    setClaiming(true); setError('');
    try {
      const { data: claimId, error: claimErr } = await supabase.rpc('claim_listing', { p_listing_id: listing.id });
      if (claimErr) throw claimErr;
      setClaimed(true);
      navigate(`/chat/${claimId}`);
    } catch (e: any) {
      setError(e.message === 'listing_not_available' ? 'Already claimed by someone else' : e.message || 'Failed to claim');
    } finally { setClaiming(false); }
  }

  async function removeListing() {
    await supabase.from('listings').update({ status: 'removed' }).eq('id', id);
    isModal ? navigate(-1) : navigate('/home');
  }

  async function submitReport() {
    if (!reportCategory || !user) return;
    await supabase.from('reports').insert({
      reporter_id: user.id,
      listing_id: id,
      reason: reportCategory + (reportDesc ? `: ${reportDesc}` : ''),
    });
    setReportSent(true);
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

  // ── Shared photo carousel ────────────────────────────────────────────────
  const photoCarousel = (extraClass = '') => (
    <div className={`relative bg-gray-900 overflow-hidden ${extraClass}`}>
      {listing.photos.length > 0 ? (
        <>
          <img src={resolveAssetUrl(listing.photos[photoIdx])} alt={listing.title} className="w-full h-full object-cover" />
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
      {!isModal && (
        <button onClick={() => navigate(-1)} className="md:hidden absolute top-12 left-4 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center text-white">
          <ArrowLeft size={18} />
        </button>
      )}
      {!isOwn && (
        <button onClick={() => setShowReport(true)} className={`absolute ${isModal ? 'top-4 left-4' : 'top-12 right-4'} w-9 h-9 bg-black/40 rounded-full flex items-center justify-center text-white`}>
          <Flag size={16} />
        </button>
      )}
    </div>
  );

  // ── Shared details body (without CTA) ────────────────────────────────────
  const detailsBody = (
    <div className="space-y-5">
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

      {/* Pricing */}
      {(() => {
        const op = (listing as any).original_price as number | null ?? null;
        const lp = (listing as any).listing_price as number ?? 0;
        if (op == null && lp === 0) return null;
        const saving = op != null ? op - lp : null;
        return (
          <div className="flex items-center gap-3 bg-brand-50 border border-brand-100 rounded-2xl px-4 py-3">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                {lp === 0 ? (
                  <span className="text-2xl font-extrabold text-brand-600">FREE</span>
                ) : (
                  <span className="text-2xl font-extrabold text-gray-900">${lp.toFixed(2)}</span>
                )}
                {op != null && (
                  <span className="text-base text-gray-400 line-through">${op.toFixed(2)}</span>
                )}
              </div>
              {saving != null && saving > 0 && (
                <p className="text-xs text-brand-700 font-semibold mt-0.5">
                  🎉 You save ${saving.toFixed(2)} ({Math.round((saving / op!) * 100)}% off)
                </p>
              )}
            </div>
            {saving != null && saving > 0 && (
              <div className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl flex-shrink-0">
                -{Math.round((saving / op!) * 100)}%
              </div>
            )}
          </div>
        );
      })()}

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

      {listing.description && (
        <p className="text-gray-600 text-sm leading-relaxed">{listing.description}</p>
      )}

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <MapPin size={14} className="text-brand-600" /> Pickup location
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          {listing.neighborhood ? (
            <><strong>{listing.neighborhood}</strong> — exact address revealed after claiming</>
          ) : (
            'Exact address revealed after claiming'
          )}
        </p>
        {listing.pickup_lat && listing.pickup_lng && (
          <SinglePinMap
            lat={Number(listing.pickup_lat)}
            lng={Number(listing.pickup_lng)}
            label={listing.neighborhood || 'Pickup location'}
          />
        )}
      </div>

      {lister && (
        <div className="card p-4 cursor-pointer" onClick={() => navigate(`/profile/${listing.user_id}`)}>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Posted by</h3>
          <div className="flex items-center gap-3">
            {lister.photo ? (
              <img src={resolveAssetUrl(lister.photo)} className="w-12 h-12 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-xl font-bold text-brand-700">
                {lister.name?.[0] || '?'}
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{lister.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {lister.avg_rating > 0 && (
                  <StarDisplay rating={lister.avg_rating} count={lister.rating_count} />
                )}
                <UserBadge user={lister} />
              </div>
            </div>
            <ChevronLeft size={16} className="text-gray-300 rotate-180" />
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );

  // ── Shared CTA ───────────────────────────────────────────────────────────
  const cta = (
    <>
      {!isOwn && listing.status === 'active' && (
        <>
          <button className="btn-primary w-full text-lg" onClick={claim} disabled={claiming || claimed}>
            {claiming ? 'Claiming…' : claimed ? '✓ Claimed!' : 'Claim this item'}
          </button>
          <p className="text-xs text-center text-gray-400 mt-2">Pickup only · coordinate via in-app chat</p>
        </>
      )}
      {listing.status === 'reserved' && !isOwn && (
        <div className="w-full bg-gray-100 text-gray-500 text-center py-3 rounded-xl font-medium">
          Already claimed by someone
        </div>
      )}
      {isOwn && (
        <button onClick={removeListing} className="btn-secondary w-full">Remove listing</button>
      )}
    </>
  );

  // ── Non-modal page layout (unchanged) ───────────────────────────────────
  const photos = photoCarousel('aspect-[4/3] md:rounded-2xl md:sticky md:top-8');
  const details = (
    <div className="px-4 md:px-0 py-5 space-y-5">
      {detailsBody}
      {/* Desktop CTA */}
      <div className="hidden md:block">{cta}</div>
    </div>
  );

  // ── MODAL layout ─────────────────────────────────────────────────────────
  if (isModal) {
    return (
      <>
        {/* Mobile: stacked sheet — photo top, scrollable details, pinned CTA */}
        <div className="flex flex-col w-full md:hidden overflow-hidden max-h-[92vh]">
          {photoCarousel('aspect-[4/3]')}
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
            {detailsBody}
          </div>
          <div className="flex-shrink-0 border-t border-gray-100 px-5 pb-6 pt-3 bg-white">
            {cta}
          </div>
        </div>

        {/* Desktop: two-column — photo left 45%, scrollable details + pinned CTA right 55% */}
        <div className="hidden md:flex w-full h-full" style={{ minHeight: 0 }}>
          {/* Left: photo fills full height */}
          <div className="w-[45%] flex-shrink-0">
            {photoCarousel('h-full')}
          </div>
          {/* Right: scrollable details + pinned CTA */}
          <div className="w-[55%] flex flex-col" style={{ minHeight: 0 }}>
            <div className="flex-1 overflow-y-auto p-6 max-h-[calc(88vh-72px)]">
              {detailsBody}
            </div>
            <div className="flex-shrink-0 border-t border-gray-100 px-6 pb-6 pt-4 bg-white">
              {cta}
            </div>
          </div>
        </div>

        {/* Report modal */}
        {showReport && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center md:justify-center" onClick={() => setShowReport(false)}>
            <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md p-6" onClick={e => e.stopPropagation()}>
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
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32 md:pb-8">
      <div className="hidden md:flex items-center gap-3 bg-white border-b border-gray-100 sticky top-0 z-30 px-8 py-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-gray-900">{listing.title}</h1>
      </div>

      <div className="max-w-7xl mx-auto md:px-8 md:py-8">
        <div className="md:grid md:grid-cols-[55%_45%] md:gap-8 md:items-start">
          <div>{photos}</div>
          <div>{details}</div>
        </div>
      </div>

      {/* Mobile fixed CTAs — only when NOT in modal */}
      {!isOwn && listing.status === 'active' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pb-6 pt-3 z-50">
          <button className="btn-primary w-full text-lg" onClick={claim} disabled={claiming || claimed}>
            {claiming ? 'Claiming…' : claimed ? '✓ Claimed!' : 'Claim this item'}
          </button>
          <p className="text-xs text-center text-gray-400 mt-2">Pickup only · coordinate via in-app chat</p>
        </div>
      )}
      {listing.status === 'reserved' && !isOwn && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pb-6 pt-3 z-50">
          <div className="w-full bg-gray-100 text-gray-500 text-center py-3 rounded-xl font-medium">Already claimed by someone</div>
        </div>
      )}
      {isOwn && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 pb-6 pt-3 z-50">
          <button onClick={removeListing} className="btn-secondary w-full">Remove listing</button>
        </div>
      )}

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md p-6" onClick={e => e.stopPropagation()}>
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
