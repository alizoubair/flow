import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { User, SignupCredentials, LoginCredentials } from '../types/auth';

export type { User, SignupCredentials, LoginCredentials };

/** Cognito config — set these in .env.local */
const USER_POOL_ID = process.env.REACT_APP_COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.REACT_APP_COGNITO_CLIENT_ID || '';
const COGNITO_DOMAIN = process.env.REACT_APP_COGNITO_DOMAIN || '';
const REDIRECT_URI = process.env.REACT_APP_COGNITO_REDIRECT_URI || `${window.location.origin}/auth/callback`;

const userPool = USER_POOL_ID && CLIENT_ID
  ? new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID })
  : null;

/** Extract a User from a Cognito ID token payload */
function sessionToUser(_cognitoUser: CognitoUser, session: CognitoUserSession): User {
  const payload = session.getIdToken().decodePayload();
  return {
    userId: payload['sub'],
    email: payload['email'] || '',
    name: payload['name'] || payload['cognito:username'] || '',
    avatar: payload['picture'] || '',
  };
}

/** Persist Cognito tokens to localStorage */
function storeSession(session: CognitoUserSession): void {
  localStorage.setItem('flow-access-token', session.getAccessToken().getJwtToken());
  localStorage.setItem('flow-id-token', session.getIdToken().getJwtToken());
  localStorage.setItem('flow-refresh-token', session.getRefreshToken().getToken());
}

/** Clear all auth data from localStorage */
function clearSession(): void {
  localStorage.removeItem('flow-access-token');
  localStorage.removeItem('flow-id-token');
  localStorage.removeItem('flow-refresh-token');
  localStorage.removeItem('flow-user');
  localStorage.removeItem('flow-autosave');
}

/** Auth Service */
export const authService = {

  /**
   * Sign up a new user with email and password.
   * Returns userConfirmed=true if Cognito auto-confirmed the account,
   * false if a verification code was sent to the user's email.
   */
  signup(credentials: SignupCredentials): Promise<{ userConfirmed: boolean }> {
    return new Promise((resolve, reject) => {
      if (!userPool) {
        return reject(new Error('Cognito is not configured. Set REACT_APP_COGNITO_USER_POOL_ID and REACT_APP_COGNITO_CLIENT_ID.'));
      }

      const attributes = [
        new CognitoUserAttribute({ Name: 'email', Value: credentials.email }),
        new CognitoUserAttribute({ Name: 'name', Value: credentials.name }),
      ];

      userPool.signUp(credentials.email, credentials.password, attributes, [], (err, result) => {
        if (err) return reject(new Error(err.message));
        resolve(result?.user ? { userConfirmed: result.userConfirmed ?? false } : { userConfirmed: false });
      });
    });
  },

  /**
   * Confirm signup with the 6-digit verification code sent by Cognito.
   */
  confirmSignup(email: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!userPool) return reject(new Error('Cognito is not configured.'));

      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) return reject(new Error(err.message));
        resolve();
      });
    });
  },

  /**
   * Resend the verification code to the user's email.
   */
  resendConfirmationCode(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!userPool) return reject(new Error('Cognito is not configured.'));

      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

      cognitoUser.resendConfirmationCode((err) => {
        if (err) return reject(new Error(err.message));
        resolve();
      });
    });
  },

  /**
   * Sign in with email and password.
   * Stores tokens in localStorage and returns the authenticated User.
   */
  login(credentials: LoginCredentials): Promise<User> {
    return new Promise((resolve, reject) => {
      if (!userPool) {
        return reject(new Error('Cognito is not configured. Set REACT_APP_COGNITO_USER_POOL_ID and REACT_APP_COGNITO_CLIENT_ID.'));
      }

      const cognitoUser = new CognitoUser({ Username: credentials.email, Pool: userPool });
      const authDetails = new AuthenticationDetails({
        Username: credentials.email,
        Password: credentials.password,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess(session) {
          storeSession(session);
          const user = sessionToUser(cognitoUser, session);
          localStorage.setItem('flow-user', JSON.stringify(user));
          resolve(user);
        },
        onFailure(err) {
          reject(new Error(err.message));
        },
        newPasswordRequired() {
          reject(new Error('A new password is required. Please contact support.'));
        },
      });
    });
  },

  /**
   * Refresh the access token using the Cognito SDK session.
   */
  refreshToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!userPool) return reject(new Error('Cognito is not configured.'));

      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        clearSession();
        return reject(new Error('No active session. Please log in again.'));
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          clearSession();
          return reject(new Error('Session expired. Please log in again.'));
        }
        storeSession(session);
        resolve(session.getAccessToken().getJwtToken());
      });
    });
  },

  /**
   * Sign out the current user from Cognito and clear local session.
   */
  logout(): void {
    if (userPool) {
      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) cognitoUser.signOut();
    }
    clearSession();
  },

  /**
   * Get the current user from localStorage.
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('flow-user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  /**
   * Check if the user has a stored access token.
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('flow-access-token');
  },

  /**
   * Initiate Google OAuth via Cognito Hosted UI.
   */
  googleAuth(): void {
    if (!COGNITO_DOMAIN || !CLIENT_ID) {
      throw new Error('Cognito Hosted UI is not configured. Set REACT_APP_COGNITO_DOMAIN and REACT_APP_COGNITO_CLIENT_ID.');
    }
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: REDIRECT_URI,
      identity_provider: 'Google',
    });
    window.location.href = `${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
  },

  /**
   * Initiate GitHub OAuth via Cognito Hosted UI.
   * GitHub must be configured as a custom OIDC provider in the User Pool.
   */
  githubAuth(): void {
    if (!COGNITO_DOMAIN || !CLIENT_ID) {
      throw new Error('Cognito Hosted UI is not configured. Set REACT_APP_COGNITO_DOMAIN and REACT_APP_COGNITO_CLIENT_ID.');
    }
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: REDIRECT_URI,
      identity_provider: 'GitHub',
    });
    window.location.href = `${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
  },

  /**
   * Handle the Cognito Hosted UI callback at /auth/callback?code=...
   * Exchanges the authorization code for tokens via Cognito's /oauth2/token endpoint.
   */
  async handleOAuthCallback(searchParams: URLSearchParams): Promise<User> {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${searchParams.get('error_description') || error}`);
    }
    if (!code) {
      throw new Error('Missing authorization code in callback.');
    }
    if (!COGNITO_DOMAIN || !CLIENT_ID) {
      throw new Error('Cognito is not configured.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
    });

    const resp = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    const tokens = await resp.json();
    const idTokenPayload = JSON.parse(atob(tokens.id_token.split('.')[1]));

    const user: User = {
      userId: idTokenPayload.sub,
      email: idTokenPayload.email || '',
      name: idTokenPayload.name || idTokenPayload['cognito:username'] || '',
      avatar: idTokenPayload.picture || '',
    };

    localStorage.setItem('flow-access-token', tokens.access_token);
    localStorage.setItem('flow-id-token', tokens.id_token);
    localStorage.setItem('flow-refresh-token', tokens.refresh_token || '');
    localStorage.setItem('flow-user', JSON.stringify(user));

    return user;
  },
};
