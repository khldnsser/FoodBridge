import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import SideNav from './SideNav';
import AddToHomeScreen from './AddToHomeScreen';

export default function AppShell() {
  return (
    <>
      {/* Fixed sidebar — desktop only */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col lg:bg-white lg:border-r lg:border-gray-100 lg:z-40">
        <SideNav />
      </aside>

      {/* Content area — offset by sidebar width on desktop */}
      <div className="lg:pl-60">
        <Outlet />
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* iOS Safari — add to home screen hint */}
      <AddToHomeScreen />
    </>
  );
}
