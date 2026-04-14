import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-20 h-20 bg-brand-600 rounded-3xl flex items-center justify-center shadow-lg shadow-brand-200 mb-6">
          <span className="text-4xl">🌱</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">FoodBridge</h1>
        <p className="text-lg text-gray-500 max-w-xs leading-relaxed">
          Share surplus sealed food with your community — for free.
        </p>

        {/* Stats */}
        <div className="flex gap-8 mt-10 mb-12">
          {[['74%', 'of people would use it'], ['89%', 'care about food waste'], ['86%', 'prefer pickup']].map(([num, label]) => (
            <div key={num} className="text-center">
              <div className="text-2xl font-bold text-brand-600">{num}</div>
              <div className="text-xs text-gray-400 mt-0.5 max-w-[70px] leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="w-full max-w-sm space-y-3 mb-12">
          {[
            ['📸', 'Post', 'Photo + expiry date required — trust built in'],
            ['🔍', 'Browse', 'Find items near you, filtered to your diet'],
            ['🤝', 'Claim', 'One tap to claim, then coordinate pickup'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 text-left">
              <span className="text-2xl">{icon}</span>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{title}</div>
                <div className="text-xs text-gray-500">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-10 space-y-3 max-w-sm mx-auto w-full">
        <button onClick={() => navigate('/register')} className="btn-primary w-full text-center">
          Get Started
        </button>
        <button onClick={() => navigate('/login')} className="btn-secondary w-full text-center">
          Sign In
        </button>
      </div>
    </div>
  );
}
