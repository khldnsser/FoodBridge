import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

export default function Login() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      setToken(data.token);
      setUser(data.user as User);
      navigate(data.user.profile_complete ? '/home' : '/complete-profile');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Invalid OTP');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white px-6 py-8 max-w-sm mx-auto">
      <button onClick={() => step === 'otp' ? setStep('phone') : navigate('/')} className="p-2 rounded-full hover:bg-gray-100 self-start mb-8">
        <ArrowLeft size={20} />
      </button>

      <div className="flex-1">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center">
            <span className="text-2xl">🌱</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">Welcome back</h1>
            <p className="text-sm text-gray-500">Sign in to FoodBridge</p>
          </div>
        </div>

        {step === 'phone' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone number</label>
            <input
              className="input mb-6" type="tel" placeholder="+961 XX XXX XXX"
              value={phone} onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && requestOtp()}
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button className="btn-primary w-full" onClick={requestOtp} disabled={loading}>
              {loading ? 'Sending…' : 'Send Code'}
            </button>
            <p className="text-center text-sm text-gray-500 mt-6">
              New here?{' '}
              <Link to="/register" className="text-brand-600 font-medium">Create an account</Link>
            </p>
          </div>
        )}

        {step === 'otp' && (
          <div>
            <p className="text-gray-500 mb-4">Sent to {phone}</p>
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
              {loading ? 'Verifying…' : 'Sign In'}
            </button>
            <button className="btn-ghost w-full mt-3" onClick={requestOtp}>Resend code</button>
          </div>
        )}
      </div>
    </div>
  );
}
