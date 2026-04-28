import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!identifier.trim()) return setError('Username or email required');
    if (!password) return setError('Password required');
    setError(''); setLoading(true);
    try {
      let email = identifier.trim();

      // If not an email, resolve username → email via RPC
      if (!email.includes('@')) {
        const { data: resolvedEmail, error: rpcErr } = await supabase
          .rpc('get_email_by_username', { p_username: email });
        if (rpcErr || !resolvedEmail) {
          setError('Username not found');
          setLoading(false);
          return;
        }
        email = resolvedEmail as string;
      }

      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;

      // Check if profile is complete
      const { data: profile } = await supabase
        .from('users')
        .select('profile_complete')
        .eq('id', data.user.id)
        .single();

      navigate(profile?.profile_complete ? '/home' : '/complete-profile');
    } catch (e: any) {
      setError(e.message || 'Sign in failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-white md:bg-gray-50 flex md:items-center md:justify-center md:p-8">
      <div className="flex flex-col flex-1 px-6 py-8 md:flex-none md:w-full md:max-w-md md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-100 md:px-10 md:py-10">

        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center">
            <span className="text-2xl">🌱</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">Welcome back</h1>
            <p className="text-sm text-gray-500">Sign in to FoodBridge</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username or email</label>
            <input
              className="input" placeholder="username or you@example.com"
              value={identifier} onChange={e => setIdentifier(e.target.value)}
              autoComplete="username"
              onKeyDown={e => e.key === 'Enter' && login()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                className="input pr-10" type={showPassword ? 'text' : 'password'}
                placeholder="password"
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && login()}
              />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

        <button className="btn-primary w-full mt-6" onClick={login} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-6">
          New here?{' '}
          <Link to="/register" className="text-brand-600 font-medium">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
