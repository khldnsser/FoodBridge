import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import type { Message, Claim, Listing } from '../types';
import { StarPicker } from '../components/StarRating';
import { STORAGE_CONDITIONS } from '../types';

export default function Chat() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { user, socket } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [rated, setRated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function fetchData() {
    const [msgRes, claimRes] = await Promise.all([
      api.get(`/messages/${claimId}`),
      api.get(`/claims/${claimId}`)
    ]);
    setMessages(msgRes.data.messages);
    setClaim(claimRes.data.claim);
    setListing(claimRes.data.listing);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [claimId]);

  useEffect(() => {
    if (!socket || !claimId) return;
    socket.emit('join-claim', claimId);

    socket.on('message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('pickup_confirmed', ({ by }: { by: string }) => {
      fetchData();
    });

    socket.on('pickup_complete', () => {
      fetchData();
      setShowRating(true);
    });

    return () => {
      socket.emit('leave-claim', claimId);
      socket.off('message');
      socket.off('pickup_confirmed');
      socket.off('pickup_complete');
    };
  }, [socket, claimId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/messages/${claimId}`, { content: input.trim() });
      setMessages(prev => [...prev, data.message]);
      setInput('');
    } catch {} finally { setSending(false); }
  }

  async function confirmPickup() {
    setConfirming(true);
    try {
      const { data } = await api.post(`/claims/${claimId}/confirm`);
      setClaim(data.claim);
      if (data.completed) setShowRating(true);
    } catch {} finally { setConfirming(false); }
  }

  async function submitRating() {
    if (!stars) return;
    try {
      await api.post('/ratings', { claim_id: claimId, stars, review });
      setRated(true);
    } catch {}
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isLister = listing?.user_id === user?.id;
  const iComplete = claim?.status === 'completed';
  const myConfirmed = isLister ? claim?.pickup_confirmed_lister : claim?.pickup_confirmed_claimer;
  const otherConfirmed = isLister ? claim?.pickup_confirmed_claimer : claim?.pickup_confirmed_lister;
  const canRate = iComplete && !rated && !(isLister ? claim?.rated_by_lister : claim?.rated_by_claimer);
  const storage = STORAGE_CONDITIONS.find(s => s.value === listing?.storage_condition);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/messages')} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm">{isLister ? 'Claimed by someone' : 'Chat with lister'}</p>
            <p className="text-xs text-gray-400">{listing?.title}</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${iComplete ? 'bg-brand-500' : 'bg-yellow-400'}`} />
        </div>

        {/* Pinned listing */}
        {listing && (
          <div className="mx-4 mb-3 bg-gray-50 rounded-2xl p-3 flex gap-3 items-center border border-gray-100">
            {listing.photos[0] ? (
              <img src={listing.photos[0]} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" alt="" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-xl">🍱</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{listing.title}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>📅 {new Date(listing.expiry_date).toLocaleDateString()}</span>
                {storage && <span>{storage.icon} {storage.label}</span>}
              </div>
            </div>
            {iComplete ? (
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
            <p className="mt-1">Both parties must confirm when done</p>
          </div>
        )}
        {messages.map(msg => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
              {!isMine && (
                msg.sender_photo ? (
                  <img src={msg.sender_photo} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-500">
                    {msg.sender_name?.[0] || '?'}
                  </div>
                )
              )}
              <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMine && <span className="text-[10px] text-gray-400 px-1">{msg.sender_name}</span>}
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
      {!iComplete && claim?.status === 'active' && (
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

      {/* Complete badge */}
      {iComplete && (
        <div className="mx-4 mb-2 bg-brand-50 border border-brand-200 rounded-2xl px-4 py-3 text-center text-sm text-brand-700 font-medium">
          ✅ Exchange complete — thanks for reducing food waste!
        </div>
      )}

      {/* Input */}
      {!iComplete && (
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
