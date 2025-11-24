import { NextRequest, NextResponse } from 'next/server';
import { generateAuthorizationUrl, validateOAuthConfig } from '@/lib/westlaw-oauth';

/**
 * STEP 1: Authorization Request (Front-Channel)
 * 
 * This endpoint initiates the OAuth flow by redirecting the user
 * to Westlaw's authorization server.
 * 
 * SECURITY:
 * - Only sends Client ID (public) to authorization server
 * - Client Secret NEVER leaves the server
 * - State parameter prevents CSRF attacks
 * - PKCE provides additional security
 */
export async function GET(req: NextRequest) {
  try {
    // Validate OAuth configuration
    const config = validateOAuthConfig();
    if (!config.configured) {
      return NextResponse.json(
        {
          error: 'OAuth not configured',
          missing: config.missing,
          message: 'Server administrator must configure: ' + config.missing.join(', '),
        },
        { status: 500 }
      );
    }

    // Get user ID (in production, use proper session management)
    const userId = req.headers.get('x-user-id') || 
                   req.headers.get('x-forwarded-for') || 
                   'default-user';

    // Generate authorization URL with state for security
    const { authUrl, state } = generateAuthorizationUrl(userId);

    // Return the authorization URL
    // The client will redirect the user to this URL
    return NextResponse.json({
      authUrl,
      state, // Client can store this for validation (optional)
    });
  } catch (error) {
    console.error('Authorization request failed:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}

/**
 * OAuth Flow Step 1 Details:
 * 
 * User Journey:
 * 1. User clicks "Connect Westlaw" in the UI
 * 2. Frontend calls this endpoint: GET /api/westlaw/oauth/authorize
 * 3. This endpoint generates authorization URL (includes Client ID, not Secret)
 * 4. Frontend redirects user to authorization URL
 * 5. User arrives at Westlaw login page
 * 
 * What's Sent (Front-Channel - visible to user):
 * ✅ Client ID (public identifier)
 * ✅ Redirect URI (where to return after auth)
 * ✅ State (CSRF protection)
 * ✅ Code Challenge (PKCE for security)
 * ✅ Scope (what permissions requested)
 * 
 * What's NOT Sent:
 * ❌ Client Secret (stays on server)
 * ❌ Any user tokens
 * ❌ Any sensitive data
 */
