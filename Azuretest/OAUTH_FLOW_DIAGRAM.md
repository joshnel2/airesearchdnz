# OAuth 2.0 Flow - Complete Security Diagram

## Labeled Flow Steps

This document illustrates the complete OAuth 2.0 Authorization Code Flow with security emphasis on **Client Secret protection**.

---

## Visual Flow Diagram

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 1: Authorization Request (Front-Channel)                       ┃
┃ User clicks "Connect Westlaw" → Redirected to Westlaw Login        ┃
┃                                                                      ┃
┃ ✅ Includes: Client ID, Redirect URI, State, Code Challenge (PKCE) ┃
┃ ❌ Does NOT include: Client Secret                                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

     User's Browser
     │
     │ 1. Click "Connect Westlaw"
     │
     ▼
┌────────────────────────────────────┐
│  Our Application Frontend          │
│  Components/WestlawConnectionOAuth │
└────────────┬───────────────────────┘
             │
             │ GET /api/westlaw/oauth/authorize
             │
             ▼
┌────────────────────────────────────┐
│  Our Application Server             │
│  /api/westlaw/oauth/authorize       │
│                                     │
│  Generates authorization URL with:  │
│  • Client ID (public) ✅            │
│  • Redirect URI ✅                  │
│  • State (CSRF protection) ✅       │
│  • Code Challenge (PKCE) ✅         │
│  • Scope (permissions) ✅           │
│  • NO Client Secret! ❌             │
└────────────┬───────────────────────┘
             │
             │ Return authUrl
             │
             ▼
     User's Browser
     │
     │ Redirect to authUrl
     │
     ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 2: User Authentication                                         ┃
┃ Lawyer enters their individual Westlaw credentials                  ┃
┃                                                                      ┃
┃ 🔒 User credentials entered at Thomson Reuters (NOT our app!)      ┃
┃ ❌ Our application NEVER sees the user's password                   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌──────────────────────────────────────────┐
│  Thomson Reuters Westlaw                 │
│  signin.thomsonreuters.com               │
│                                          │
│  User sees:                              │
│  ┌────────────────────────────────┐    │
│  │  [Westlaw Login]               │    │
│  │                                │    │
│  │  Username: [____________]      │    │
│  │  Password: [____________]      │    │
│  │                                │    │
│  │  [Login] [Cancel]              │    │
│  └────────────────────────────────┘    │
│                                          │
│  • User enters THEIR credentials        │
│  • Credentials validated by Westlaw     │
│  • User grants permission (consent)     │
└──────────────┬───────────────────────────┘
               │
               │ User clicks "Allow"
               │
               ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 3: Authorization Grant                                         ┃
┃ Westlaw returns a one-time Authorization Code to our Redirect URI   ┃
┃                                                                      ┃
┃ ✅ Code is one-time use, short-lived (10 minutes)                   ┃
┃ ✅ Code is useless without Client Secret                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌──────────────────────────────────────────┐
│  Thomson Reuters Westlaw                 │
│                                          │
│  Generates:                              │
│  • One-time Authorization Code           │
│  • Expires in ~10 minutes                │
│  • Bound to our Client ID                │
└──────────────┬───────────────────────────┘
               │
               │ HTTP 302 Redirect
               │ Location: https://our-app.com/api/westlaw/oauth/callback
               │           ?code=ABC123XYZ
               │           &state=random-state-value
               │
               ▼
     User's Browser
     │
     │ Follow redirect to our callback
     │
     ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 4: Token Exchange (Back-Channel)                               ┃
