import React, { useState } from 'react';
import { ShieldCheck, Phone, Lock, User, CreditCard, Clock, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';

export default function AuthPage() {
  const { user, login, register, logout, refreshUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [upiId, setUpiId] = useState('');
  const [errors, setErrors] = useState({});

  // If user is logged in but pending approval, display the Pending Screen
  if (user && user.role === 'volunteer' && !user.approved) {
    const handleRefresh = async () => {
      setRefreshing(true);
      try {
        await refreshUser();
        showSuccess('Checked approval status.');
      } catch (err) {
        showError('Could not refresh status.');
      } finally {
        setRefreshing(false);
      }
    };

    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-card shadow-modal border border-slate-200 dark:border-slate-800 p-8 text-center animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-5 border border-amber-200 dark:border-amber-800">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Approval Pending
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Welcome, <strong className="text-slate-900 dark:text-slate-200">{user.name}</strong>! Your account has been registered and is currently under review by our event organizers. Once approved, you will be able to view and sign up for paid shifts.
          </p>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-left mb-6 space-y-1.5 text-slate-600 dark:text-slate-400">
            <div><span className="font-semibold text-slate-900 dark:text-slate-200">Registered Phone:</span> {user.phone}</div>
            {user.upiId && <div><span className="font-semibold text-slate-900 dark:text-slate-200">UPI ID:</span> {user.upiId}</div>}
            <div><span className="font-semibold text-slate-900 dark:text-slate-200">Status:</span> <span className="text-amber-600 font-semibold">Under Review</span></div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              fullWidth
              loading={refreshing}
              icon={RefreshCw}
              onClick={handleRefresh}
            >
              Check Approval Status
            </Button>
            <Button
              variant="ghost"
              fullWidth
              icon={LogOut}
              onClick={logout}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Handle Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Client-side validations
    const newErrors = {};
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      newErrors.phone = 'Enter a valid 10-digit Indian mobile number';
    }
    if (!password || password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (mode === 'register' && !name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(phone, password);
        showSuccess('Welcome back!');
      } else {
        await register({ name, phone, password, upiId });
        showSuccess('Registration submitted! Awaiting organizer approval.');
      }
    } catch (err) {
      showError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo fill buttons — only shown in development
  const isDev = import.meta.env.DEV;
  const fillDemo = (rolePhone, rolePass) => {
    setMode('login');
    setPhone(rolePhone);
    setPassword(rolePass);
    setErrors({});
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3 shadow-md">
            VH
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            VolunteerHub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fair, transparent staffing & payment tracking for paid events
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-slate-900 rounded-card shadow-card border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8">
          {/* Toggle Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setErrors({}); }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrors({}); }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <Input
                label="Full Name"
                placeholder="e.g. Aarav Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                icon={User}
                required
              />
            )}

            <Input
              label="Mobile Number"
              placeholder="10-digit mobile number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors.phone}
              icon={Phone}
              required
            />

            <Input
              label="Password"
              placeholder="At least 6 characters"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              icon={Lock}
              required
            />

            {mode === 'register' && (
              <>
                <Input
                  label="UPI ID (For Payments)"
                  placeholder="e.g. name@okhdfcbank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  error={errors.upiId}
                  icon={CreditCard}
                  helperText="Earnings from attended shifts will be recorded against this UPI ID."
                />

                <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Organizer Review:</strong> Your profile will be reviewed by an admin before you can sign up for events.
                  </span>
                </div>
              </>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              className="mt-2"
            >
              {mode === 'login' ? 'Sign In to Hub' : 'Create Account'}
            </Button>
          </form>

          {/* Quick Demo Logins — only visible in local development (Vite DEV mode) */}
          {isDev && (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 text-center">
              Dev — Quick Fill
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillDemo('9000000001', 'admin123')}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200/80 dark:border-slate-700 text-left transition-colors"
              >
                <span className="font-bold text-indigo-600 dark:text-indigo-400 block">Admin</span>
                9000000001
              </button>
              <button
                type="button"
                onClick={() => fillDemo('9876543210', 'vol123')}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200/80 dark:border-slate-700 text-left transition-colors"
              >
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block">Volunteer</span>
                9876543210 (Aarav)
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </main>
  );
}

