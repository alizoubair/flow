import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { authService } from '../services/auth';
import './AuthPages.css';

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [code, setCode] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { userConfirmed } = await authService.signup({ email, password, name });
      if (userConfirmed) {
        // Already confirmed (e.g. auto-confirm enabled) — go straight to login
        navigate('/login');
      } else {
        // Cognito sent a verification code
        setVerificationSent(true);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.confirmSignup(email, code.trim());
      setConfirmed(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await authService.resendConfirmationCode(email);
      setError('');
      alert('A new code has been sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code.');
    }
  };

  const handleGoogleSignUp = () => {
    try {
      authService.googleAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  const handleGithubSignUp = () => {
    try {
      authService.githubAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub sign-in failed.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-back">
        <Link to="/" className="back-link">
          ← Back to home
        </Link>
      </div>

      <div className="auth-page-inner">
        <div className="auth-container">

          {confirmed ? (
            <div className="auth-header">
              <h1 className="auth-title">Account confirmed!</h1>
              <p className="auth-subtitle">Redirecting you to sign in...</p>
            </div>
          ) : verificationSent ? (
            <>
              <div className="auth-header">
                <h1 className="auth-title">Check your email</h1>
                <p className="auth-subtitle">
                  We sent a 6-digit code to <strong>{email}</strong>. Enter it below to activate your account.
                </p>
              </div>

              <form className="auth-form" onSubmit={handleConfirm}>
                {error && (
                  <div className="auth-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="code">Verification Code</label>
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    required
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? 'Confirming...' : 'Confirm Account'}
                </button>
              </form>

              <div className="auth-footer">
                <p className="auth-footer-text">Didn't receive the code?</p>
                <button className="auth-footer-btn" onClick={handleResend} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  Resend code
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="auth-header">
                <h1 className="auth-title">Create Account</h1>
                <p className="auth-subtitle">Start building your pipelines</p>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                {error && (
                  <div className="auth-error">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="social-auth">
                  <button type="button" className="social-btn" onClick={handleGoogleSignUp}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
                      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                  <button type="button" className="social-btn" onClick={handleGithubSignUp}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    <span>Continue with GitHub</span>
                  </button>
                </div>

                <div className="auth-divider">
                  <span>Or continue with email</span>
                </div>

                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>

              <div className="auth-footer">
                <p className="auth-footer-text">Already have an account?</p>
                <Link to="/login" className="auth-footer-btn">Sign in</Link>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default SignupPage;
