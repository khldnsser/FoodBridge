import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

const DIETARY = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-free', 'Nut-free'];

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [role, setRole] = useState<'individual' | 'restaurant'>('individual');
  const [name, setName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!name.trim()) return setError('Name required');
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/complete-profile', {
        name: name.trim(), neighborhood: neighborhood.trim(), role, dietary_prefs: dietaryPrefs
      });
      setUser(data.user as User);
      navigate('/home');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white px-6 py-8 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-1">Complete your profile</h1>
      <p className="text-gray-500 mb-8">Just a few details to get started</p>

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
  );
}
