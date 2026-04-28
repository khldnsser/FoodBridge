import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ChevronDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const stats = [
  ['74%', 'of people would use it'],
  ['89%', 'care about food waste'],
  ['86%', 'prefer pickup'],
] as const;

const howItWorks = [
  { icon: '📸', title: 'Post', desc: 'Photo + expiry date required — trust built in' },
  { icon: '🔍', title: 'Browse', desc: 'Find items near you, filtered to your diet' },
  { icon: '🤝', title: 'Claim', desc: 'One tap to claim, then coordinate pickup' },
] as const;

const DIETARY = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-free', 'Nut-free'];
type RegStep = 'credentials' | 'role' | 'profile';
const REG_STEPS: RegStep[] = ['credentials', 'role', 'profile'];

type Mode = 'landing' | 'login' | 'register';

export default function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('landing');

  // ── login state ──────────────────────────────────────────────────────────
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  async function login() {
    if (!identifier.trim()) return setLoginError('Username or email required');
    if (!password) return setLoginError('Password required');
    setLoginError(''); setLoginLoading(true);
    try {
      let email = identifier.trim();
      if (!email.includes('@')) {
        const { data: resolvedEmail, error: rpcErr } = await supabase.rpc('get_email_by_username', { p_username: email });
        if (rpcErr || !resolvedEmail) { setLoginError('Username not found'); setLoginLoading(false); return; }
        email = resolvedEmail as string;
      }
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;
      const { data: profile } = await supabase.from('users').select('profile_complete').eq('id', data.user.id).single();
      navigate(profile?.profile_complete ? '/home' : '/complete-profile');
    } catch (e: any) {
      setLoginError(e.message || 'Sign in failed');
    } finally { setLoginLoading(false); }
  }

  function resetMode() {
    setMode('landing');
    setIdentifier(''); setPassword(''); setShowPassword(false); setLoginError('');
    setRegStep('credentials'); setUsername(''); setEmail(''); setRegPassword('');
    setConfirmPassword(''); setRole('individual'); setName(''); setNeighborhood('');
    setDietaryPrefs([]); setRegError('');
  }

  // ── register state ───────────────────────────────────────────────────────
  const [regStep, setRegStep] = useState<RegStep>('credentials');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [role, setRole] = useState<'individual' | 'restaurant'>('individual');
  const [name, setName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const stepIdx = REG_STEPS.indexOf(regStep);

  function validateCredentials() {
    if (!username.trim()) return 'Username required';
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email address';
    if (regPassword.length < 6) return 'Password must be at least 6 characters';
    if (regPassword !== confirmPassword) return 'Passwords do not match';
    return null;
  }

  function nextRegStep() {
    setRegError('');
    if (regStep === 'credentials') {
      const err = validateCredentials();
      if (err) return setRegError(err);
    }
    setRegStep(REG_STEPS[stepIdx + 1]);
  }

  async function submitRegister() {
    if (!name.trim()) return setRegError('Display name required');
    setRegError(''); setRegLoading(true);
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password: regPassword,
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
      setRegError(e.message || 'Registration failed');
    } finally { setRegLoading(false); }
  }

  // ── shared panel renderers ───────────────────────────────────────────────
  const loginPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-gray-900">Welcome back</span>
        <button onClick={resetMode} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
      <input className="input" placeholder="Username or email" value={identifier}
        onChange={e => setIdentifier(e.target.value)} autoComplete="username"
        onKeyDown={e => e.key === 'Enter' && login()} />
      <div className="relative">
        <input className="input pr-10" type={showPassword ? 'text' : 'password'} placeholder="Password"
          value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
          onKeyDown={e => e.key === 'Enter' && login()} />
        <button type="button" onClick={() => setShowPassword(p => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
      <button className="btn-primary w-full" onClick={login} disabled={loginLoading}>
        {loginLoading ? 'Signing in…' : 'Sign In'}
      </button>
      <p className="text-center text-sm text-gray-500">
        New here?{' '}
        <button onClick={() => { resetMode(); setMode('register'); }} className="text-brand-600 font-medium">
          Create an account
        </button>
      </p>
    </div>
  );

  const registerPanel = (
    <div>
      {/* Back + step dots */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => stepIdx > 0 ? setRegStep(REG_STEPS[stepIdx - 1]) : resetMode()}
          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex gap-1.5">
          {REG_STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${i <= stepIdx ? 'bg-brand-600 w-6' : 'bg-gray-200 w-3'}`} />
          ))}
        </div>
      </div>

      {regStep === 'credentials' && (
        <div className="space-y-3">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">Create your account</h3>
            <p className="text-sm text-gray-500">Already have one?{' '}
              <button onClick={() => { resetMode(); setMode('login'); }} className="text-brand-600 font-medium">Sign in</button>
            </p>
          </div>
          <input className="input" placeholder="Username (e.g. ahmad_k)" value={username}
            onChange={e => setUsername(e.target.value)} autoComplete="username" />
          <input className="input" type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} autoComplete="email" />
          <div className="relative">
            <input className="input pr-10" type={showRegPassword ? 'text' : 'password'}
              placeholder="Password (min 6 chars)" value={regPassword}
              onChange={e => setRegPassword(e.target.value)} autoComplete="new-password" />
            <button type="button" onClick={() => setShowRegPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <input className="input" type={showRegPassword ? 'text' : 'password'}
            placeholder="Confirm password" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password"
            onKeyDown={e => e.key === 'Enter' && nextRegStep()} />
          {regError && <p className="text-red-500 text-sm">{regError}</p>}
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={nextRegStep}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
      )}

      {regStep === 'role' && (
        <div>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">I am a…</h3>
            <p className="text-sm text-gray-500">This determines how your listings are shown</p>
          </div>
          <div className="space-y-2 mb-4">
            {([
              ['individual', '👤', 'Individual', 'Share food from home'],
              ['restaurant', '🏪', 'Restaurant / Business', 'Share surplus from your venue'],
            ] as const).map(([val, icon, label, desc]) => (
              <button key={val} onClick={() => setRole(val)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${role === val ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
                <span className="text-2xl">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </div>
                {role === val && <div className="w-4 h-4 bg-brand-600 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>}
              </button>
            ))}
          </div>
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={nextRegStep}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
      )}

      {regStep === 'profile' && (
        <div className="space-y-3">
          <div className="mb-2">
            <h3 className="font-semibold text-gray-900">Your profile</h3>
            <p className="text-sm text-gray-500">Tell the community who you are</p>
          </div>
          <input className="input" placeholder="Display name *" value={name}
            onChange={e => setName(e.target.value)} />
          <input className="input" placeholder="Neighbourhood (e.g. Hamra)" value={neighborhood}
            onChange={e => setNeighborhood(e.target.value)} />
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Dietary preferences</p>
            <div className="flex flex-wrap gap-1.5">
              {DIETARY.map(tag => (
                <button key={tag} type="button"
                  onClick={() => setDietaryPrefs(p => p.includes(tag) ? p.filter(x => x !== tag) : [...p, tag])}
                  className={`badge border transition-all ${dietaryPrefs.includes(tag) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
          {regError && <p className="text-red-500 text-sm">{regError}</p>}
          <button className="btn-primary w-full" onClick={submitRegister} disabled={regLoading}>
            {regLoading ? 'Creating account…' : 'Create Account'}
          </button>
        </div>
      )}
    </div>
  );

  const isForm = mode === 'login' || mode === 'register';

  return (
    <div className="min-h-screen bg-white">

      {/* ── DESKTOP ─────────────────────────────────────── */}
      <div
        className="hidden md:flex flex-col min-h-screen relative"
        style={{ backgroundImage: 'url(/banner.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {/* Single left-to-right dim — left darker for text legibility, barely touches the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-black/10 pointer-events-none" />

        <header className="relative z-10 flex items-center px-12 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
              <span className="text-lg">🌱</span>
            </div>
            <span className="font-bold text-xl text-white drop-shadow">FoodBridge</span>
          </div>
        </header>

        <section className="relative z-10 flex-1 grid grid-cols-2 items-stretch max-w-7xl mx-auto w-full">
          {/* Left column — text over the dimmed image */}
          <div className="flex flex-col justify-center px-12 py-24">
            <h1 className="text-5xl font-bold text-white leading-tight mb-6 drop-shadow">
              Share surplus food<br />with your community
            </h1>
            <p className="text-xl text-white/85 mb-10 leading-relaxed max-w-lg drop-shadow-sm">
              FoodBridge connects people who have sealed food nearing expiry with neighbors who can use it — completely free.
            </p>
            <div className="flex gap-10 mb-12">
              {stats.map(([num, label]) => (
                <div key={num}>
                  <div className="text-3xl font-bold text-white drop-shadow">{num}</div>
                  <div className="text-sm text-white/75 mt-0.5 max-w-[90px] leading-snug">{label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setMode('register')}
                className={`text-base px-8 rounded-xl font-medium transition-all border-2 py-2.5 ${
                  mode === 'register'
                    ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                    : 'bg-white/15 text-white border-white/60 hover:bg-white/25 backdrop-blur-sm'
                }`}
              >
                Get Started
              </button>
              <button
                onClick={() => setMode('login')}
                className={`text-base px-8 rounded-xl font-medium transition-all border-2 py-2.5 ${
                  mode === 'login'
                    ? 'bg-white text-gray-900 border-white shadow-md'
                    : 'bg-transparent text-white/90 border-white/40 hover:bg-white/10'
                }`}
              >
                Sign In
              </button>
            </div>
          </div>

          {/* Right panel — transparent cards so image shows through */}
          <div className="p-10 flex flex-col justify-center">
            {/* Grid stacking so height never collapses on toggle */}
            <div className="grid" style={{ gridTemplateRows: '1fr', gridTemplateColumns: '1fr' }}>
              {/* How it works */}
              <div
                style={{ gridArea: '1 / 1', transition: 'opacity 0.2s ease, transform 0.2s ease',
                  transform: mode === 'landing' ? 'translateY(0)' : 'translateY(-8px)' }}
                className={`flex flex-col gap-4 ${mode === 'landing' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              >
                {howItWorks.map(({ icon, title, desc }) => (
                  <div key={title} className="flex items-center gap-5 bg-white/20 backdrop-blur-md rounded-2xl p-5 border border-white/30">
                    <span className="text-3xl">{icon}</span>
                    <div>
                      <div className="font-semibold text-white">{title}</div>
                      <div className="text-sm text-white/75 mt-0.5">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Form — mostly opaque so fields are readable, slight transparency */}
              <div
                style={{ gridArea: '1 / 1', transition: 'opacity 0.2s ease, transform 0.2s ease',
                  transform: isForm ? 'translateY(0)' : 'translateY(8px)', alignSelf: 'center' }}
                className={`bg-white/92 backdrop-blur-sm rounded-2xl p-8 shadow-lg ${isForm ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              >
                {mode === 'login' ? loginPanel : registerPanel}
              </div>
            </div>
          </div>
        </section>

        <footer className="relative z-10 px-12 py-6 flex items-center justify-between text-sm text-white/60">
          <span>© 2025 FoodBridge — INDE 412</span>
          <span>Reducing food waste, one share at a time 🌱</span>
        </footer>
      </div>

      {/* ── MOBILE ──────────────────────────────────────── */}
      <div
        className="md:hidden flex flex-col min-h-dvh relative"
        style={{ backgroundImage: 'url(/banner.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {/* Global dark overlay for the whole mobile page */}
        <div className="absolute inset-0 bg-black/55 z-0" />

        {/* Hero — always visible, compact when form is shown */}
        <div
          className="relative z-10 flex flex-col items-center justify-center px-6 text-center"
          style={{
            transition: 'padding 0.25s ease',
            paddingTop: isForm ? '2.5rem' : '4rem',
            paddingBottom: isForm ? '2rem' : '2.5rem',
          }}
        >
          {/* (no per-section overlay needed — global overlay handles it) */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-brand-600/90 rounded-2xl flex items-center justify-center shadow-lg shadow-black/30 mb-4">
              <span className="text-3xl">🌱</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">FoodBridge</h1>
            <p className="text-sm text-white/80 max-w-xs leading-relaxed">
              Share surplus sealed food with your community — for free.
            </p>
          </div>
        </div>

        {/* CTA buttons — only when on landing mode */}
        {!isForm && (
          <div className="relative z-10 px-6 pt-6 pb-4 space-y-3 max-w-sm mx-auto w-full">
            <button onClick={() => setMode('register')} className="btn-primary w-full text-center">
              Get Started — it's free
            </button>
            <button onClick={() => setMode('login')} className="w-full text-center py-2.5 px-4 rounded-xl font-medium border-2 border-white/60 text-white bg-white/10 hover:bg-white/20 transition-all">
              Sign In
            </button>
            <div className="flex flex-col items-center gap-1 pt-3 text-white/40">
              <span className="text-xs">See how it works</span>
              <ChevronDown size={16} className="animate-bounce" />
            </div>
          </div>
        )}

        {/* Form card — shown below hero when mode is login/register */}
        {isForm && (
          <div className="relative z-10 px-6 pt-4 pb-8 max-w-sm mx-auto w-full">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              {mode === 'login' ? loginPanel : registerPanel}
            </div>
          </div>
        )}

        {/* How it works — only shown on landing mode */}
        {!isForm && (
          <div className="relative z-10 px-6 pb-16 space-y-3 max-w-sm mx-auto w-full">
            <div className="flex gap-8 mb-6 justify-center">
              {stats.map(([num, label]) => (
                <div key={num} className="text-center">
                  <div className="text-2xl font-bold text-white">{num}</div>
                  <div className="text-xs text-white/60 mt-0.5 max-w-[70px] leading-tight">{label}</div>
                </div>
              ))}
            </div>
            {howItWorks.map(({ icon, title, desc }) => (
              <div key={title} className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-left border border-white/20">
                <span className="text-2xl">{icon}</span>
                <div>
                  <div className="font-semibold text-white text-sm">{title}</div>
                  <div className="text-xs text-white/70">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
