import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';
import { resolveAssetUrl } from '../lib/assetUrl';
import UserProfilePopup from '../components/UserProfilePopup';

interface ClaimRow {
  id: string;
  listing_id: string;
  claimer_id: string;
  status: string;
  pickup_confirmed_lister: boolean;
  pickup_confirmed_claimer: boolean;
  created_at: string;
  listings: {
    title: string;
    user_id: string;
    users: { name: string | null; photo: string | null };
  };
  users: { name: string | null; photo: string | null };
}

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchClaims = async () => {
    if (!user) return;

    // First get user's own listing IDs so we can include them in the filter
    const { data: myListings } = await supabase
      .from('listings')
      .select('id')
      .eq('user_id', user.id);

    const myListingIds = (myListings || []).map(l => l.id);

    let query = supabase
      .from('claims')
      .select(`
        id, listing_id, claimer_id, status,
        pickup_confirmed_lister, pickup_confirmed_claimer, created_at,
        listings ( title, user_id, users ( name, photo ) ),
        users ( name, photo )
      `)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (myListingIds.length > 0) {
      query = query.or(`claimer_id.eq.${user.id},listing_id.in.(${myListingIds.join(',')})`);
    } else {
      query = query.eq('claimer_id', user.id);
    }

    const { data } = await query;
    if (data) setClaims(data as unknown as ClaimRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchClaims(); }, [user]);

  // Realtime: refresh on new message/claim update
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchClaims)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, fetchClaims)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <h1 className="font-bold text-xl text-gray-900">Messages</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-4 flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-20">
            <MessageCircle size={48} className="text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-1">No messages yet</h3>
            <p className="text-sm text-gray-400">When you claim or share food, your chats appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {claims.map(claim => {
              const isLister = claim.listings?.user_id === user?.id;
              const other = isLister ? claim.users : claim.listings?.users;
              const bothConfirmed = claim.pickup_confirmed_lister && claim.pickup_confirmed_claimer;

              const otherUserId = isLister ? claim.claimer_id : claim.listings?.user_id;

              return (
                <div key={claim.id} onClick={() => navigate(`/chat/${claim.id}`)}
                  className="card p-4 flex items-center gap-3 cursor-pointer hover:shadow-md active:scale-[0.98] transition-all">
                  {/* Avatar — clicking opens user profile popup */}
                  <button
                    className="flex-shrink-0 focus:outline-none"
                    onClick={e => { e.stopPropagation(); if (otherUserId) setSelectedUserId(otherUserId); }}
                    aria-label={`View ${other?.name || 'user'}'s profile`}
                  >
                    {other?.photo ? (
                      <img src={resolveAssetUrl(other.photo)} className="w-12 h-12 rounded-full object-cover hover:ring-2 hover:ring-brand-400 transition-all" alt="" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-lg font-bold text-brand-700 hover:ring-2 hover:ring-brand-400 transition-all">
                        {other?.name?.[0] || '?'}
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      {/* Name — clicking also opens popup */}
                      <button
                        className="font-semibold text-gray-900 text-sm truncate hover:text-brand-600 transition-colors focus:outline-none"
                        onClick={e => { e.stopPropagation(); if (otherUserId) setSelectedUserId(otherUserId); }}
                      >
                        {other?.name || 'Unknown'}
                      </button>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {format(parseISO(claim.created_at), 'MMM d')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{claim.listings?.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge text-[10px] ${isLister ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                        {isLister ? 'You shared' : 'You claimed'}
                      </span>
                      {bothConfirmed && <span className="badge bg-brand-50 text-brand-600 text-[10px]">✓ Complete</span>}
                      {!bothConfirmed && (claim.pickup_confirmed_lister || claim.pickup_confirmed_claimer) && (
                        <span className="badge bg-orange-50 text-orange-600 text-[10px]">Awaiting confirmation</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <UserProfilePopup userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </div>
  );
}