┃ Our server exchanges Code + Client ID + Client Secret for token     ┃
┃                                                                      ┃
┃ 🔒 SECURITY CRITICAL:                                               ┃
┃ ⚠️  Client Secret is used HERE (server-to-server ONLY)             ┃
┃ ⚠️  User's browser NEVER sees the Client Secret                     ┃
┃ ⚠️  This is why it's called "Back-Channel" (behind the scenes)     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌───────────────────────────────────────────┐
│  Our Application Server                   │
│  /api/westlaw/oauth/callback              │
│                                           │
│  Receives from user's browser:            │
│  • Authorization Code ✅                  │
│  • State parameter ✅                     │
│                                           │
│  Server validates:                        │
│  • State matches stored value             │
│  • State not expired                      │
└──────────────┬────────────────────────────┘
               │
               │ Server makes DIRECT request
               │ (NOT through user's browser)
               │
               │ POST https://signin.thomsonreuters.com/oauth2/token
               │ Content-Type: application/x-www-form-urlencoded
               │
               │ Body:
               │   grant_type=authorization_code
               │   code=ABC123XYZ
               │   client_id=our-public-client-id      ✅
               │   client_secret=SUPER_SECRET_KEY      ⚠️ USED HERE!
               │   redirect_uri=https://our-app.com/...
               │   code_verifier=pkce-verifier         ✅
               │
               ▼
┌──────────────────────────────────────────┐
│  Thomson Reuters Westlaw                 │
│  Token Endpoint (Server-to-Server)       │
│  signin.thomsonreuters.com/oauth2/token  │
│                                          │
│  Validates:                              │
│  • Authorization code is valid           │
│  • Client ID matches                     │
│  • Client Secret is correct ⚠️          │
│  • Redirect URI matches                  │
│  • Code verifier matches challenge       │
└──────────────┬───────────────────────────┘
               │
               │ If valid, return tokens
               │
               ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 5: Access Token Issuance                                       ┃
┃ Westlaw issues the Access Token (scoped to the user) to our server  ┃
┃                                                                      ┃
┃ 🔒 Token sent DIRECTLY to our server (NOT through browser)         ┃
┃ ❌ User's browser NEVER sees the Access Token                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌──────────────────────────────────────────┐
│  Thomson Reuters Westlaw                 │
│                                          │
│  Response (JSON):                        │
│  {                                       │
│    "access_token": "eyJhbGc...",        │
│    "token_type": "Bearer",              │
│    "expires_in": 3600,                  │
│    "refresh_token": "refresh...",       │
│    "scope": "research.read research..." │
│  }                                       │
└──────────────┬───────────────────────────┘
               │
               │ HTTPS (encrypted)
               │
               ▼
┌────────────────────────────────────────────┐
│  Our Application Server                    │
│  /api/westlaw/oauth/callback               │
│                                            │
│  Receives token response                   │
│  Stores token SERVER-SIDE:                 │
│    await saveUserOAuthToken(userId, token) │
│                                            │
│  Storage location:                         │
│    .user-settings/{hashed-user-id}.json    │
│                                            │
│  ⚠️ Token NEVER sent to browser!          │
└────────────┬───────────────────────────────┘
             │
             │ Redirect user to success page
             │ (WITHOUT the token!)
             │
             ▼
     User's Browser
     │
     │ Redirect to /?oauth=success
     │
     ▼
┌────────────────────────────────────┐
│  User sees: ✅ Connected!          │
│                                    │
│  • Connection status: Connected    │
│  • Token stored server-side        │
│  • Ready to search Westlaw         │
└────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now when user makes legal research queries:

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 6: Protected Resource Request                                  ┃
┃ Our application sends the Access Token to Westlaw API               ┃
┃                                                                      ┃
┃ 🔒 Token retrieved from server-side storage                        ┃
┃ ❌ Token NEVER sent to user's browser                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

     User's Browser
     │
     │ User types: "Find cases about employment discrimination"
     │
     │ POST /api/chat
     │ Body: { messages: [...], enableWestlaw: true }
     │
     ▼
┌─────────────────────────────────────────┐
│  Our Application Server                 │
│  /api/chat                              │
│                                         │
│  1. Detect legal query ✅               │
│  2. Get user's token from storage:      │
│     const settings = await              │
│       getUserSettings(userId);          │
│     const token = settings.oauthToken;  │
│                                         │
│  3. Create Westlaw client:              │
│     const client = new WestlawClient({  │
│       oauthToken: token  ⚠️ Server-side │
│     });                                 │
│                                         │
│  4. Search Westlaw:                     │
│     const results = await               │
│       client.search(query);             │
└────────────┬────────────────────────────┘
             │
             │ GET https://api.westlaw.com/v1/search
             │ Authorization: Bearer eyJhbGc...  ⚠️ User's token
             │ Query: employment discrimination
             │
             ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 7: Legal Content Response                                      ┃
┃ Westlaw API returns the requested content (e.g., case text)         ┃
┃                                                                      ┃
┃ ✅ Results returned through our server                              ┃
┃ ✅ User sees search results (NOT the token)                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌──────────────────────────────────────────┐
│  Thomson Reuters Westlaw API             │
│  api.westlaw.com/v1/search               │
│                                          │
│  1. Validate access token                │
│  2. Check user permissions               │
│  3. Search legal database                │
│  4. Return results:                      │
│     {                                    │
│       "results": [                       │
│         {                                │
│           "title": "Case Name v. ...",  │
│           "citation": "123 F.3d 456",   │
│           "snippet": "...",             │
│           ...                            │
│         }                                │
│       ]                                  │
│     }                                    │
└──────────────┬───────────────────────────┘
               │
               │ Search results (JSON)
               │
               ▼
┌─────────────────────────────────────────┐
│  Our Application Server                 │
│  /api/chat                              │
│                                         │
│  5. Format results for AI               │
│  6. Send to Azure OpenAI                │
│  7. Stream response to user             │
└────────────┬────────────────────────────┘
             │
             │ Stream response
             │
             ▼
     User's Browser
     │
     │ Receives AI response with citations:
     │ "Here are relevant cases on employment
     │  discrimination:
     │
     │  1. Smith v. Company (123 F.3d 456)
     │     - Summary...
     │  2. Jones v. Corp (789 F.3d 012)
     │     - Summary..."
     │
     ▼
┌────────────────────────────────────┐
│  User sees: Search results! ✅     │
│                                    │
│  • Case law with citations         │
│  • AI analysis                     │
│  • Links to full documents         │
│  • NO tokens or secrets ❌         │
└────────────────────────────────────┘
```

---

## Key Security Requirements (Highlighted)

### ✅ User Only Interacts With:
1. **Authorization Server (Westlaw Login Page)**
   - User enters credentials at `signin.thomsonreuters.com`
   - Credentials go directly to Thomson Reuters
   - User can verify SSL certificate

2. **Client Application (Our Frontend)**
   - User clicks "Connect" button
   - User sees research results
   - User sees connection status

### ❌ User NEVER Receives, Transmits, or Handles:
1. **Client Secret (API Key)**
   - Stored in `.env` on server
   - Used only in `/api/westlaw/oauth/callback` (server-side)
   - Never in frontend code
   - Never in URLs
   - Never in browser storage

2. **Access Tokens**
   - Stored in `.user-settings/` on server
   - Used in API calls (server-to-server)
   - Never sent to browser
   - Never in JavaScript variables

### 🔒 Client Secret Usage:
- **ONLY** used in **secure, server-to-server (back-channel)** communication
- **STEP 4** is the ONLY place Client Secret appears
- Request happens on our server (not through user's browser)
- Encrypted with HTTPS
- Never logged or exposed

---

## Security Guarantees

| Component | User Can See | User Cannot See |
|-----------|--------------|-----------------|
| **Client ID** | ✅ Yes (public) | - |
| **Client Secret** | ❌ Never | ✅ Server-only |
| **Authorization Code** | ✅ Yes (one-time use) | - |
| **Access Token** | ❌ Never | ✅ Server-only |
| **Refresh Token** | ❌ Never | ✅ Server-only |
| **User's Westlaw Password** | ✅ At Westlaw only | ❌ Never at our app |
| **Search Results** | ✅ Yes | - |

---

## Files Involved in Each Step

### Step 1: Authorization Request (Front-Channel)
```
components/WestlawConnectionOAuth.tsx  → User clicks button
    ↓
app/api/westlaw/oauth/authorize/route.ts  → Generate authUrl
    ↓
lib/westlaw-oauth.ts: generateAuthorizationUrl()  → Create URL
```

### Steps 2-3: User Authentication & Grant (at Westlaw)
```
[Happens entirely at Thomson Reuters servers]
- signin.thomsonreuters.com
- User enters credentials there
- User grants permission
- Westlaw generates authorization code
```

### Step 4: Token Exchange (Back-Channel) ⚠️ CLIENT SECRET
```
app/api/westlaw/oauth/callback/route.ts  → Receives code
    ↓
lib/westlaw-oauth.ts: exchangeCodeForToken()  → Uses CLIENT_SECRET ⚠️
    ↓
[HTTPS POST to Thomson Reuters Token Endpoint]
    ↓
lib/user-settings.ts: saveUserOAuthToken()  → Store token server-side
```

### Steps 6-7: Protected Resource Request
```
components/LegalResearchInterface.tsx  → User makes query
    ↓
app/api/chat/route.ts  → Handle query
    ↓
lib/user-settings.ts: getUserOAuthToken()  → Get token (server-side)
    ↓
lib/westlaw.ts: WestlawClient.search()  → Use token
    ↓
[HTTPS GET to Westlaw API with token]
    ↓
Return results to user (not the token)
```

---

## Verification Commands

```bash
# Verify Client Secret never in frontend code
grep -r "CLIENT_SECRET" components/
# Should return: (nothing)

grep -r "CLIENT_SECRET" app/api/
# Should return: Only in callback/route.ts and authorize/route.ts

# Verify tokens never sent to browser
grep -r "access_token" components/
# Should return: (nothing)

# Verify OAuth flow files exist
ls -la app/api/westlaw/oauth/authorize/route.ts
ls -la app/api/westlaw/oauth/callback/route.ts
ls -la lib/westlaw-oauth.ts
```

---

## Summary

**The OAuth 2.0 flow ensures:**

✅ **Client Secret NEVER reaches the browser**
✅ **User credentials NEVER touch our servers**
✅ **Access tokens stored server-side ONLY**
✅ **Each user has their own scoped token**
✅ **Automatic token refresh**
✅ **CSRF protection with state parameter**
✅ **Code interception protection with PKCE**

This is the **gold standard** for API authentication security.

---

**Document Version:** 1.0.0  
**Last Updated:** November 24, 2025  
**Security Standard:** OAuth 2.0 Authorization Code Flow with PKCE
