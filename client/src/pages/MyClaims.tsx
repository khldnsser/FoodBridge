import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';
import { resolveAssetUrl } from '../lib/assetUrl';

interface ClaimRow {
  id: string;
  status: string;
  created_at: string;
  pickup_confirmed_claimer: boolean;
  pickup_confirmed_lister: boolean;
  listings: {
    id: string;
    title: string;
    photos: string[];
    expiry_date: string;
    users: { name: string | null; photo: string | null };
  };
}

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-yellow-100 text-yellow-700',
  completed: 'bg-brand-100 text-brand-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function MyClaims() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('claims')
      .select(`
        id, status, created_at,
        pickup_confirmed_claimer, pickup_confirmed_lister,
        listings ( id, title, photos, expiry_date, users ( name, photo ) )
      `)
      .eq('claimer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClaims((data as unknown as ClaimRow[]) || []);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <h1 className="font-bold text-xl text-gray-900">My Claims</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-4 flex gap-3 animate-pulse">
                <div className="w-16 h-16 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag size={48} className="text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-1">No claims yet</h3>
            <p className="text-sm text-gray-400 mb-6">Browse food listings and claim items near you</p>
            <button onClick={() => navigate('/home')} className="btn-primary">Browse food</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {claims.map(c => {
              const lister = c.listings?.users;
              const bothConfirmed = c.pickup_confirmed_claimer && c.pickup_confirmed_lister;

              return (
                <div key={c.id} onClick={() => navigate(`/chat/${c.id}`, { state: { from: '/my-claims' } })}
                  className="card p-4 flex gap-3 cursor-pointer hover:shadow-md transition-all">
                  {c.listings?.photos?.[0] ? (
                    <img src={resolveAssetUrl(c.listings.photos[0])} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center text-2xl">🍱</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 text-sm truncate">{c.listings?.title}</p>
                      <span className={`badge text-[10px] font-semibold flex-shrink-0 capitalize ${STATUS_STYLES[c.status] || 'bg-gray-100 text-gray-500'}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      From {lister?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Claimed {format(parseISO(c.created_at), 'MMM d, yyyy')}
                    </p>
                    {c.status === 'active' && !bothConfirmed && (
                      <p className="text-xs text-yellow-600 mt-1 font-medium">
                        {c.pickup_confirmed_claimer ? 'Waiting for lister confirmation' : 'Pending pickup'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
