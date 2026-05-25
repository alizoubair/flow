import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';

/**
 * OAuthCallbackPage
 *
 * Handles the Cognito Hosted UI redirect to /auth/callback?code=...
 * Exchanges the authorization code for tokens and navigates to /canvas.
 */
const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    authService.handleOAuthCallback(params)
      .then(() => {
        navigate('/pipelines', { replace: true });
      })
      .catch((err: Error) => {
        setError(err.message || 'Sign-in failed. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
      });
  }, [location.search, navigate]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px' }}>
        <p style={{ color: '#ef4444', fontSize: '16px' }}>{error}</p>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#6b7280', fontSize: '14px' }}>Completing sign-in...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default OAuthCallbackPage;
