import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import type { Listing } from '../types';
import { StarDisplay } from './StarRating';
import { resolveAssetUrl } from '../lib/assetUrl';

interface Props { listing: Listing; }

export default function ListingCard({ listing }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const daysLeft = differenceInDays(parseISO(listing.expiry_date), new Date());
  const isUrgent = daysLeft <= 2;

  const storageLabel: Record<string, string> = {
    room_temperature: '🌡️ Room temp',
    frozen: '🧊 Frozen',
  };

  // Support both RPC flat fields and joined user object
  const listerName = listing.lister_name ?? (listing as any).user?.name;
  const listerPhoto = listing.lister_photo ?? (listing as any).user?.photo;
  const listerRating = listing.lister_avg_rating ?? (listing as any).user?.avg_rating ?? 0;
  const listerRole = listing.lister_role ?? (listing as any).user?.role;

  return (
    <div
      className="card p-2 cursor-pointer active:scale-[0.98] transition-transform"
      onClick={() => navigate(`/listing/${listing.id}`, { state: { background: location } })}
    >
      {/* Photo */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden rounded-xl mb-2">
        {listing.photos[0] ? (
          <img src={resolveAssetUrl(listing.photos[0])} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🍱</div>
        )}
        <div className={`absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded-full ${
          isUrgent ? 'bg-orange-500 text-white' : 'bg-white/90 text-gray-700'
        }`}>
          {daysLeft === 0 ? 'Expires today' : daysLeft === 1 ? 'Expires tomorrow' : `${daysLeft}d left`}
        </div>
        {listerRole === 'restaurant' && (
          <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            🏪 Business
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-1 pb-1">
        <h3 className="font-semibold text-gray-900 leading-tight mb-1">{listing.title}</h3>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
          <span className="flex items-center gap-1">
            <MapPin size={11} />
            {listing.distance_km != null ? `${listing.distance_km.toFixed(1)} km` : listing.neighborhood || 'Nearby'}
          </span>
          <span>{storageLabel[listing.storage_condition] || listing.storage_condition}</span>
        </div>

        {/* Price display */}
        {(() => {
          const op = listing.original_price ?? null;
          const lp = listing.listing_price ?? 0;
          if (op == null && lp === 0) return null;
          const saving = op != null ? op - lp : null;
          return (
            <div className="flex items-center gap-1.5 mb-2">
              {lp === 0 ? (
                <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">FREE</span>
              ) : (
                <span className="text-xs font-bold text-gray-900">${lp.toFixed(2)}</span>
              )}
              {op != null && (
                <span className="text-xs text-gray-400 line-through">${op.toFixed(2)}</span>
              )}
              {saving != null && saving > 0 && (
                <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                  Save ${saving.toFixed(2)}
                </span>
              )}
            </div>
          );
        })()}

        {listing.dietary_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {listing.dietary_tags.map(tag => (
              <span key={tag} className="badge bg-brand-50 text-brand-700 border border-brand-100">{tag}</span>
            ))}
          </div>
        )}

        {listerName && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div className="flex items-center gap-2">
              {listerPhoto ? (
                <img src={resolveAssetUrl(listerPhoto)} className="w-6 h-6 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-700">
                  {listerName[0]}
                </div>
              )}
              <span className="text-xs text-gray-600 font-medium">{listerName}</span>
            </div>
            {listerRating > 0 && <StarDisplay rating={listerRating} size={11} />}
          </div>
        )}
      </div>
    </div>
  );
}
