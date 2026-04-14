import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MapPin, SlidersHorizontal, X, Wifi, WifiOff } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import ListingCard from '../components/ListingCard';
import BottomNav from '../components/BottomNav';
import type { Listing, Notification } from '../types';
import { CATEGORIES, DIETARY_TAGS } from '../types';

const CACHE_KEY = 'foodbridge_feed_cache';

export default function Home() {
  const navigate = useNavigate();
  const { user, socket } = useAuth();
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

  useEffect(() => {
    window.addEventListener('online', () => setOffline(false));
    window.addEventListener('offline', () => setOffline(true));
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
      () => {}
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
      const params: Record<string, string> = { radius: String(radius) };
      if (userLat && userLng) { params.lat = String(userLat); params.lng = String(userLng); }
      if (activeCategory) params.categories = activeCategory;
      if (activeDietary.length) params.dietary = activeDietary.join(',');
      const { data } = await api.get('/listings', { params });
      setListings(data.listings);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data.listings));
    } catch { /* use cached */ } finally { setLoading(false); }
  }, [userLat, userLng, activeCategory, activeDietary, radius]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.notifications.filter((n: Notification) => !n.read).length);
    } catch {}
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    if (!socket) return;
    socket.on('notification', () => { fetchNotifications(); fetchListings(); });
    return () => { socket.off('notification'); };
  }, [socket, fetchNotifications, fetchListings]);

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
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

          {/* Offline banner */}
          {offline && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-xs text-orange-700 flex items-center gap-2 mb-2">
              <WifiOff size={12} /> You're offline — showing last updated feed
            </div>
          )}

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${showFilters ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              <SlidersHorizontal size={12} /> Filters
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
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-white border-t border-gray-100 px-4 py-4 max-w-lg mx-auto">
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
            <div>
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
                onClick={() => {
                  api.patch(`/notifications/${n.id}/read`);
                  setShowNotifications(false);
                  if (n.data?.claim_id) navigate(`/chat/${n.data.claim_id}`);
                  else if (n.data?.listing_id) navigate(`/listing/${n.data.listing_id}`);
                }}
                className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-brand-50' : ''}`}>
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
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
          <div className="grid grid-cols-2 gap-3">
            {listings.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
