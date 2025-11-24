# Legal Research Tool with Secure OAuth 2.0

A comprehensive legal research application with **secure OAuth 2.0 integration** for Thomson Reuters Westlaw API, ensuring Client Secrets never reach the user's browser.

## 🔐 Security Architecture

This application implements **OAuth 2.0 Authorization Code Flow** with the following security guarantees:

### ✅ What This Means for Security

1. **Client Secret Protection**
   - Client Secret stored server-side only
   - NEVER sent to user's browser
   - NEVER in client-side JavaScript
   - Used only in secure back-channel requests

2. **User Credential Protection**
   - Users authenticate at Thomson Reuters (not our app)
   - Passwords never touch our servers
   - Users can verify they're on official Westlaw site

3. **Token Security**
   - Access tokens stored server-side
   - Tokens scoped to individual users
   - Automatic token refresh
   - Secure token revocation

4. **Additional Protection**
   - CSRF protection with state parameter
   - PKCE (Proof Key for Code Exchange)
   - HTTPS encryption throughout
   - Rate limiting and monitoring

## 🚀 Quick Start

### 1. Get OAuth Credentials from Thomson Reuters

1. Visit [Thomson Reuters Developer Portal](https://developer.thomsonreuters.com/)
2. Create an application
3. Note your:
   - **Client ID** (public, OK to use in URLs)
   - **Client Secret** ⚠️ (NEVER commit to git!)
4. Register redirect URI: `http://localhost:3000/api/westlaw/oauth/callback`

### 2. Configure Environment

```bash
cd Azuretest
cp .env.example .env
```

Edit `.env`:
```env
# Azure OpenAI (required)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

# Westlaw OAuth (required)
WESTLAW_CLIENT_ID=your-client-id
WESTLAW_CLIENT_SECRET=your-client-secret
WESTLAW_REDIRECT_URI=http://localhost:3000/api/westlaw/oauth/callback

# Westlaw API endpoints (defaults provided)
WESTLAW_API_BASE_URL=https://api.westlaw.com/v1
WESTLAW_AUTH_URL=https://signin.thomsonreuters.com/oauth2/authorize
WESTLAW_TOKEN_URL=https://signin.thomsonreuters.com/oauth2/token
```

### 3. Install and Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

### 4. Connect Westlaw (OAuth Flow)

1. Click **"Connect Westlaw Account"** button
2. You'll be redirected to **Thomson Reuters login page**
3. Enter YOUR Westlaw credentials at Thomson Reuters
4. Grant permission
5. Redirected back to app - you're connected!

**Security Note:** Your password never touches our application. Authentication happens entirely at Thomson Reuters.

## 📋 OAuth Flow Explained

### User's Perspective

```
1. Click "Connect Westlaw"
   ↓
2. Redirect to Thomson Reuters
   ↓
3. Login at signin.thomsonreuters.com (your credentials)
   ↓
4. Grant permission
   ↓
5. Return to app - Connected! ✅
```

### Technical Flow (Security Details)

```
STEP 1 (Front-Channel):
User → Our App → Authorization Request
    • Includes: Client ID (public)
    • Does NOT include: Client Secret ❌

STEP 2 (at Westlaw):
User → Thomson Reuters → Authentication
    • User enters their Westlaw credentials
    • Credentials stay at Thomson Reuters

STEP 3 (Front-Channel):
Thomson Reuters → User → Authorization Code
    • One-time code returned
    • Code is short-lived

STEP 4 (Back-Channel - SERVER ONLY):
Our Server → Thomson Reuters → Token Exchange
    • Sends: Code + Client ID + Client Secret ⚠️
    • Client Secret used HERE (server-to-server)
    • Receives: Access Token

STEP 5 (Server Storage):
Access Token → Stored Server-Side
    • Token NEVER sent to user's browser
    • Token tied to specific user
    • Token used for API calls

STEP 6-7 (API Requests):
User Query → Our Server → Westlaw API
    • Our server uses stored token
    • Makes request on user's behalf
    • Returns results to user
```

## 🏗️ Architecture

### File Structure

```
Azuretest/
├── lib/
│   ├── westlaw-oauth.ts           ⚠️ OAuth implementation (Client Secret used)
│   ├── westlaw.ts                 ⚠️ Westlaw API client with OAuth support
│   ├── user-settings.ts           ⚠️ Token storage (server-side)
│   └── openai.ts                  AI integration
├── app/api/
│   ├── westlaw/
│   │   ├── oauth/
│   │   │   ├── authorize/        Step 1: Authorization request
│   │   │   │   └── route.ts
│   │   │   └── callback/         Steps 3-5: Token exchange
│   │   │       └── route.ts      ⚠️ Client Secret used here
│   │   ├── connect/              Legacy: Check connection status
│   │   │   └── route.ts
│   │   └── search/               Direct search endpoint
│   │       └── route.ts
│   └── chat/                      AI chat with Westlaw integration
│       └── route.ts               ⚠️ Uses OAuth tokens
├── components/
│   ├── LegalResearchInterface.tsx      Main UI
│   └── WestlawConnectionOAuth.tsx      OAuth connection UI
└── OAUTH_SECURITY.md                   📖 Detailed security docs
```

⚠️ = Files that handle sensitive credentials (server-side only)

### Security Boundaries

```
┌─────────────────────────────────────────┐
│         User's Browser (Front-End)      │
│                                         │
│  ✅ CAN See:                            │
│    • Client ID (public)                 │
│    • Authorization URLs                 │
│    • Research results                   │
│                                         │
│  ❌ NEVER Sees:                         │
│    • Client Secret                      │
│    • Access tokens                      │
│    • Refresh tokens                     │
└─────────────────────────────────────────┘
                    │
                    │ HTTPS
                    │
┌─────────────────────────────────────────┐
│         Our Application Server          │
│                                         │
│  🔒 Server-Side Operations:             │
│    • Token exchange (with Client Secret)│
│    • Token storage                      │
│    • Token refresh                      │
│    • Westlaw API calls                  │
└─────────────────────────────────────────┘
                    │
                    │ HTTPS (with tokens)
                    │
┌─────────────────────────────────────────┐
│        Thomson Reuters Westlaw API      │
│                                         │
│  • Validates tokens                     │
│  • Returns legal research data          │
│  • Manages user permissions             │
└─────────────────────────────────────────┘
```

## 📚 API Endpoints

### OAuth Endpoints

#### `GET /api/westlaw/oauth/authorize`
**Purpose:** Start OAuth flow  
**Security:** Public - only sends Client ID  
**Returns:** Authorization URL for redirect

#### `GET /api/westlaw/oauth/callback`
**Purpose:** Handle OAuth callback  
**Security:** ⚠️ CRITICAL - Uses Client Secret  
**Process:**
1. Receive authorization code
2. Exchange code for token (server-to-server)
3. Store token server-side
4. Redirect user

### Connection Endpoints

#### `GET /api/westlaw/connect`
**Purpose:** Check connection status  
**Returns:** Whether user is connected (not the token)

#### `DELETE /api/westlaw/connect`
**Purpose:** Disconnect account  
**Process:**
1. Revoke token at Westlaw
2. Delete stored token
3. Confirm disconnection

### Research Endpoints

#### `POST /api/chat`
**Purpose:** AI chat with Westlaw integration  
**Security:** Uses stored token server-side  
**Process:**
1. Detect legal queries
2. Retrieve user's token (server-side)
3. Search Westlaw with token
4. Return results (not token)

## 🔒 Security Features

### 1. Client Secret Protection

✅ **Implementation:**
- Stored in `.env` file (gitignored)
- Only used in server-side code
- Never sent to browser
- Never in URLs or logs

✅ **Validation:**
```bash
# Check that Client Secret is never in client code
grep -r "WESTLAW_CLIENT_SECRET" components/  # Should find nothing
grep -r "CLIENT_SECRET" public/              # Should find nothing
```

### 2. State Parameter (CSRF Protection)

✅ **Implementation:**
- Random state generated per request
- State validated on callback
- Expires after 10 minutes
- Prevents CSRF attacks

### 3. PKCE (Code Exchange Protection)

✅ **Implementation:**
- Code verifier generated
- Code challenge sent in authorization
- Verifier sent in token exchange
- Prevents code interception

### 4. Token Management

✅ **Implementation:**
- Tokens stored server-side only
- Automatic refresh when expired
- Secure revocation on disconnect
- Per-user token scoping

## 📖 Documentation

### Security Documentation
- **[OAUTH_SECURITY.md](./OAUTH_SECURITY.md)** - Complete OAuth security architecture
- Detailed flow diagrams
- Security checklist
- Attack prevention
- Best practices

### Setup Documentation
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Installation and configuration
- **[WESTLAW_INTEGRATION.md](./WESTLAW_INTEGRATION.md)** - Westlaw API details

## ✅ Security Checklist

Before deploying to production:

- [ ] Client Secret in environment variable (not code)
- [ ] `.env` file in `.gitignore`
- [ ] HTTPS enabled for all endpoints
- [ ] Redirect URI registered with Thomson Reuters
- [ ] Token storage secured (consider Azure Key Vault)
- [ ] Error messages don't leak secrets
- [ ] Rate limiting configured
- [ ] Monitoring and alerting set up
- [ ] Regular security audits scheduled

## 🚨 Security Warnings

### ⚠️ CRITICAL: Never Expose Client Secret

**❌ NEVER DO THIS:**
```typescript
// DON'T: Client Secret in frontend code
const clientSecret = "your-secret";  // ❌ WRONG!

// DON'T: Client Secret in API response
return { clientSecret: process.env.WESTLAW_CLIENT_SECRET };  // ❌ WRONG!

// DON'T: Client Secret in URL
window.location.href = `...&client_secret=${secret}`;  // ❌ WRONG!
```

**✅ CORRECT APPROACH:**
```typescript
// DO: Client Secret only in server-side code
// In /api/westlaw/oauth/callback/route.ts (server-side)
const CLIENT_SECRET = process.env.WESTLAW_CLIENT_SECRET;
await exchangeCodeForToken(code, CLIENT_SECRET);  // ✅ CORRECT
```

### ⚠️ Token Storage

**❌ NEVER DO THIS:**
```typescript
// DON'T: Store tokens in browser
localStorage.setItem('token', accessToken);  // ❌ WRONG!
sessionStorage.setItem('token', accessToken);  // ❌ WRONG!
```

**✅ CORRECT APPROACH:**
```typescript
// DO: Store tokens server-side only
await saveUserOAuthToken(userId, token);  // ✅ CORRECT (server-side)
```

## 🐛 Troubleshooting

### "OAuth not configured"

**Cause:** Missing environment variables

**Solution:**
```bash
# Check .env file has:
WESTLAW_CLIENT_ID=...
WESTLAW_CLIENT_SECRET=...
WESTLAW_REDIRECT_URI=...
```

### "Invalid state parameter"

**Cause:** State expired or CSRF attempt

**Solution:**
- Try connecting again
- Check server time is synchronized
- Verify no browser extensions interfering

### "Failed to exchange authorization code"

**Cause:** Invalid Client Secret or expired code

**Solution:**
- Verify Client Secret is correct
- Check code hasn't been used already
- Ensure redirect URI matches exactly

### User redirected but not connected

**Cause:** Callback endpoint error

**Solution:**
- Check server logs
- Verify callback URL is accessible
- Ensure .user-settings/ directory writable

## 🚀 Production Deployment

### Environment Variables (Production)

```bash
# Use production redirect URI
WESTLAW_REDIRECT_URI=https://your-domain.com/api/westlaw/oauth/callback

# Use production OAuth endpoints (if different)
WESTLAW_AUTH_URL=https://signin.thomsonreuters.com/oauth2/authorize
WESTLAW_TOKEN_URL=https://signin.thomsonreuters.com/oauth2/token
```

### Secure Storage (Production)

**Replace file-based storage with:**

**Azure:**
```bash
# Store Client Secret in Azure Key Vault
WESTLAW_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://...)
```

**AWS:**
```bash
# Use AWS Secrets Manager
aws secretsmanager create-secret --name westlaw-client-secret
```

### Monitoring

Track:
- Failed authorization attempts
- Token exchange failures
- Invalid state parameters
- Rate limit hits
- Token refresh failures

## 📝 License

Proprietary - All rights reserved

## 🆘 Support

- **Security Issues:** Report immediately to security team
- **OAuth Issues:** Check [OAUTH_SECURITY.md](./OAUTH_SECURITY.md)
- **Thomson Reuters:** [Developer Portal](https://developer.thomsonreuters.com/)

---

**Built with:** Next.js 14, React 18, TypeScript, OAuth 2.0, Thomson Reuters Westlaw API

**Security Standard:** OAuth 2.0 Authorization Code Flow with PKCE

**Last Security Audit:** November 24, 2025
