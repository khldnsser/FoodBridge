import { useState, useEffect } from 'react';
import { Share, X } from 'lucide-react';

export default function AddToHomeScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari in browser mode (not already installed as PWA)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;
    const dismissed = localStorage.getItem('fb_a2hs_dismissed');
    if (isIOS && !isStandalone && !dismissed) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem('fb_a2hs_dismissed', '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-[4.5rem] left-3 right-3 z-50 bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold mb-0.5">Add FoodBridge to your Home Screen</p>
        <p className="text-xs text-gray-300 leading-snug">
          Tap <Share size={11} className="inline mx-0.5 -mt-0.5" /> then <strong>Add to Home Screen</strong> for the full-screen app experience.
        </p>
      </div>
      <button onClick={dismiss} className="text-gray-400 hover:text-white flex-shrink-0 mt-0.5">
        <X size={18} />
      </button>
    </div>
  );
}
