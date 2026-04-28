import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Home, PlusCircle, MessageCircle, Settings, LogOut, Package, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveAssetUrl } from '../lib/assetUrl';

export default function SideNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const p = location.pathname;
  const from = (location.state as any)?.from as string | undefined;

  function active(base: string): boolean {
    const fromActivity = from === '/my-activity' || from === '/my-listings' || from === '/my-claims';
    if (base === '/home') return p === '/home' || (p.startsWith('/listing/') && !fromActivity);
    if (base === '/messages') return p === '/messages' || (p.startsWith('/chat/') && !fromActivity);
    if (base === '/my-listings') return p === '/my-listings' || p === '/create' || p === '/my-activity'
      || (p.startsWith('/listing/') && fromActivity)
      || (p.startsWith('/chat/') && fromActivity);
    if (base === '/my-claims') return p === '/my-claims';
    if (base === '/profile') return p === '/profile' || p.startsWith('/profile/');
    if (base === '/admin') return p === '/admin';
    return false;
  }

  function linkClass(base: string) {
    return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      active(base)
        ? 'bg-brand-50 text-brand-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;
  }

  return (
    <div className="flex flex-col h-full px-3 py-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8 px-3">
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
          <span className="text-lg">🌱</span>
        </div>
        <span className="font-bold text-lg text-gray-900">FoodBridge</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5">
        <Link to="/home" className={linkClass('/home')}><Home size={20} /> Home</Link>
        <Link to="/messages" className={linkClass('/messages')}><MessageCircle size={20} /> Messages</Link>
        <Link to="/my-listings" className={linkClass('/my-listings')}><Package size={20} /> My Listings</Link>
        <Link to="/my-claims" className={linkClass('/my-claims')}><ShoppingBag size={20} /> My Claims</Link>

        <button
          onClick={() => navigate('/create')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 transition-colors mt-3"
        >
          <PlusCircle size={20} />
          Share food
        </button>

        {user?.is_admin && (
          <Link to="/admin" className={linkClass('/admin') + ' mt-0.5'}>
            <Settings size={20} /> Admin
          </Link>
        )}
      </nav>

      {/* User footer */}
      {user && (
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={() => navigate('/profile')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl mb-1 transition-colors hover:bg-gray-100 ${active('/profile') ? 'bg-brand-50' : ''}`}
          >
            {user.photo ? (
              <img src={resolveAssetUrl(user.photo)} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-100 flex-shrink-0 flex items-center justify-center text-sm font-bold text-brand-700">
                {user.name?.[0] || '?'}
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.neighborhood || user.email}</p>
            </div>
          </button>
          <button
            onClick={() => { logout().then(() => navigate('/')); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
