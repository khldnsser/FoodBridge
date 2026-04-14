import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

type Step = 'phone' | 'otp' | 'role' | 'profile';

export default function Register() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [role, setRole] = useState<'individual' | 'restaurant'>('individual');
  const [name, setName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setLocalToken] = useState('');

  const DIETARY = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-free', 'Nut-free'];

  async function requestOtp() {
    if (!phone.trim()) return setError('Phone number required');
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/request-otp', { phone: phone.trim() });
      setDemoOtp(data.demo_otp);
      setStep('otp');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to send OTP');
    } finally { setLoading(false); }
  }

  async function verifyOtp() {
    if (!otp.trim()) return setError('Enter the OTP');
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone: phone.trim(), code: otp.trim() });
      setLocalToken(data.token);
      if (data.user.profile_complete) {
        setToken(data.token);
        setUser(data.user as User);
        navigate('/home');
      } else {
        setStep('role');
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Invalid OTP');
    } finally { setLoading(false); }
  }

  async function completeProfile() {
    if (!name.trim()) return setError('Name required');
    setError(''); setLoading(true);
    try {
      // Temporarily set token for this request
      localStorage.setItem('token', token);
      const { data } = await api.post('/auth/complete-profile', {
        name: name.trim(), neighborhood: neighborhood.trim(), role, dietary_prefs: dietaryPrefs
      });
      setToken(token);
      setUser(data.user as User);
      navigate('/home');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save profile');
      localStorage.removeItem('token');
    } finally { setLoading(false); }
  }

  const steps: Step[] = ['phone', 'otp', 'role', 'profile'];
  const stepIdx = steps.indexOf(step);

  return (
    <div className="min-h-screen flex flex-col bg-white px-6 py-8 max-w-sm mx-auto">
      {/* Back */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => stepIdx > 0 ? setStep(steps[stepIdx - 1]) : navigate('/')} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        {/* Progress dots */}
        <div className="flex gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${i <= stepIdx ? 'bg-brand-600 w-6' : 'bg-gray-200 w-3'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1">
        {step === 'phone' && (
          <div>
            <h1 className="text-2xl font-bold mb-1">Join FoodBridge</h1>
            <p className="text-gray-500 mb-8">Enter your phone number to get started</p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone number</label>
            <input
              className="input mb-2" type="tel" placeholder="+961 XX XXX XXX"
              value={phone} onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && requestOtp()}
            />
            <p className="text-xs text-gray-400 mb-6">We'll send a 6-digit code to verify your number</p>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button className="btn-primary w-full" onClick={requestOtp} disabled={loading}>
              {loading ? 'Sending…' : 'Send Code'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div>
            <h1 className="text-2xl font-bold mb-1">Enter code</h1>
            <p className="text-gray-500 mb-4">Sent to {phone}</p>
            {/* Demo OTP callout */}
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 mb-6">
              <p className="text-xs text-brand-700 font-medium">Demo mode — your OTP is:</p>
              <p className="text-2xl font-bold text-brand-600 tracking-widest mt-1">{demoOtp}</p>
            </div>
            <input
              className="input text-2xl tracking-widest text-center mb-6" type="text" maxLength={6}
              placeholder="000000" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && verifyOtp()}
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button className="btn-primary w-full" onClick={verifyOtp} disabled={loading}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button className="btn-ghost w-full mt-3" onClick={requestOtp}>Resend code</button>
          </div>
        )}

        {step === 'role' && (
          <div>
            <h1 className="text-2xl font-bold mb-1">I am a…</h1>
            <p className="text-gray-500 mb-8">This determines how your listings are shown</p>
            <div className="space-y-3 mb-8">
              {([
                ['individual', '👤', 'Individual', 'Share food from home'],
                ['restaurant', '🏪', 'Restaurant / Business', 'Share surplus from your venue'],
              ] as const).map(([val, icon, label, desc]) => (
                <button key={val} onClick={() => setRole(val)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                    role === val ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-3xl">{icon}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{label}</div>
                    <div className="text-sm text-gray-500">{desc}</div>
                  </div>
                  {role === val && <div className="ml-auto w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
                </button>
              ))}
            </div>
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => setStep('profile')}>
              Continue <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 'profile' && (
          <div>
            <h1 className="text-2xl font-bold mb-1">Your profile</h1>
            <p className="text-gray-500 mb-8">Tell the community who you are</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display name *</label>
                <input className="input" placeholder="e.g. Ahmad" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Neighbourhood</label>
                <input className="input" placeholder="e.g. Hamra, Ashrafieh…" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dietary preferences</label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY.map(tag => (
                    <button key={tag} type="button"
                      onClick={() => setDietaryPrefs(p => p.includes(tag) ? p.filter(x => x !== tag) : [...p, tag])}
                      className={`badge border transition-all ${
                        dietaryPrefs.includes(tag) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Pre-fills your browse filters</p>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button className="btn-primary w-full" onClick={completeProfile} disabled={loading}>
              {loading ? 'Saving…' : 'Create Account'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
