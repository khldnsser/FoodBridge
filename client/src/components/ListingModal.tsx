import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import ListingDetail from '../pages/ListingDetail';

export default function ListingModal() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => navigate(-1)}
      />

      {/* Modal card */}
      <div className="relative bg-white w-full md:max-w-3xl md:rounded-2xl md:mx-4 rounded-t-3xl overflow-hidden shadow-2xl max-h-[92vh] md:max-h-[88vh] flex flex-col md:flex-row">
        {/* Close button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 right-4 z-10 w-9 h-9 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <ListingDetail />
      </div>
    </div>
  );
}
