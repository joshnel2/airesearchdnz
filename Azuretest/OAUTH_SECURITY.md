# OAuth 2.0 Security Architecture

## Overview

This document details the secure OAuth 2.0 Authorization Code Flow implementation for Westlaw API integration, ensuring the **Client Secret never reaches the user's browser** and all sensitive operations happen server-side.

## Security Principles

### ✅ What Users CAN See (Front-Channel - Browser)
- Client ID (public identifier)
- Redirect URI (registered callback URL)
- State parameter (CSRF protection)
- Authorization code (one-time use, short-lived)

### 🔒 What Stays on Server (Back-Channel - Server-to-Server)
- **Client Secret** ⚠️ NEVER sent to browser
- Access tokens
- Refresh tokens
- Token exchange operations

### ❌ What Users NEVER See
- Client Secret
- Other users' access tokens
- Refresh tokens
- Server-side token storage

## OAuth 2.0 Authorization Code Flow

### Complete Flow Diagram

```
┌──────────────┐
│              │
│   User (👤)  │
│   Browser    │
│              │
└───────┬──────┘
        │
        │ 1. Click "Connect Westlaw"
        │
        ▼
┌────────────────────────────────────────┐
│                                        │
│  Legal Research Tool (Our Application) │
│  GET /api/westlaw/oauth/authorize      │
│                                        │
└───────┬────────────────────────────────┘
        │
        │ 2. Return authUrl with:
        │    • Client ID (public)
        │    • Redirect URI
        │    • State (CSRF protection)
        │    • Code Challenge (PKCE)
        │    ⚠️ NO Client Secret!
        │
        ▼
┌──────────────┐
│   User (👤)  │  3. Redirect to Westlaw
│   Browser    │────────────────────────┐
└──────────────┘                        │
                                        │
                                        ▼
                        ┌──────────────────────────────┐
                        │                              │
                        │  Thomson Reuters Westlaw     │
                        │  Authorization Server        │
                        │  signin.thomsonreuters.com   │
                        │                              │
                        └───────┬──────────────────────┘
                                │
                                │ 4. User enters THEIR
                                │    Westlaw username & password
                                │    (Credentials stay at Westlaw)
                                │
                                ▼
                        ┌──────────────────┐
                        │ User Authenticates│
                        │ Grants Permission │
                        └───────┬───────────┘
                                │
                                │ 5. Westlaw generates
                                │    one-time Authorization Code
                                │
                                ▼
┌──────────────┐
│   User (👤)  │  6. Redirect to callback with code
│   Browser    │◄───────────────────────
└───────┬──────┘
        │
        │ GET /api/westlaw/oauth/callback?code=XXX&state=YYY
        │
        ▼
┌─────────────────────────────────────────────────┐
│                                                 │
│  Our Application Server (Back-Channel)         │
│  /api/westlaw/oauth/callback                   │
│                                                 │
│  ⚠️ SECURITY CRITICAL: Client Secret used here │
│                                                 │
└───────┬─────────────────────────────────────────┘
        │
        │ 7. Exchange code for token (Server-to-Server)
        │    POST to Westlaw Token Endpoint with:
        │    • Authorization Code
        │    • Client ID
        │    • Client Secret ⚠️ (Server-side only!)
        │    • Redirect URI
        │    • Code Verifier (PKCE)
        │
        ▼
┌──────────────────────────────┐
│                              │
│  Thomson Reuters Westlaw     │
│  Token Endpoint              │
│  (Server-to-Server)          │
│                              │
└───────┬──────────────────────┘
        │
        │ 8. Validate request
        │    Return Access Token
        │
        ▼
┌─────────────────────────────────────────┐
│                                         │
│  Our Application Server                 │
│  Token Storage (.user-settings/)        │
│                                         │
│  9. Store access token server-side      │
│     ⚠️ NEVER send token to browser      │
│                                         │
└───────┬─────────────────────────────────┘
        │
        │ 10. Redirect user to app with success
        │
        ▼
┌──────────────┐
│   User (👤)  │  ✅ Connected!
│   Browser    │  (Token stays on server)
└──────────────┘
```

## Detailed Flow Steps

### Step 1: Authorization Request (Front-Channel)

**Endpoint:** `GET /api/westlaw/oauth/authorize`

**Purpose:** Initiate OAuth flow by generating authorization URL

