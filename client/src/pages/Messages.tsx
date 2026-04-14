import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import type { Claim } from '../types';
import { format, parseISO } from 'date-fns';

export default function Messages() {
  const navigate = useNavigate();
  const { user, socket } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClaims = async () => {
    try {
      const { data } = await api.get('/claims');
      setClaims(data.claims);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchClaims(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('notification', () => fetchClaims());
    return () => { socket.off('notification'); };
  }, [socket]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-lg mx-auto">
      <div className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/home')} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-gray-900">Messages</h1>
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-4 flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
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
          <div className="space-y-2">
            {claims.map(claim => {
              const isLister = claim.is_lister;
              const other = claim.other_user;
              const bothConfirmed = claim.pickup_confirmed_lister && claim.pickup_confirmed_claimer;

              return (
                <div key={claim.id} onClick={() => navigate(`/chat/${claim.id}`)}
                  className="card p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform">
                  {other?.photo ? (
                    <img src={other.photo} className="w-12 h-12 rounded-full object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-brand-100 flex-shrink-0 flex items-center justify-center text-lg font-bold text-brand-700">
                      {other?.name?.[0] || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-gray-900 text-sm truncate">{other?.name || 'Unknown'}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {format(parseISO(claim.created_at), 'MMM d')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{claim.title}</p>
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

      {/* Bottom nav tabs */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 max-w-lg mx-auto">
        <div className="flex items-center justify-around h-16">
          {[
            { to: '/home', icon: '🏠', label: 'Home' },
            { to: '/create', icon: '➕', label: 'Share' },
            { to: '/messages', icon: '💬', label: 'Messages', active: true },
            { to: '/profile', icon: '👤', label: 'Profile' },
          ].map(tab => (
            <button key={tab.to} onClick={() => navigate(tab.to)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 ${tab.active ? 'text-brand-600' : 'text-gray-400'}`}>
              <span className="text-xl">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
