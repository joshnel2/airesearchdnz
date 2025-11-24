/**
 * Westlaw OAuth 2.0 Integration
 * 
 * SECURITY: This module implements OAuth 2.0 Authorization Code Flow
 * ensuring the Client Secret NEVER reaches the user's browser.
 * 
 * Flow:
 * 1. User clicks "Connect Westlaw" → Redirected to Westlaw Login (Front-Channel)
 * 2. User authenticates with their Westlaw credentials
 * 3. Westlaw returns Authorization Code to our Redirect URI
 * 4. Our server exchanges Code + Client Secret for Access Token (Back-Channel)
 * 5. Access Token stored securely on server, scoped to the user
 * 6. Token used for API requests on behalf of the user
 */

import axios from 'axios';
import { createHash, randomBytes } from 'crypto';

// OAuth Configuration
const WESTLAW_AUTH_URL = process.env.WESTLAW_AUTH_URL || 'https://signin.thomsonreuters.com/oauth2/authorize';
const WESTLAW_TOKEN_URL = process.env.WESTLAW_TOKEN_URL || 'https://signin.thomsonreuters.com/oauth2/token';
const WESTLAW_API_BASE_URL = process.env.WESTLAW_API_BASE_URL || 'https://api.westlaw.com/v1';

// OAuth Credentials (NEVER sent to client)
const CLIENT_ID = process.env.WESTLAW_CLIENT_ID;
const CLIENT_SECRET = process.env.WESTLAW_CLIENT_SECRET; // SECURITY: Server-side only!
const REDIRECT_URI = process.env.WESTLAW_REDIRECT_URI || 'http://localhost:3000/api/westlaw/callback';

export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  issued_at: number; // Timestamp when token was issued
}

export interface OAuthState {
  state: string;
  userId: string;
  timestamp: number;
  codeVerifier?: string; // For PKCE
}

// In-memory state storage (use Redis/Database in production)
const stateStore = new Map<string, OAuthState>();

/**
 * STEP 1: Generate Authorization URL (Front-Channel)
 * 
 * User clicks "Connect Westlaw" and is redirected to this URL.
 * SECURITY: Only includes Client ID (public), never Client Secret.
 */
export function generateAuthorizationUrl(userId: string): {
  authUrl: string;
  state: string;
} {
  if (!CLIENT_ID) {
    throw new Error('WESTLAW_CLIENT_ID not configured');
  }

  // Generate state parameter to prevent CSRF attacks
  const state = randomBytes(32).toString('hex');
  
  // Optional: PKCE for additional security
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Store state for validation on callback
  stateStore.set(state, {
    state,
    userId,
    timestamp: Date.now(),
    codeVerifier,
  });

  // Clean up old states (older than 10 minutes)
  cleanupOldStates();

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state: state,
    scope: 'research.read research.search', // Westlaw scopes
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `${WESTLAW_AUTH_URL}?${params.toString()}`;

  return { authUrl, state };
}

/**
 * STEP 2 & 3: User Authentication and Authorization Grant
 * 
 * These steps happen on Westlaw's servers:
 * - User enters their Westlaw credentials (NEVER seen by our app)
 * - Westlaw validates credentials
 * - Westlaw generates one-time Authorization Code
 * - User redirected back to our app with the code
 */

/**
 * STEP 4: Token Exchange (Back-Channel)
 * 
 * SECURITY CRITICAL: This happens server-to-server.
 * The Client Secret is sent here and NEVER reaches the browser.
 * 
 * @param code - Authorization code from Step 3
 * @param state - State parameter for validation
 * @returns Access token for API calls
 */