**What Happens:**
```typescript
// User clicks "Connect Westlaw" button
// Frontend calls our API to get authorization URL

const response = await fetch('/api/westlaw/oauth/authorize');
const { authUrl } = await response.json();

// Frontend redirects user to authUrl
window.location.href = authUrl;
```

**Authorization URL Contains:**
- `client_id`: Public identifier (OK to expose)
- `redirect_uri`: Where to return after auth
- `response_type`: "code" (authorization code flow)
- `state`: Random value for CSRF protection
- `scope`: Permissions requested (e.g., "research.read")
- `code_challenge`: PKCE for additional security

**⚠️ Security:** Client Secret is NOT included. Only public parameters.

---

### Step 2: User Authentication (at Westlaw)

**Location:** Thomson Reuters Westlaw Login Page

**User Journey:**
1. User arrives at official Westlaw login page
2. URL is `signin.thomsonreuters.com` (not our domain)
3. User enters **THEIR** Westlaw credentials
4. Credentials go directly to Westlaw servers
5. **Our application NEVER sees the user's password**

**Security Benefits:**
- User credentials never touch our servers
- Authentication happens at trusted Westlaw domain
- User can verify they're on the real Westlaw site (HTTPS certificate)

---

### Step 3: Authorization Grant (Front-Channel)

**Purpose:** Westlaw returns one-time authorization code

**What Happens:**
1. User grants permission (consent screen)
2. Westlaw generates short-lived authorization code
3. User redirected back to our callback URL:
   ```
   https://our-app.com/api/westlaw/oauth/callback?code=ABC123&state=XYZ789
   ```

**Authorization Code Properties:**
- **One-time use:** Can only be exchanged once
- **Short-lived:** Expires in ~10 minutes
- **Bound to client:** Can only be used by our application
- **Not an access token:** Cannot be used to access APIs

**⚠️ Security:** Even if intercepted, code is useless without Client Secret.

---

### Step 4: Token Exchange (Back-Channel) ⚠️ CRITICAL

**Endpoint:** `POST https://signin.thomsonreuters.com/oauth2/token`

**Purpose:** Exchange authorization code for access token

**Request (Server-to-Server):**
```http
POST /oauth2/token HTTP/1.1
Host: signin.thomsonreuters.com
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=ABC123&
client_id=our-client-id&
client_secret=SUPER_SECRET_NEVER_EXPOSE&  ⚠️ SERVER ONLY!
redirect_uri=https://our-app.com/api/westlaw/oauth/callback&
code_verifier=PKCE_VERIFIER
```

**🔒 SECURITY CRITICAL:**
- **Client Secret is sent here** (server-to-server only)
- This request happens on our server (not in browser)
- User's browser never sees the Client Secret
- Request uses HTTPS (encrypted)
- Client Secret proves we are the legitimate application

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh...",
  "scope": "research.read research.search"
}
```

---

### Step 5: Access Token Issuance

**Purpose:** Store token securely server-side

**What Happens:**
```typescript
// In /api/westlaw/oauth/callback

const { token, userId } = await exchangeCodeForToken(code, state);

// Store token server-side (NEVER send to browser)
await saveUserOAuthToken(userId, token);

// Redirect user with success message (NO token in URL)
return NextResponse.redirect('/?oauth=success');
```

**Token Storage:**
- Stored in `.user-settings/` directory
- File named with hashed user ID
- Permissions restricted to server process
- **NEVER** sent to user's browser
- **NEVER** included in HTML/JavaScript

**⚠️ Security:** Token is scoped to the specific user who authenticated.

---

### Step 6: Protected Resource Request

**Purpose:** Use access token to call Westlaw API

**What Happens:**
```typescript
// User makes research query in frontend
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ messages: [...] }),
});

// On our server:
// 1. Get user's token from server-side storage
const token = await getUserOAuthToken(userId);

// 2. Create Westlaw client with token
const client = new WestlawClient({ oauthToken: token });

// 3. Call Westlaw API with token
const results = await client.search(query);

// 4. Return results to user (NOT the token)
return results;
```

**Request to Westlaw:**
```http
GET /v1/search?q=employment+discrimination HTTP/1.1
Host: api.westlaw.com
Authorization: Bearer eyJhbGc...  ⚠️ User's access token
```

**⚠️ Security:** 
- Token stays on server
- Each user has their own token
- Token scoped to user's permissions
- Token can be refreshed when expired

---

### Step 7: Legal Content Response

**Purpose:** Return Westlaw data to user

**Flow:**
```
Westlaw API → Our Server → User's Browser
```

**What User Receives:**
- Search results (cases, statutes, etc.)
- Document content
- Citations and metadata

**What User Does NOT Receive:**
- Access token
- Client Secret
- Other users' data

---

## Security Features

### 1. State Parameter (CSRF Protection)

**Purpose:** Prevent Cross-Site Request Forgery attacks

**Implementation:**
```typescript
// Generate random state
const state = randomBytes(32).toString('hex');

