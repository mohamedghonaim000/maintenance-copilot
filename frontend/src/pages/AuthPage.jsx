import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../api/authApi';
import { useAuthStore } from '../store/useAuthStore';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('technician');
  const { setSession, isLoading, error, setLoading, setError } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e) {
  e.preventDefault();

  if (mode === 'register' && password !== confirmPassword) {
    setError('Passwords do not match');
    return;
  }

  setLoading(true);
  setError(null);

  try {
    if (mode === 'register') {
      await register(email, password, role);
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setError('Registration successful. Please log in.');
      return;
    } else {
      const { token, role: loggedInRole, userId } = await login(email, password);
      setSession({ token, role: loggedInRole, userId });
    }
    navigate('/');
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setPassword('');
    setConfirmPassword('');
    setEmail('');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-text mb-1 text-center">
          {mode === 'login' ? 'Welcome back' : 'Create an account'}
        </h1>
        <p className="text-text-muted text-sm text-center mb-8">
          Field Maintenance Copilot
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent transition-colors"
            />
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-sm text-text-muted mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-1.5">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-accent transition-colors"
                >
                  <option value="technician">Technician</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>
            </>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
          >
            {isLoading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <button
          onClick={switchMode}
          className="w-full text-center text-sm text-text-muted hover:text-text mt-6 transition-colors"
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  );
}
