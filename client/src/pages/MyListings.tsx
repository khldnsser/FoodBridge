import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PlusCircle, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';
import { resolveAssetUrl } from '../lib/assetUrl';

interface MyListing {
  id: string;
  title: string;
  photos: string[];
  expiry_date: string;
  status: string;
  categories: string[];
  created_at: string;
  claim_count?: number;
}

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-brand-100 text-brand-700',
  reserved: 'bg-yellow-100 text-yellow-700',
  claimed:  'bg-green-100 text-green-700',
  expired:  'bg-gray-100 text-gray-500',
  removed:  'bg-red-100 text-red-500',
};

export default function MyListings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('listings')
      .select('id, title, photos, expiry_date, status, categories, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setListings((data as MyListing[]) || []);
        setLoading(false);
      });
  }, [user]);

  async function removeListing(id: string) {
    if (!window.confirm('Remove this listing? It will no longer be visible.')) return;
    await supabase.from('listings').update({ status: 'removed' }).eq('id', id);
    setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'removed' } : l));
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <h1 className="font-bold text-xl text-gray-900">My Listings</h1>
          <button onClick={() => navigate('/create')} className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
            <PlusCircle size={16} /> New
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-4 flex gap-3 animate-pulse">
                <div className="w-16 h-16 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 mb-1">No listings yet</h3>
            <p className="text-sm text-gray-400 mb-6">Share your first food item with the community</p>
            <button onClick={() => navigate('/create')} className="btn-primary">Share food</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {listings.map(l => (
              <div key={l.id} className="card p-4 flex gap-3 cursor-pointer hover:shadow-md transition-all"
                onClick={() => navigate(`/listing/${l.id}`, { state: { background: location, from: '/my-listings' } })}>
                {l.photos[0] ? (
                  <img src={resolveAssetUrl(l.photos[0])} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center text-2xl">🍱</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 text-sm truncate">{l.title}</p>
                    <span className={`badge text-[10px] font-semibold flex-shrink-0 capitalize ${STATUS_STYLES[l.status] || 'bg-gray-100 text-gray-500'}`}>
                      {l.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Expires {format(parseISO(l.expiry_date), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Posted {format(parseISO(l.created_at), 'MMM d')}
                  </p>
                  {l.status === 'active' && (
                    <button
                      onClick={e => { e.stopPropagation(); removeListing(l.id); }}
                      className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
