import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, MapPin, SlidersHorizontal, X, Wifi, WifiOff, LayoutGrid, Map } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import ListingCard from '../components/ListingCard';
import { MultiPinMap } from '../components/ListingMap';
import type { Listing, Notification } from '../types';
import { CATEGORIES, DIETARY_TAGS } from '../types';

const CACHE_KEY = 'foodbridge_feed_cache';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeDietary, setActiveDietary] = useState<string[]>(user?.dietary_prefs || []);
  const [radius, setRadius] = useState(10);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  useEffect(() => {
    window.addEventListener('online', () => setOffline(false));
    window.addEventListener('offline', () => setOffline(true));
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
      () => { setGeoBlocked(true); }
    );
  }, []);

  const fetchListings = useCallback(async () => {
    if (!navigator.onLine) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) setListings(JSON.parse(cached));
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('search_listings_nearby', {
        p_lat: userLat,
        p_lng: userLng,
        p_radius_km: radius,
        p_categories: activeCategory ? [activeCategory] : null,
        p_dietary: activeDietary.length ? activeDietary : null,
        p_search: searchQuery || null,
      });
      if (error) throw error;
      setListings((data as Listing[]) || []);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data || []));
    } catch { /* use cached */ } finally { setLoading(false); }
  }, [userLat, userLng, activeCategory, activeDietary, radius, searchQuery]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter(n => !n.read).length);
    }
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime: new notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifs:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchNotifications(); fetchListings(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications, fetchListings]);

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function markOneRead(id: string, claimId?: string, listingId?: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setShowNotifications(false);
    if (claimId) navigate(`/chat/${claimId}`);
    else if (listingId) navigate(`/listing/${listingId}`, { state: { background: location } });
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Header */}
      <div className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
                <span className="text-sm">🌱</span>
              </div>
              <div>
                <h1 className="font-bold text-gray-900 leading-none">FoodBridge</h1>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <MapPin size={10} />
                  <span>{user?.neighborhood || 'Set your location'}</span>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <h1 className="font-bold text-xl text-gray-900">Browse Food</h1>
              {user?.neighborhood && (
                <div className="flex items-center gap-1 text-sm text-gray-400 mt-0.5">
                  <MapPin size={12} />
                  <span>{user.neighborhood}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {offline ? <WifiOff size={16} className="text-red-400" /> : <Wifi size={16} className="text-brand-500" />}
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2">
                <Bell size={20} className="text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {offline && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-xs text-orange-700 flex items-center gap-2 mb-2">
              <WifiOff size={12} /> You're offline — showing last updated feed
            </div>
          )}

          {geoBlocked && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700 flex items-center gap-2 mb-2">
              <MapPin size={12} /> Location access denied — showing all listings, not sorted by distance
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${showFilters ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              <SlidersHorizontal size={12} /> Filters
            </button>
            <button onClick={() => setViewMode(v => v === 'grid' ? 'map' : 'grid')}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${viewMode === 'map' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              {viewMode === 'map' ? <LayoutGrid size={12} /> : <Map size={12} />}
              {viewMode === 'map' ? 'Grid' : 'Map'}
            </button>
            <button onClick={() => setActiveCategory(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!activeCategory ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              All
            </button>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative mt-2">
            <input
              type="text"
              placeholder="Search listings…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 rounded-full px-4 py-2 text-sm outline-none pr-8"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="bg-white border-t border-gray-100 px-4 md:px-8 py-4 max-w-7xl mx-auto">
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-700 mb-2 block">Dietary filters</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map(tag => (
                  <button key={tag} onClick={() => setActiveDietary(p => p.includes(tag) ? p.filter(x => x !== tag) : [...p, tag])}
                    className={`badge border transition-all ${activeDietary.includes(tag) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:max-w-xs">
              <label className="text-xs font-semibold text-gray-700 mb-2 block">Distance: {radius} km</label>
              <input type="range" min={1} max={30} value={radius} onChange={e => setRadius(Number(e.target.value))}
                className="w-full accent-brand-600" />
            </div>
          </div>
        )}
      </div>

      {/* Notifications dropdown */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setShowNotifications(false)}>
          <div className="absolute top-16 right-4 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-96 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-sm">Notifications</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-brand-600 font-medium">Mark all read</button>}
                <button onClick={() => setShowNotifications(false)}><X size={16} /></button>
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet</div>
            ) : notifications.map(n => (
              <div key={n.id}
                onClick={() => markOneRead(n.id, n.data?.claim_id, n.data?.listing_id)}
                className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-brand-50' : ''}`}>
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map view — full height, outside the padded container */}
      {viewMode === 'map' && !loading && (
        <div className="h-[calc(100vh-200px)] min-h-64">
          <MultiPinMap
            pins={listings
              .filter(l => l.pickup_lat && l.pickup_lng)
              .map(l => ({
                id: l.id,
                lat: Number(l.pickup_lat),
                lng: Number(l.pickup_lng),
                title: l.title,
                photo: l.photos?.[0],
                onClick: () => navigate(`/listing/${l.id}`, { state: { background: location } }),
              }))}
            center={userLat && userLng ? [userLat, userLng] : undefined}
            className="h-full w-full"
          />
        </div>
      )}

      {/* Community banner */}
      {viewMode === 'grid' && !loading && listings.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4">
          <div className="relative overflow-hidden rounded-2xl mb-4 h-36 md:h-44">
            <img
              src="/banner.jpg"
              alt="Fresh food"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            {/* dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/40 to-transparent" />
            <div className="relative z-10 h-full flex flex-col justify-center px-5">
              <p className="text-white font-bold text-lg leading-tight mb-1">
                {listings.length} item{listings.length !== 1 ? 's' : ''} near you 🌱
              </p>
              <p className="text-white/85 text-sm max-w-xs">
                Pick up sealed food from neighbours — reduce waste, help your community
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feed — grid view */}
      <div className={`max-w-7xl mx-auto px-4 md:px-8 py-4 ${viewMode === 'map' ? 'hidden' : ''}`}>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🍽️</div>
            <h3 className="font-semibold text-gray-700 mb-1">Nothing here yet</h3>
            <p className="text-sm text-gray-400">Be the first to share food in your area</p>
            <button onClick={() => navigate('/create')} className="btn-primary mt-6">Share Food</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {listings.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}
