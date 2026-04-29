import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { StarPicker } from '../components/StarRating';
import { resolveAssetUrl } from '../lib/assetUrl';

interface ClaimDetail {
  id: string;
  listing_id: string;
  claimer_id: string;
  status: string;
  pickup_confirmed_lister: boolean;
  pickup_confirmed_claimer: boolean;
  rated_by_lister: boolean;
  rated_by_claimer: boolean;
  listings: {
    title: string;
    photos: string[];
    expiry_date: string;
    user_id: string;
    pickup_address: string;
  };
  users: { name: string | null; photo: string | null };
}

interface MsgRow {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  users: { name: string | null; photo: string | null };
}

export default function Chat() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [rated, setRated] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function fetchData() {
    const [{ data: c }, { data: msgs }] = await Promise.all([
      supabase
        .from('claims')
        .select(`id, listing_id, claimer_id, status,
          pickup_confirmed_lister, pickup_confirmed_claimer,
          rated_by_lister, rated_by_claimer,
          listings ( title, photos, expiry_date, user_id, pickup_address ),
          users ( name, photo )`)
        .eq('id', claimId)
        .single(),
      supabase
        .from('messages')
        .select('id, sender_id, content, created_at, users ( name, photo )')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: true }),
    ]);
    if (c) setClaim(c as unknown as ClaimDetail);
    if (msgs) setMessages(msgs as unknown as MsgRow[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [claimId]);

  // Realtime messages
  useEffect(() => {
    if (!claimId) return;
    const channel = supabase
      .channel(`chat:${claimId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `claim_id=eq.${claimId}`,
      }, () => fetchData())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'claims',
        filter: `id=eq.${claimId}`,
      }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [claimId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending || !user) return;
    setSending(true);
    try {
      await supabase.from('messages').insert({
        claim_id: claimId,
        sender_id: user.id,
        content: input.trim(),
      });
      setInput('');
    } catch {} finally { setSending(false); }
  }

  async function confirmPickup() {
    setConfirming(true);
    try {
      const { error } = await supabase.rpc('confirm_pickup', { p_claim_id: claimId });
      if (!error) {
        await fetchData();
        // if both now confirmed → show rating
        const { data: updated } = await supabase.from('claims').select('status').eq('id', claimId).single();
        if (updated?.status === 'completed') setShowRating(true);
      }
    } catch {} finally { setConfirming(false); }
  }

  async function submitRating() {
    if (!stars || !user || !claim) return;
    const isLister = claim.listings.user_id === user.id;
    const rateeId = isLister ? claim.claimer_id : claim.listings.user_id;
    await supabase.from('ratings').insert({
      claim_id: claimId,
      rater_id: user.id,
      ratee_id: rateeId,
      stars,
      review,
    });
    // mark rated
    const col = isLister ? 'rated_by_lister' : 'rated_by_claimer';
    await supabase.from('claims').update({ [col]: true }).eq('id', claimId);
    setRated(true);
  }

  async function cancelClaim() {
    if (!claim || !user) return;
    if (!window.confirm('Cancel this claim? The food will become available to others again.')) return;
    setCancelling(true);
    try {
      await supabase.from('claims').update({ status: 'cancelled' }).eq('id', claimId);
      await supabase.from('listings').update({ status: 'active' }).eq('id', claim.listing_id);
      await supabase.from('notifications').insert({
        user_id: claim.listings.user_id,
        type: 'claim_cancelled',
        title: 'Claim cancelled',
        body: `${user.name || 'Someone'} cancelled their claim for "${claim.listings.title}". It's now available again.`,
        data: { listing_id: claim.listing_id },
      });
      navigate('/messages');
    } catch {} finally { setCancelling(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!claim) return null;

  const listing = claim.listings;
  const isLister = listing.user_id === user?.id;
  const isComplete = claim.status === 'completed';
  const myConfirmed = isLister ? claim.pickup_confirmed_lister : claim.pickup_confirmed_claimer;
  const otherConfirmed = isLister ? claim.pickup_confirmed_claimer : claim.pickup_confirmed_lister;
  const canRate = isComplete && !rated && !(isLister ? claim.rated_by_lister : claim.rated_by_claimer);
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row pb-16 md:pb-0">

      {/* ── DESKTOP SIDEBAR ─────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-80 bg-white border-r border-gray-100 flex-shrink-0">
        {/* Back button */}
        <div className="px-4 py-3 border-b border-gray-100">
          <button onClick={() => navigate('/messages')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} />
            Back to messages
          </button>
        </div>

        {/* Listing photo */}
        {listing.photos[0] ? (
          <img src={resolveAssetUrl(listing.photos[0])} className="w-full aspect-[4/3] object-cover" alt="" />
        ) : (
          <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center text-4xl">🍱</div>
        )}

        {/* Listing info */}
        <div className="px-4 py-4 space-y-3 flex-1 overflow-y-auto">
          <div>
            <p className="font-bold text-gray-900 text-base leading-snug">{listing.title}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1.5 flex-wrap">
              <span>📅 {new Date(listing.expiry_date).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Status badge */}
          {isComplete ? (
            <span className="inline-flex badge bg-brand-100 text-brand-700 text-xs">Complete</span>
          ) : (
            <span className="inline-flex badge bg-yellow-100 text-yellow-700 text-xs">Active</span>
          )}

          {/* Pickup address */}
          {listing.pickup_address && (isLister || isComplete) && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pickup address</p>
              <p className="text-sm text-gray-700">📍 {listing.pickup_address}</p>
            </div>
          )}

          {/* Other person */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {isLister ? 'Claimed by' : 'Chat with'}
            </p>
            <div className="flex items-center gap-2">
              {claim.users?.photo ? (
                <img src={resolveAssetUrl(claim.users.photo)} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
                  {claim.users?.name?.[0] || '?'}
                </div>
              )}
              <p className="font-medium text-gray-900 text-sm">{claim.users?.name || 'Unknown'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── DESKTOP MAIN / MOBILE WRAPPER ───────────────── */}
      <div className="flex flex-1 flex-col min-h-0">

      {/* Mobile-only header */}
      <div className="md:hidden bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/messages')} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm">{isLister ? 'Claimed by someone' : 'Chat with lister'}</p>
            <p className="text-xs text-gray-400">{listing?.title}</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-brand-500' : 'bg-yellow-400'}`} />
        </div>

        {/* Pinned listing (mobile) */}
        {listing && (
          <div className="mx-4 mb-3 bg-gray-50 rounded-2xl p-3 flex gap-3 items-center border border-gray-100">
            {listing.photos[0] ? (
              <img src={resolveAssetUrl(listing.photos[0])} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" alt="" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-xl">🍱</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{listing.title}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>📅 {new Date(listing.expiry_date).toLocaleDateString()}</span>
              </div>
            </div>
            {isComplete ? (
              <span className="badge bg-brand-100 text-brand-700 text-xs">Complete</span>
            ) : (
              <span className="badge bg-yellow-100 text-yellow-700 text-xs">Pickup only</span>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">
            <p>Coordinate pickup time and location here</p>
            {isLister && listing.pickup_address && (
              <p className="mt-2 font-medium text-gray-600">📍 {listing.pickup_address}</p>
            )}
            <p className="mt-1">Both parties must confirm when done</p>
          </div>
        )}
        {messages.map(msg => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
              {!isMine && (
                msg.users?.photo ? (
                  <img src={resolveAssetUrl(msg.users.photo)} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-500">
                    {msg.users?.name?.[0] || '?'}
                  </div>
                )
              )}
              <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMine && <span className="text-[10px] text-gray-400 px-1">{msg.users?.name}</span>}
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMine ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white text-gray-900 shadow-sm rounded-bl-sm'}`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 px-1">{format(parseISO(msg.created_at), 'HH:mm')}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Pickup confirmation banner */}
      {!isComplete && claim.status === 'active' && (
        <div className="mx-4 mb-2">
          {!myConfirmed ? (
            <button onClick={confirmPickup} disabled={confirming}
              className="w-full bg-brand-600 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-sm">
              {confirming ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Confirm pickup complete
            </button>
          ) : !otherConfirmed ? (
            <div className="bg-brand-50 border border-brand-100 rounded-2xl px-4 py-3 text-sm text-brand-700 text-center">
              ✓ You confirmed — waiting for the other party
            </div>
          ) : null}
        </div>
      )}

      {/* Cancel claim (claimer only, active claims) */}
      {!isComplete && claim.status === 'active' && !isLister && (
        <div className="mx-4 mb-2">
          <button
            onClick={cancelClaim}
            disabled={cancelling}
            className="w-full py-2.5 rounded-2xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            {cancelling ? 'Cancelling…' : 'Cancel claim'}
          </button>
        </div>
      )}

      {isComplete && (
        <div className="mx-4 mb-2 bg-brand-50 border border-brand-200 rounded-2xl px-4 py-3 text-center text-sm text-brand-700 font-medium">
          ✅ Exchange complete — thanks for reducing food waste!
        </div>
      )}

      {/* Input */}
      {!isComplete && (
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3">
          <input
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none"
            placeholder="Message…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage} disabled={!input.trim() || sending}
            className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center disabled:opacity-40 flex-shrink-0">
            <Send size={16} className="text-white" />
          </button>
        </div>
      )}

      </div>{/* end desktop main */}

      {/* Rating modal */}
      {(showRating || canRate) && !rated && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⭐</div>
              <h3 className="font-bold text-gray-900">How was the exchange?</h3>
              <p className="text-sm text-gray-500 mt-1">Rate your experience</p>
            </div>
            <div className="flex justify-center mb-4">
              <StarPicker value={stars} onChange={setStars} />
            </div>
            <textarea className="input resize-none mb-4" rows={2} placeholder="Leave a review (optional)"
              value={review} onChange={e => setReview(e.target.value)} />
            <div className="flex gap-3">
              <button className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm" onClick={() => setRated(true)}>
                Skip
              </button>
              <button className="flex-1 btn-primary" onClick={submitRating} disabled={!stars}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {rated && showRating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-3">🙏</div>
            <h3 className="font-bold text-gray-900">Thank you!</h3>
            <p className="text-sm text-gray-500 mt-1">Your feedback helps build community trust</p>
            <button className="btn-primary w-full mt-4" onClick={() => { setShowRating(false); navigate('/messages'); }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
