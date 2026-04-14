import { useNavigate } from 'react-router-dom';
import { MapPin, Clock } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import type { Listing } from '../types';
import UserBadge from './UserBadge';
import { StarDisplay } from './StarRating';

interface Props { listing: Listing; }

export default function ListingCard({ listing }: Props) {
  const navigate = useNavigate();
  const daysLeft = differenceInDays(parseISO(listing.expiry_date), new Date());
  const isUrgent = daysLeft <= 2;

  const storageLabel: Record<string, string> = {
    room_temperature: '🌡️ Room temp',
    refrigerated: '❄️ Refrigerated',
    frozen: '🧊 Frozen',
  };

  return (
    <div
      className="card overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      onClick={() => navigate(`/listing/${listing.id}`)}
    >
      {/* Photo */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {listing.photos[0] ? (
          <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🍱</div>
        )}
        {/* Expiry pill */}
        <div className={`absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded-full ${
          isUrgent ? 'bg-orange-500 text-white' : 'bg-white/90 text-gray-700'
        }`}>
          {daysLeft === 0 ? 'Expires today' : daysLeft === 1 ? 'Expires tomorrow' : `${daysLeft}d left`}
        </div>
        {/* Restaurant badge overlay */}
        {listing.user?.role === 'restaurant' && (
          <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            🏪 Business
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 leading-tight mb-1">{listing.title}</h3>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
          <span className="flex items-center gap-1">
            <MapPin size={11} />
            {listing.distance != null ? `${listing.distance.toFixed(1)} km` : listing.neighborhood || 'Nearby'}
          </span>
          <span>{storageLabel[listing.storage_condition] || listing.storage_condition}</span>
        </div>

        {/* Dietary tags */}
        {listing.dietary_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {listing.dietary_tags.map(tag => (
              <span key={tag} className="badge bg-brand-50 text-brand-700 border border-brand-100">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: user info */}
        {listing.user && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div className="flex items-center gap-2">
              {listing.user.photo ? (
                <img src={listing.user.photo} className="w-6 h-6 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-700">
                  {listing.user.name?.[0] || '?'}
                </div>
              )}
              <span className="text-xs text-gray-600 font-medium">{listing.user.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {(listing.user.avg_rating ?? 0) > 0 && (
                <StarDisplay rating={listing.user.avg_rating ?? 0} size={11} />
              )}
              <UserBadge user={listing.user} size="sm" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
