import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import Landing from './pages/Landing';
import Home from './pages/Home';
import CreateListing from './pages/CreateListing';
import ListingDetail from './pages/ListingDetail';
import Messages from './pages/Messages';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import CompleteProfile from './pages/CompleteProfile';
import MyListings from './pages/MyListings';
import MyClaims from './pages/MyClaims';
import MyActivity from './pages/MyActivity';
import ListingModal from './components/ListingModal';

function PrivateLayout() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  if (!user.profile_complete) return <Navigate to="/complete-profile" replace />;
  return <AppShell />;
}

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const background = (location.state as any)?.background;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center">
          <span className="text-2xl">🌱</span>
        </div>
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <>
      <Routes location={background || location}>
        <Route path="/" element={!user ? <Landing /> : <Navigate to="/home" replace />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route element={<PrivateLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/create" element={<CreateListing />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/chat/:claimId" element={<Chat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/my-listings" element={<MyListings />} />
          <Route path="/my-claims" element={<MyClaims />} />
          <Route path="/my-activity" element={<MyActivity />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {background && (
        <Routes>
          <Route path="/listing/:id" element={<ListingModal />} />
        </Routes>
      )}
    </>
  );
}
