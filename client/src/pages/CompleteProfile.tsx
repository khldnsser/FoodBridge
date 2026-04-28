import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const DIETARY = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-free', 'Nut-free'];

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [role, setRole] = useState<'individual' | 'restaurant'>('individual');
  const [name, setName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!name.trim()) return setError('Name required');
    if (!user) return;
    setError(''); setLoading(true);
    try {
      const { error: updateErr } = await supabase.from('users').update({
        name: name.trim(),
        neighborhood: neighborhood.trim(),
        role,
        dietary_prefs: dietaryPrefs,
        profile_complete: true,
      }).eq('id', user.id);
      if (updateErr) throw updateErr;
      await refreshUser();
      navigate('/home');
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-white md:bg-gray-50 flex md:items-center md:justify-center md:p-8">
      <div className="flex flex-col flex-1 px-6 py-8 md:flex-none md:w-full md:max-w-md md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-100 md:px-10 md:py-10">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center">
            <span className="text-2xl">🌱</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">Complete your profile</h1>
            <p className="text-sm text-gray-500">Just a few details to get started</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">I am a…</label>
            <div className="grid grid-cols-2 gap-3">
              {(['individual', 'restaurant'] as const).map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${role === r ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>
                  {r === 'individual' ? '👤 Individual' : '🏪 Restaurant'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display name *</label>
            <input className="input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neighbourhood</label>
            <input className="input" placeholder="e.g. Hamra" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dietary preferences</label>
            <div className="flex flex-wrap gap-2">
              {DIETARY.map(tag => (
                <button key={tag} type="button"
                  onClick={() => setDietaryPrefs(p => p.includes(tag) ? p.filter(x => x !== tag) : [...p, tag])}
                  className={`badge border transition-all ${dietaryPrefs.includes(tag) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <button className="btn-primary w-full" onClick={save} disabled={loading}>
          {loading ? 'Saving…' : 'Get Started'}
        </button>
      </div>
    </div>
  );
}
