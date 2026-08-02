import { useState } from 'react';
import { supabase } from './supabaseClient';

function Auth({ user }) {
  const [mode, setMode] = useState(null); // null | 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError('Account created! You can log in now.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMode(null);
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (user) {
    return (
      <div className="auth-bar">
        <span>👤 {user.email}</span>
        <button className="auth-btn" onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="auth-bar">
        <button className="auth-btn" onClick={() => setMode('login')}>Login</button>
        <button className="auth-btn" onClick={() => setMode('signup')}>Sign Up</button>
      </div>
    );
  }

  return (
    <div className="auth-bar">
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? '...' : mode === 'signup' ? 'Sign Up' : 'Login'}
        </button>
        <button type="button" className="auth-btn cancel" onClick={() => { setMode(null); setError(''); }}>
          Cancel
        </button>
      </form>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}

export default Auth;