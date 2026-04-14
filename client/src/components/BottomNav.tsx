import { NavLink, useNavigate } from 'react-router-dom';
import { Home, PlusCircle, MessageCircle, User } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-40 max-w-lg mx-auto">
      <div className="flex items-center justify-around h-16">
        <NavLink to="/home" className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${isActive ? 'text-brand-600' : 'text-gray-400'}`
        }>
          <Home size={22} />
          <span className="text-[10px] font-medium">Home</span>
        </NavLink>

        <button
          onClick={() => navigate('/create')}
          className="flex flex-col items-center gap-0.5 px-4 py-2"
        >
          <div className="bg-brand-600 rounded-full p-2 shadow-md shadow-brand-200">
            <PlusCircle size={22} className="text-white" />
          </div>
          <span className="text-[10px] font-medium text-gray-400">Share</span>
        </button>

        <NavLink to="/messages" className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${isActive ? 'text-brand-600' : 'text-gray-400'}`
        }>
          <MessageCircle size={22} />
          <span className="text-[10px] font-medium">Messages</span>
        </NavLink>

        <NavLink to="/profile" className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${isActive ? 'text-brand-600' : 'text-gray-400'}`
        }>
          <User size={22} />
          <span className="text-[10px] font-medium">Profile</span>
        </NavLink>
      </div>
    </nav>
  );
}
