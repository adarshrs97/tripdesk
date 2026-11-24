import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Car, Lock, Mail, AlertCircle, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        onLoginSuccess?.();
      } else {
        setErrorMessage(result.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center items-center p-4 sm:p-6 text-ink selection:bg-brand selection:text-white">
      {/* Brand Header */}
      <div className="w-full max-w-md text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand text-white shadow-md mb-4 ring-4 ring-brand/10">
          <Car className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-ink">
          StarCiti Group
        </h1>
        <p className="text-xs sm:text-sm text-ink-soft mt-1.5 font-medium">
          Fleet Operations, Trip Ledger &amp; Contract Billing Desk
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-card border border-line rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-lg font-heading font-bold text-ink flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand" />
            Sign In to Fleet Desk
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            Access is restricted to authorized operators, office staff, and drivers.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-soft mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@starciti.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-paper border border-line rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-soft mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-10 py-2.5 text-xs bg-paper border border-line rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Note */}
        <div className="pt-4 border-t border-line/60 flex items-start gap-2.5 text-[11px] text-ink-soft leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            Protected with Supabase Auth &amp; Row Level Security (RLS). Public registration is disabled; users are invited in-app by administrators.
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-xs text-ink-faint">
        StarCiti Group &bull; M/S City Tours &amp; Travels &bull; Kerala, India
      </div>
    </div>
  );
};
