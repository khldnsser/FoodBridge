import { useState, useEffect } from 'react';
import { X, MapPin, Star, ShieldCheck, Store, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveAssetUrl } from '../lib/assetUrl';

interface PopupUser {
  id: string;
  name: string | null;
  username: string;
  photo: string | null;
  neighborhood: string | null;
  role: string;
  total_shared: number;
  total_claimed: number;
  avg_rating: number;
  is_admin: boolean;
  id_verified: boolean;
}

interface PopupRating {
  stars: number;
  review: string;
  created_at: string;
}

interface Props {
  userId: string | null;
  onClose: () => void;
}

export default function UserProfilePopup({ userId, onClose }: Props) {
  const [profileUser, setProfileUser] = useState<PopupUser | null>(null);
  const [ratings, setRatings] = useState<PopupRating[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfileUser(null);
      setRatings([]);
      return;
    }

    setLoading(true);
    setProfileUser(null);
    setRatings([]);

    Promise.all([
      supabase
        .from('users')
        .select('id, name, username, photo, neighborhood, role, total_shared, total_claimed, avg_rating, is_admin, id_verified')
        .eq('id', userId)
        .single(),
      supabase
        .from('ratings')
        .select('stars, review, created_at')
        .eq('ratee_id', userId)
        .order('created_at', { ascending: false })
        .limit(3),
    ]).then(([{ data: u }, { data: r }]) => {
      setProfileUser((u as unknown as PopupUser) || null);
      setRatings((r as unknown as PopupRating[]) || []);
      setLoading(false);
    });
  }, [userId]);

  if (!userId) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <h2 className="font-bold text-gray-900 text-base">User Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !profileUser ? (
          <div className="py-16 text-center text-gray-400 text-sm">User not found</div>
        ) : (
          <div className="px-5 pb-5 pt-4 space-y-4">
            {/* Avatar + name block */}
            <div className="flex items-center gap-4">
              {profileUser.photo ? (
                <img
                  src={resolveAssetUrl(profileUser.photo)}
                  alt={profileUser.name || profileUser.username}
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-100"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-brand-100 flex-shrink-0 flex items-center justify-center text-2xl font-bold text-brand-700 ring-2 ring-gray-100">
                  {(profileUser.name || profileUser.username)?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-base truncate">
                  {profileUser.name || profileUser.username}
                </p>
                <p className="text-sm text-gray-400">@{profileUser.username}</p>
                {/* Role + badges */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {profileUser.role === 'restaurant' ? (
                    <span className="badge bg-orange-100 text-orange-700 text-[10px] flex items-center gap-0.5">
                      <Store size={9} /> Business
                    </span>
                  ) : (
                    <span className="badge bg-gray-100 text-gray-600 text-[10px] flex items-center gap-0.5">
                      <User size={9} /> Individual
                    </span>
                  )}
                  {profileUser.is_admin && (
                    <span className="badge bg-purple-100 text-purple-700 text-[10px]">Admin</span>
                  )}
                  {profileUser.id_verified && (
                    <span className="badge bg-brand-100 text-brand-700 text-[10px] flex items-center gap-0.5">
                      <ShieldCheck size={9} /> ID Verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Neighborhood */}
            {profileUser.neighborhood && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                <span>{profileUser.neighborhood}</span>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-xl p-3">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{profileUser.total_shared}</p>
                <p className="text-[11px] text-gray-500">Shared</p>
              </div>
              <div className="text-center border-x border-gray-200">
                <p className="text-lg font-bold text-gray-900">{profileUser.total_claimed}</p>
                <p className="text-[11px] text-gray-500">Claimed</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900 flex items-center justify-center gap-0.5">
                  {profileUser.avg_rating > 0 ? profileUser.avg_rating.toFixed(1) : '—'}
                  {profileUser.avg_rating > 0 && <Star size={12} className="text-yellow-400 fill-yellow-400" />}
                </p>
                <p className="text-[11px] text-gray-500">Avg rating</p>
              </div>
            </div>

            {/* Recent reviews */}
            {ratings.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent reviews</p>
                <div className="space-y-2">
                  {ratings.map((r, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star
                            key={s}
                            size={11}
                            className={s <= r.stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                          />
                        ))}
                        <span className="text-[10px] text-gray-400 ml-1">
                          {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {r.review && (
                        <p className="text-xs text-gray-600 leading-relaxed">"{r.review}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
