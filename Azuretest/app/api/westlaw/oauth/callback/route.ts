import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/westlaw-oauth';
import { saveUserOAuthToken } from '@/lib/user-settings';

/**
 * STEP 3 & 4: Authorization Callback (Front-Channel → Back-Channel)
 * 
 * This endpoint handles the redirect back from Westlaw after user authentication.
 * 
 * SECURITY CRITICAL:
 * - Receives one-time Authorization Code from Westlaw (Step 3)
 * - Exchanges code for Access Token using Client Secret (Step 4 - Back-Channel)
 * - Client Secret NEVER sent to browser, only used server-to-server
 * - Access Token stored server-side, NEVER sent to client
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle authorization errors
    if (error) {
      const errorMessage = errorDescription || error;
      console.error('OAuth authorization error:', errorMessage);
      
      // Redirect to frontend with error
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(errorMessage)}`, req.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/?error=Missing authorization code or state', req.url)
      );
    }

    // STEP 4: Exchange authorization code for access token (Back-Channel)
    // SECURITY: This is where Client Secret is used (server-to-server)
    const { token, userId } = await exchangeCodeForToken(code, state);

    // STEP 5: Store Access Token server-side (NEVER sent to browser)
    await saveUserOAuthToken(userId, token);

    // Redirect back to frontend with success
    // NOTE: We do NOT send the access token to the browser
    return NextResponse.redirect(
      new URL('/?oauth=success', req.url)
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'OAuth authentication failed';
    
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorMessage)}`, req.url)
    );
  }
}

/**
 * OAuth Flow Steps 3-5 Details:
 * 
 * User Journey:
 * STEP 2 (at Westlaw):
 * - User enters their Westlaw username and password
 * - Westlaw validates credentials
 * - User sees permission consent screen (if first time)
 * 
 * STEP 3 (Authorization Grant - Front-Channel):
 * - Westlaw generates one-time Authorization Code
 * - Westlaw redirects user back to this callback URL
 * - URL includes: code=XXX&state=YYY
 * - User's browser arrives at this endpoint
 * 
 * STEP 4 (Token Exchange - Back-Channel):
 * - Our server extracts the authorization code
 * - Server makes direct request to Westlaw token endpoint
 * - Request includes: code + Client ID + Client Secret
 * - ⚠️ SECURITY: Client Secret used here (server-to-server only)
 * - Westlaw validates and returns Access Token
 * 
 * STEP 5 (Token Storage):
 * - Access Token received by our server
 * - Token stored in server-side storage (.user-settings/)
 * - Token is scoped to the specific user
 * - Token NEVER sent to user's browser
 * - User redirected to app with success message
 * 
 * What User's Browser Sees:
 * ✅ Authorization code (one-time use, already consumed)
 * ✅ State parameter (for validation)
 * ✅ Success/error redirect
 * 
 * What User's Browser NEVER Sees:
 * ❌ Client Secret
 * ❌ Access Token
 * ❌ Refresh Token
 * ❌ Token details
 * 
 * Subsequent API Calls (Steps 6-7):
 * - User makes research request in frontend
 * - Frontend calls our API (e.g., /api/chat)
 * - Our server retrieves user's token from storage
 * - Our server uses token to call Westlaw API
 * - Our server returns research results to user
 * - Access Token NEVER leaves the server
 */
