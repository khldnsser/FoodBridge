import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PlusCircle, MessageCircle, User, Package } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const p = location.pathname;
  const from = (location.state as any)?.from as string | undefined;

  function active(base: string): boolean {
    const fromActivity = from === '/my-activity' || from === '/my-listings' || from === '/my-claims';
    if (base === '/home') return p === '/home' || (p.startsWith('/listing/') && !fromActivity);
    if (base === '/messages') return p === '/messages' || (p.startsWith('/chat/') && !fromActivity);
    if (base === '/my-activity') return p === '/my-activity' || p === '/my-listings' || p === '/my-claims'
      || (p.startsWith('/listing/') && fromActivity)
      || (p.startsWith('/chat/') && fromActivity);
    if (base === '/profile') return p === '/profile' || p.startsWith('/profile/');
    return false;
  }

  function cls(base: string) {
    return `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors ${
      active(base) ? 'text-brand-600' : 'text-gray-400'
    }`;
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-40">
      <div className="flex items-center justify-around h-16">
        <button onClick={() => navigate('/home')} className={cls('/home')}>
          <Home size={22} />
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <button onClick={() => navigate('/messages')} className={cls('/messages')}>
          <MessageCircle size={22} />
          <span className="text-[10px] font-medium">Messages</span>
        </button>

        <button
          onClick={() => navigate('/create')}
          className="flex flex-col items-center gap-0.5 px-3 py-2"
        >
          <div className="bg-brand-600 rounded-full p-2 shadow-md shadow-brand-200">
            <PlusCircle size={22} className="text-white" />
          </div>
          <span className="text-[10px] font-medium text-gray-400">Share</span>
        </button>

        <button onClick={() => navigate('/my-activity')} className={cls('/my-activity')}>
          <Package size={22} />
          <span className="text-[10px] font-medium">Listings</span>
        </button>

        <button onClick={() => navigate('/profile')} className={cls('/profile')}>
          <User size={22} />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </nav>
  );
}
