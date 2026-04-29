import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, MapPin, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, DIETARY_TAGS } from '../types';
import { differenceInDays } from 'date-fns';
import { resolveAssetUrl } from '../lib/assetUrl';

type Step = 'photo' | 'details' | 'location' | 'review';

export default function CreateListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('photo');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [originalPrice, setOriginalPrice] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  const steps: Step[] = ['photo', 'details', 'location', 'review'];
  const stepIdx = steps.indexOf(step);
  const stepLabels = ['Photo', 'Details', 'Location', 'Review'];

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
      pos => {
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
    if (step === 'location' && !address.trim()) { setError('Pickup address required'); return false; }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    setStep(steps[stepIdx + 1]);
  }

  async function submit() {
    if (!user) return;
    setError(''); setLoading(true);
    try {
      // Upload photos to Supabase Storage
      const uploadedUrls: string[] = [];
      for (const photo of photos) {
        const ext = photo.name.split('.').pop();
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('listing-photos')
          .upload(path, photo, { contentType: photo.type });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('listing-photos').getPublicUrl(path);
        uploadedUrls.push(resolveAssetUrl(publicUrl));
      }

      // Insert listing
      const { error: insertErr } = await supabase.from('listings').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        photos: uploadedUrls,
        expiry_date: expiryDate,
        categories,
        pickup_address: address.trim(),
        pickup_lat: lat,
        pickup_lng: lng,
        neighborhood: neighborhood.trim(),
        dietary_tags: dietary,
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        listing_price: isFree ? 0 : (listingPrice ? parseFloat(listingPrice) : 0),
      });
      if (insertErr) throw insertErr;

      navigate('/home');
    } catch (e: any) {
      setError(e.message || 'Failed to create listing');
    } finally { setLoading(false); }
  }

  const daysLeft = expiryDate ? differenceInDays(new Date(expiryDate), new Date()) : null;

  return (
    <div className="min-h-screen bg-white md:bg-gray-50 md:flex md:items-start md:justify-center md:py-8 md:px-4">
      <div className="flex flex-col w-full md:max-w-2xl md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-100 min-h-screen md:min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <button onClick={() => stepIdx > 0 ? setStep(steps[stepIdx - 1]) : navigate('/home')} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">Share food</h1>
            <p className="text-xs text-gray-400">{stepLabels[stepIdx]} · {stepIdx + 1} of {steps.length}</p>
          </div>
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
              <p className="text-gray-500 text-sm mb-1">Show the <strong>sealed packaging</strong> clearly — up to <strong>5 photos</strong></p>
              <p className="text-xs text-gray-400 mb-6">Required — this is our #1 trust feature (76% of users require it)</p>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addPhotos(e.target.files)} />
              {photoUrls.length === 0 ? (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full aspect-[4/3] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-brand-400 hover:text-brand-500 transition-colors bg-gray-50">
                  <Camera size={32} />
                  <span className="font-medium">Tap to add photos</span>
                  <span className="text-xs">You can select multiple at once · up to 5</span>
                </button>
              ) : (
                <div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {photoUrls.map((url, i) => (
                      <div key={i} className={`relative rounded-xl overflow-hidden bg-gray-100 ${i === 0 ? 'col-span-3 aspect-[4/3]' : 'aspect-square'}`}>
                        <img src={url} className="w-full h-full object-cover" alt="" />
                        {i === 0 && (
                          <span className="absolute bottom-2 left-2 text-[10px] bg-black/50 text-white px-2 py-0.5 rounded-full font-medium">Cover</span>
                        )}
                        <button onClick={() => removePhoto(i)} className="absolute top-1.5 right-1.5 bg-black/50 rounded-full p-1">
                          <X size={12} className="text-white" />
                        </button>
                      </div>
                    ))}
                    {photoUrls.length < 5 && (
                      <button onClick={() => fileRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-brand-400">
                        <Camera size={20} />
                        <span className="text-[10px]">Add more</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 text-center">{photoUrls.length}/5 photos · first photo is the cover</p>
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
                    <p className="text-orange-500 text-xs mt-1">
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

                {/* Pricing */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pricing</label>
                  <div className="flex gap-2 mb-3">
                    <button type="button" onClick={() => setIsFree(true)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${isFree ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}>
                      🎁 Free
                    </button>
                    <button type="button" onClick={() => setIsFree(false)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${!isFree ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}>
                      💰 Set a price
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Original market price (optional — shows as crossed-out)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input className="input pl-7" type="number" min="0" step="0.01" placeholder="e.g. 8.50"
                          value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} />
                      </div>
                    </div>
                    {!isFree && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Your asking price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input className="input pl-7" type="number" min="0" step="0.01" placeholder="e.g. 2.00"
                            value={listingPrice} onChange={e => setListingPrice(e.target.value)} />
                        </div>
                      </div>
                    )}
                    {originalPrice && isFree && (
                      <p className="text-xs text-brand-600 font-medium">
                        🎉 You're giving away ${ parseFloat(originalPrice || '0').toFixed(2) } worth of food for free!
                      </p>
                    )}
                    {originalPrice && !isFree && listingPrice && (
                      <p className="text-xs text-brand-600 font-medium">
                        🏷️ Claimers save ${(parseFloat(originalPrice || '0') - parseFloat(listingPrice || '0')).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {/* Dietary attributes */}
              <div className="mt-4">
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

          {/* STEP 3: Location */}
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
    </div>
  );
}
