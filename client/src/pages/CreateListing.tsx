import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, MapPin, X, CheckCircle } from 'lucide-react';
import api from '../api';
import { CATEGORIES, DIETARY_TAGS, STORAGE_CONDITIONS } from '../types';
import { differenceInDays } from 'date-fns';

type Step = 'photo' | 'details' | 'storage' | 'location' | 'review';

export default function CreateListing() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('photo');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [storage, setStorage] = useState('');
  const [dietary, setDietary] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  const steps: Step[] = ['photo', 'details', 'storage', 'location', 'review'];
  const stepIdx = steps.indexOf(step);
  const stepLabels = ['Photo', 'Details', 'Storage', 'Location', 'Review'];

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - photos.length);
    setPhotos(prev => [...prev, ...newFiles]);
    setPhotoUrls(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
  }

  function removePhoto(i: number) {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
    setPhotoUrls(prev => prev.filter((_, idx) => idx !== i));
  }

  function toggleTag<T>(arr: T[], val: T, setter: (a: T[]) => void) {
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  function useCurrentLocation() {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAddress(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setLocLoading(false);
      },
      () => { setLocLoading(false); setError('Could not get location'); }
    );
  }

  function validateStep() {
    setError('');
    if (step === 'photo' && photos.length === 0) { setError('At least one photo is required'); return false; }
    if (step === 'details') {
      if (!title.trim()) { setError('Title required'); return false; }
      if (!expiryDate) { setError('Expiry date required'); return false; }
      if (new Date(expiryDate) <= new Date()) { setError('Expiry date must be in the future'); return false; }
      if (categories.length === 0) { setError('Select at least one category'); return false; }
    }
    if (step === 'storage' && !storage) { setError('Select a storage condition'); return false; }
    if (step === 'location' && !address.trim()) { setError('Pickup address required'); return false; }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    setStep(steps[stepIdx + 1]);
  }

  async function submit() {
    setError(''); setLoading(true);
    try {
      const form = new FormData();
      photos.forEach(f => form.append('photos', f));
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('expiry_date', expiryDate);
      form.append('categories', JSON.stringify(categories));
      form.append('storage_condition', storage);
      form.append('pickup_address', address.trim());
      form.append('neighborhood', neighborhood.trim());
      form.append('dietary_tags', JSON.stringify(dietary));
      if (lat) form.append('pickup_lat', String(lat));
      if (lng) form.append('pickup_lng', String(lng));

      await api.post('/listings', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate('/home');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create listing');
    } finally { setLoading(false); }
  }

  const daysLeft = expiryDate ? differenceInDays(new Date(expiryDate), new Date()) : null;

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        <button onClick={() => stepIdx > 0 ? setStep(steps[stepIdx - 1]) : navigate('/home')} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900">Share food</h1>
          <p className="text-xs text-gray-400">{stepLabels[stepIdx]} · {stepIdx + 1} of {steps.length}</p>
        </div>
        {/* Step progress */}
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 w-6 rounded-full ${i <= stepIdx ? 'bg-brand-600' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-6 overflow-y-auto">
        {/* STEP 1: Photo */}
        {step === 'photo' && (
          <div>
            <h2 className="text-xl font-bold mb-1">Add photos</h2>
            <p className="text-gray-500 text-sm mb-1">Show the <strong>sealed packaging</strong> clearly</p>
            <p className="text-xs text-gray-400 mb-6">Required — this is our #1 trust feature (76% of users require it)</p>

            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addPhotos(e.target.files)} />

            {photoUrls.length === 0 ? (
              <button onClick={() => fileRef.current?.click()}
                className="w-full aspect-[4/3] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-brand-400 hover:text-brand-500 transition-colors bg-gray-50">
                <Camera size={32} />
                <span className="font-medium">Tap to add photo</span>
                <span className="text-xs">Sealed packaging required</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {photoUrls.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img src={url} className="w-full h-full object-cover" alt="" />
                    <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5">
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ))}
                {photoUrls.length < 5 && (
                  <button onClick={() => fileRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-brand-400">
                    <Camera size={20} />
                  </button>
                )}
              </div>
            )}
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        )}

        {/* STEP 2: Details */}
        {step === 'details' && (
          <div>
            <h2 className="text-xl font-bold mb-6">Item details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input className="input" placeholder="e.g. Sealed Greek yoghurt (500g)" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="input resize-none" rows={3} placeholder="Any additional details…" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry date *</label>
                <input className="input" type="date" min={new Date().toISOString().split('T')[0]} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                {daysLeft !== null && daysLeft <= 2 && (
                  <p className="text-orange-500 text-xs mt-1 flex items-center gap-1">
                    ⚠️ Expires in {daysLeft === 0 ? 'today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`} — claimers will be notified
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button key={cat} type="button" onClick={() => toggleTag(categories, cat, setCategories)}
                      className={`badge border transition-all ${categories.includes(cat) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </div>
        )}

        {/* STEP 3: Storage + Dietary */}
        {step === 'storage' && (
          <div>
            <h2 className="text-xl font-bold mb-6">Storage & diet</h2>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Storage condition *</label>
              <div className="space-y-2">
                {STORAGE_CONDITIONS.map(s => (
                  <button key={s.value} onClick={() => setStorage(s.value)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${storage === s.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
                    <span className="text-2xl">{s.icon}</span>
                    <span className="font-medium text-gray-900">{s.label}</span>
                    {storage === s.value && <CheckCircle size={18} className="ml-auto text-brand-600" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dietary attributes</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleTag(dietary, tag, setDietary)}
                    className={`badge border transition-all ${dietary.includes(tag) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </div>
        )}

        {/* STEP 4: Location */}
        {step === 'location' && (
          <div>
            <h2 className="text-xl font-bold mb-2">Pickup location</h2>
            <p className="text-sm text-gray-500 mb-6">Exact address is only shown to the claimer after a successful claim</p>
            <div className="space-y-3">
              <button onClick={useCurrentLocation} disabled={locLoading}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-brand-200 bg-brand-50 text-brand-700 font-medium">
                <MapPin size={20} />
                {locLoading ? 'Getting location…' : 'Use my current location'}
                {lat && <CheckCircle size={18} className="ml-auto" />}
              </button>
              <p className="text-xs text-center text-gray-400">or enter manually</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full address *</label>
                <input className="input" placeholder="Street, building, area…" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Neighbourhood</label>
                <input className="input" placeholder="e.g. Hamra, Gemmayzeh…" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </div>
        )}

        {/* STEP 5: Review */}
        {step === 'review' && (
          <div>
            <h2 className="text-xl font-bold mb-6">Review & post</h2>
            <div className="card overflow-hidden mb-4">
              {photoUrls[0] && <img src={photoUrls[0]} className="w-full aspect-[4/3] object-cover" alt="" />}
              <div className="p-4">
                <h3 className="font-bold text-gray-900">{title}</h3>
                {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <p>📅 Expires: <span className="font-medium">{new Date(expiryDate).toLocaleDateString()}</span></p>
                  <p>📦 {STORAGE_CONDITIONS.find(s => s.value === storage)?.icon} {STORAGE_CONDITIONS.find(s => s.value === storage)?.label}</p>
                  <p>📍 {address}{neighborhood && ` · ${neighborhood}`}</p>
                </div>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {categories.map(c => <span key={c} className="badge bg-gray-100 text-gray-600">{c}</span>)}
                  </div>
                )}
                {dietary.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {dietary.map(d => <span key={d} className="badge bg-brand-50 text-brand-700 border border-brand-100">{d}</span>)}
                  </div>
                )}
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button className="btn-primary w-full" onClick={submit} disabled={loading}>
              {loading ? 'Posting…' : '🌱 Post listing'}
            </button>
          </div>
        )}
      </div>

      {/* Footer nav */}
      {step !== 'review' && (
        <div className="px-4 pb-6 pt-2 border-t border-gray-100">
          {error && step !== 'photo' && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={next}
            disabled={step === 'photo' && photos.length === 0}>
            Continue <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