export async function exchangeCodeForToken(
  code: string,
  state: string
): Promise<{ token: OAuthToken; userId: string }> {
  // Validate state to prevent CSRF
  const storedState = stateStore.get(state);
  if (!storedState) {
    throw new Error('Invalid or expired state parameter');
  }

  // Check state age (max 10 minutes)
  const stateAge = Date.now() - storedState.timestamp;
  if (stateAge > 10 * 60 * 1000) {
    stateStore.delete(state);
    throw new Error('State parameter expired');
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('OAuth credentials not configured');
  }

  // STEP 4: Exchange authorization code for access token
  // SECURITY: Client Secret is used here (server-to-server only)
  try {
    const response = await axios.post(
      WESTLAW_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET, // NEVER sent to client!
        code_verifier: storedState.codeVerifier || '',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const tokenData: OAuthToken = {
      ...response.data,
      issued_at: Date.now(),
    };

    // Clean up used state
    stateStore.delete(state);

    return {
      token: tokenData,
      userId: storedState.userId,
    };
  } catch (error) {
    console.error('Token exchange failed:', error);
    throw new Error('Failed to exchange authorization code for token');
  }
}

/**
 * Refresh an expired access token
 * 
 * SECURITY: Client Secret used here (back-channel only)
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<OAuthToken> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('OAuth credentials not configured');
  }

  try {
    const response = await axios.post(
      WESTLAW_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET, // NEVER sent to client!
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return {
      ...response.data,
      issued_at: Date.now(),
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw new Error('Failed to refresh access token');
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: OAuthToken): boolean {
  const expiresAt = token.issued_at + token.expires_in * 1000;
  const now = Date.now();
  // Add 5 minute buffer
  return now >= expiresAt - 5 * 60 * 1000;
}

/**
 * Get valid access token (refresh if needed)
 * 
 * SECURITY: All token operations happen server-side
 */
export async function getValidAccessToken(token: OAuthToken): Promise<string> {
  if (isTokenExpired(token)) {
    if (!token.refresh_token) {
      throw new Error('Token expired and no refresh token available');
    }
    const newToken = await refreshAccessToken(token.refresh_token);
    return newToken.access_token;
  }
  return token.access_token;
}

/**
 * Revoke access token (logout)
 * 
 * SECURITY: Client Secret used for revocation (back-channel)
 */
export async function revokeToken(token: string): Promise<boolean> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return false;
  }

  try {
    await axios.post(
      `${WESTLAW_AUTH_URL.replace('/authorize', '/revoke')}`,
      new URLSearchParams({
        token: token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET, // NEVER sent to client!
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return true;
  } catch (error) {
    console.error('Token revocation failed:', error);
    return false;
  }
}

/**
 * Clean up old state entries (prevent memory leak)
 */
function cleanupOldStates(): void {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [state, data] of stateStore.entries()) {
    if (now - data.timestamp > maxAge) {
      stateStore.delete(state);
    }
  }
}

/**
 * Validate OAuth configuration
 */
export function validateOAuthConfig(): {
  configured: boolean;
  missing: string[];
} {
  const required = {
    WESTLAW_CLIENT_ID: CLIENT_ID,
    WESTLAW_CLIENT_SECRET: CLIENT_SECRET,
    WESTLAW_REDIRECT_URI: REDIRECT_URI,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  return {
    configured: missing.length === 0,
    missing,
  };
}

/**
 * SECURITY DOCUMENTATION
 * 
 * OAuth 2.0 Authorization Code Flow Security:
 * 
 * ✅ SECURE (Front-Channel):
 * - Client ID (public identifier)
 * - Redirect URI (registered with Westlaw)
 * - State parameter (CSRF protection)
 * - Code Challenge (PKCE)
 * - Authorization Code (one-time use)
 * 
 * 🔒 SECURE (Back-Channel - Server Only):
 * - Client Secret (NEVER sent to browser)
 * - Access Token exchange
 * - Token refresh
 * - Token revocation
 * 
 * ❌ NEVER Exposed to User:
 * - Client Secret
 * - Other users' access tokens
 * - Refresh tokens (if stored)
 * 
 * User's Browser Flow:
 * 1. Click "Connect" → Redirect to Westlaw (with Client ID)
 * 2. Login at Westlaw (user's credentials stay at Westlaw)
 * 3. Redirect back with Authorization Code
 * 4. Our server exchanges code for token (using Client Secret)
 * 5. Token stored server-side, never sent to browser
 * 6. API calls use token on server behalf of user
 */