// Store with user ID and timestamp
stateStore.set(state, {
  userId,
  timestamp: Date.now(),
});

// Include in authorization URL
const authUrl = `${WESTLAW_AUTH_URL}?state=${state}&...`;

// Validate on callback
const storedState = stateStore.get(stateParam);
if (!storedState) {
  throw new Error('Invalid state - possible CSRF attack');
}
```

**Protection Against:**
- Attacker tricking user into authorizing attacker's app
- Authorization code intended for attacker being sent to our app

---

### 2. PKCE (Proof Key for Code Exchange)

**Purpose:** Additional security for authorization code flow

**Implementation:**
```typescript
// Generate code verifier
const codeVerifier = randomBytes(32).toString('base64url');

// Create code challenge
const codeChallenge = createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// Send challenge in authorization request
const authUrl = `${WESTLAW_AUTH_URL}?code_challenge=${codeChallenge}&...`;

// Send verifier in token exchange
const tokenResponse = await axios.post(TOKEN_URL, {
  code_verifier: codeVerifier,
  ...
});
```

**Protection Against:**
- Authorization code interception attacks
- Malicious apps intercepting the callback

---

### 3. Token Refresh

**Purpose:** Get new access token without re-authentication

**Implementation:**
```typescript
export async function refreshAccessToken(
  refreshToken: string
): Promise<OAuthToken> {
  const response = await axios.post(
    WESTLAW_TOKEN_URL,
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET, // ⚠️ Server-side only
    }
  );
  return response.data;
}

// Automatic refresh when token expires
export async function getValidAccessToken(token: OAuthToken): Promise<string> {
  if (isTokenExpired(token)) {
    const newToken = await refreshAccessToken(token.refresh_token);
    // Update stored token
    return newToken.access_token;
  }
  return token.access_token;
}
```

**Benefits:**
- User stays authenticated longer
- No need to re-login frequently
- Seamless user experience

---

### 4. Token Revocation

**Purpose:** Invalidate token when user disconnects

**Implementation:**
```typescript
export async function revokeToken(token: string): Promise<boolean> {
  await axios.post(
    REVOKE_URL,
    {
      token: token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET, // ⚠️ Server-side only
    }
  );
  return true;
}

// User clicks "Disconnect"
await revokeToken(userToken);
await deleteUserSettings(userId);
```

---

## Security Checklist

### ✅ Client Secret Protection

- [ ] Client Secret stored in environment variable
- [ ] `.env` file in `.gitignore`
- [ ] Client Secret NEVER in client-side code
- [ ] Client Secret NEVER in URLs
- [ ] Client Secret NEVER in logs
- [ ] Client Secret NEVER sent to browser
- [ ] In production: Use Azure Key Vault or AWS Secrets Manager

### ✅ Access Token Protection

- [ ] Tokens stored server-side only
- [ ] Tokens NEVER sent to browser
- [ ] Tokens NEVER in URLs
- [ ] Tokens NEVER in localStorage/sessionStorage
- [ ] Tokens scoped to individual users
- [ ] Tokens rotated/refreshed appropriately
- [ ] Tokens revoked on logout

### ✅ HTTPS/TLS

- [ ] All communications use HTTPS
- [ ] Certificates valid and up-to-date
- [ ] TLS 1.2 or higher
- [ ] Strong cipher suites enabled

### ✅ State Management

- [ ] State parameter used for all requests
- [ ] State validated on callback
- [ ] State expires after use (< 10 minutes)
- [ ] Old states cleaned up

### ✅ PKCE

- [ ] Code verifier generated randomly
- [ ] Code challenge computed correctly
- [ ] Code verifier sent in token exchange
- [ ] PKCE used for all authorization flows

### ✅ Input Validation

- [ ] All OAuth parameters validated
- [ ] Authorization codes validated
- [ ] Tokens validated before storage
- [ ] User IDs validated

### ✅ Error Handling

- [ ] Errors don't leak sensitive information
- [ ] Failed attempts logged
- [ ] Rate limiting on token endpoints
- [ ] Graceful handling of expired tokens

---

## Attack Prevention

### 1. Authorization Code Interception

**Attack:** Attacker intercepts authorization code from redirect

**Prevention:**
- ✅ PKCE ensures code useless without verifier
- ✅ Code bound to our Client ID
- ✅ Short expiration time
- ✅ One-time use only

### 2. Token Theft

**Attack:** Attacker steals access token

**Prevention:**
- ✅ Tokens never leave server
- ✅ Tokens never in browser storage
- ✅ HTTPS encryption
- ✅ Token scoping per user

### 3. CSRF Attacks

**Attack:** Attacker tricks user into authorizing attacker's app

**Prevention:**
- ✅ State parameter validation
- ✅ State tied to user session
- ✅ State expiration

### 4. Client Secret Exposure

**Attack:** Client Secret leaked in code/logs

**Prevention:**
- ✅ Environment variables only
- ✅ Not in version control
- ✅ Not in client-side code
- ✅ Not in URLs or logs
- ✅ Regular rotation

### 5. Session Hijacking

**Attack:** Attacker steals user's session

**Prevention:**
- ✅ Tokens tied to user ID
- ✅ Tokens hashed in storage
- ✅ HTTPS only
- ✅ Secure cookie flags (if using cookies)

---

## Production Deployment

### Environment Variables (REQUIRED)

```bash
# OAuth Credentials (from Thomson Reuters)
WESTLAW_CLIENT_ID=your-client-id
WESTLAW_CLIENT_SECRET=your-secret  # ⚠️ KEEP SECRET!
WESTLAW_REDIRECT_URI=https://your-domain.com/api/westlaw/oauth/callback

