import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Step = 'credentials' | 'role' | 'profile';

export default function Register() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('credentials');

  // Credentials step
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Role step
  const [role, setRole] = useState<'individual' | 'restaurant'>('individual');

  // Profile step
  const [name, setName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const DIETARY = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-free', 'Nut-free'];
  const steps: Step[] = ['credentials', 'role', 'profile'];
  const stepIdx = steps.indexOf(step);

  function validateCredentials() {
    if (!username.trim()) return 'Username required';
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email address';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  }

  function nextStep() {
    setError('');
    if (step === 'credentials') {
      const err = validateCredentials();
      if (err) return setError(err);
    }
    setStep(steps[stepIdx + 1]);
  }

  async function submit() {
    if (!name.trim()) return setError('Display name required');
    setError(''); setLoading(true);
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: username.trim() } },
      });
      if (signUpErr) throw signUpErr;
      if (!signUpData.user) throw new Error('Registration failed');

      const { error: profileErr } = await supabase.rpc('register_user', {
        p_username: username.trim(),
        p_name: name.trim(),
        p_neighborhood: neighborhood.trim(),
        p_role: role,
        p_dietary_prefs: dietaryPrefs,
      });
      if (profileErr) throw profileErr;

      navigate('/home');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-white md:bg-gray-50 flex md:items-center md:justify-center md:p-8">
      <div className="flex flex-col flex-1 px-6 py-8 md:flex-none md:w-full md:max-w-md md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-100 md:px-10 md:py-10">

        {/* Back + progress */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => stepIdx > 0 ? setStep(steps[stepIdx - 1]) : navigate('/')}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${i <= stepIdx ? 'bg-brand-600 w-6' : 'bg-gray-200 w-3'}`} />
            ))}
          </div>
        </div>

        {/* Step 1 — Credentials */}
        {step === 'credentials' && (
          <div>
            <h1 className="text-2xl font-bold mb-1">Create your account</h1>
            <p className="text-gray-500 mb-8">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-600 font-medium">Sign in</Link>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  className="input" placeholder="e.g. ahmad_k"
                  value={username} onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  className="input" type="email" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    className="input pr-10" type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  className="input" type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  onKeyDown={e => e.key === 'Enter' && nextStep()}
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
            <button className="btn-primary w-full mt-6 flex items-center justify-center gap-2" onClick={nextStep}>
              Continue <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2 — Role */}
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
                  }`}>
                  <span className="text-3xl">{icon}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{label}</div>
                    <div className="text-sm text-gray-500">{desc}</div>
                  </div>
                  {role === val && <div className="ml-auto w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
                </button>
              ))}
            </div>
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={nextStep}>
              Continue <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 3 — Profile details */}
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
                      }`}>
                      {tag}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Pre-fills your browse filters</p>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button className="btn-primary w-full" onClick={submit} disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