# OAuth Endpoints
WESTLAW_AUTH_URL=https://signin.thomsonreuters.com/oauth2/authorize
WESTLAW_TOKEN_URL=https://signin.thomsonreuters.com/oauth2/token
WESTLAW_API_BASE_URL=https://api.westlaw.com/v1
```

### Secure Storage (Production)

**Don't Use:** File-based storage (`.user-settings/`)

**Do Use:** 
- Azure Key Vault
- AWS Secrets Manager
- HashiCorp Vault
- Encrypted database with proper key management

### Monitoring

**Track:**
- Token exchange failures
- Invalid state parameters
- Authorization failures
- Token refresh failures
- Rate limit hits

### Compliance

- ✅ GDPR: User can request token deletion
- ✅ SOC 2: Audit logs for all token operations
- ✅ HIPAA: If handling health data, ensure compliance
- ✅ PCI: Not applicable (no payment card data)

---

## Testing

### Development Environment

```bash
# Use mock OAuth for testing
WESTLAW_MOCK_MODE=true
```

### Test Scenarios

1. **Happy Path:**
   - User clicks connect
   - Authenticates at Westlaw
   - Token stored successfully
   - API calls work

2. **Error Cases:**
   - User denies permission → Handle gracefully
   - Invalid state → Block with error
   - Expired code → Clear error message
   - Network failure → Retry logic

3. **Security Tests:**
   - Client Secret never in client code
   - Token never in browser
   - CSRF protection working
   - PKCE validation working

---

## Support & Resources

### Thomson Reuters Documentation
- [OAuth 2.0 Guide](https://developer.thomsonreuters.com/oauth2)
- [API Documentation](https://developer.thomsonreuters.com/westlaw)
- [Developer Portal](https://developer.thomsonreuters.com/)

### OAuth 2.0 Specifications
- [RFC 6749](https://tools.ietf.org/html/rfc6749) - OAuth 2.0 Framework
- [RFC 7636](https://tools.ietf.org/html/rfc7636) - PKCE
- [RFC 6819](https://tools.ietf.org/html/rfc6819) - OAuth 2.0 Threat Model

### Security Best Practices
- [OWASP OAuth Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [OAuth 2.0 Security Best Current Practice](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)

---

## Conclusion

This OAuth 2.0 implementation ensures:

✅ **Client Secret never reaches user's browser**
✅ **Access tokens stored server-side only**
✅ **User credentials never touch our servers**
✅ **CSRF and code interception protection**
✅ **Automatic token refresh**
✅ **Secure token revocation**

The architecture follows OAuth 2.0 best practices and provides enterprise-grade security for Westlaw API integration.

---

**Version:** 1.0.0  
**Last Updated:** November 24, 2025  
**Security Review:** Required annually
