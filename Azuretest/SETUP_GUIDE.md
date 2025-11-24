# Setup Guide - Legal Research Tool

This guide will help you set up and run the Legal Research Tool with Westlaw integration.

## Quick Start

### Step 1: Install Dependencies

```bash
cd Azuretest
npm install
```

### Step 2: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your credentials:

```env
# Azure OpenAI Configuration (Required)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

# Optional: Custom Westlaw API endpoint
# WESTLAW_API_BASE_URL=https://api.westlaw.com/v1
```

### Step 3: Run the Application

Development mode (with hot reload):
```bash
npm run dev
```

Production build and run:
```bash
npm run build
npm start
```

The application will be available at: **http://localhost:3000**

## Getting Your Credentials

### Azure OpenAI

1. Go to [Azure Portal](https://portal.azure.com)
2. Create or select an Azure OpenAI resource
3. Go to "Keys and Endpoint"
4. Copy:
   - Endpoint URL
   - Key 1 or Key 2
   - Your deployment name (e.g., gpt-4, gpt-35-turbo)

### Westlaw API Key

1. Visit [Thomson Reuters Developer Portal](https://developer.thomsonreuters.com/)
2. Create an account or sign in
3. Create a new application
4. Generate API credentials
5. Copy your API Key

**Note:** Westlaw API key is configured through the UI after the application starts, not in the .env file.

## First Time Usage

### 1. Start the Application

```bash
npm run dev
```

### 2. Connect Westlaw Account

1. Open http://localhost:3000
2. Click the "Connect Westlaw" button in the top right
3. Enter your Westlaw API key
4. Click "Connect"
5. You should see "✓ Westlaw Connected"

### 3. Start Researching

Try these example queries:

- "Find cases about employment discrimination"
- "What is the legal standard for summary judgment?"
- "Search for recent Supreme Court decisions on First Amendment"
- "Tell me about Roe v. Wade"

## Project Structure

```
Azuretest/
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # Chat API with Westlaw integration
│   │   ├── westlaw/
│   │   │   ├── connect/route.ts       # API key management
│   │   │   └── search/route.ts        # Direct search endpoint
│   │   ├── health/route.ts            # Health check
│   │   └── redline/route.ts           # Legacy redlining
│   ├── layout.tsx                      # App layout
│   ├── page.tsx                        # Main page
│   └── globals.css                     # Global styles
├── components/
│   ├── LegalResearchInterface.tsx     # Main research UI
│   ├── WestlawConnection.tsx          # Westlaw connection UI
│   ├── RedlineInterface.tsx           # Legacy component
│   ├── RedlineEditor.tsx              # Legacy component
│   └── RedlineModal.tsx               # Legacy component
├── lib/
│   ├── westlaw.ts                     # Westlaw API client
│   ├── user-settings.ts               # User settings storage
│   ├── openai.ts                      # Azure OpenAI client
│   ├── telemetry.ts                   # Application insights
│   └── websearch.ts                   # Web search utility
├── public/                             # Static files
├── .env.example                        # Environment template
├── .gitignore                          # Git ignore rules
├── package.json                        # Dependencies
├── tsconfig.json                       # TypeScript config
├── next.config.js                      # Next.js config
├── tailwind.config.ts                  # Tailwind CSS config
├── README.md                           # Main documentation
├── WESTLAW_INTEGRATION.md             # Westlaw integration guide
└── SETUP_GUIDE.md                     # This file
```

## Configuration Options

### Westlaw API Base URL

Default: `https://api.westlaw.com/v1`

To use a different endpoint (staging, custom, etc.):

```env
WESTLAW_API_BASE_URL=https://staging-api.westlaw.com/v1
```

### User Settings Storage

User Westlaw API keys are stored in `.user-settings/` directory:
- Each user gets their own file
- User IDs are hashed for privacy
- Files are in JSON format

**Security Note:** In production, consider using:
- Database storage (PostgreSQL, MongoDB)
- Encrypted key storage (Azure Key Vault, AWS Secrets Manager)
- User authentication (OAuth, SAML)

## Deployment

### Deploy to Azure App Service

1. Create an Azure App Service (Node.js 18+)

2. Configure environment variables in Azure Portal:
   - `AZURE_OPENAI_ENDPOINT`
   - `AZURE_OPENAI_API_KEY`
   - `AZURE_OPENAI_DEPLOYMENT_NAME`

3. Deploy using Azure CLI:
```bash
az webapp up --name your-app-name --resource-group your-rg
```

Or use the provided deployment scripts:
```bash
./deploy-azure.sh
```

### Deploy with Docker

1. Build the image:
```bash
docker build -t legal-research-tool .
```

2. Run the container:
```bash
docker run -p 3000:3000 \
  -e AZURE_OPENAI_ENDPOINT=your-endpoint \
  -e AZURE_OPENAI_API_KEY=your-key \
  -e AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4 \
  legal-research-tool
```

Or use Docker Compose:
```bash
docker-compose up
```

## Troubleshooting

### Port 3000 Already in Use

Change the port:
```bash
PORT=3001 npm run dev
```

### "Cannot find module" Errors

Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Westlaw Connection Fails

1. Check your API key is correct
2. Verify Westlaw subscription is active
3. Check firewall/proxy settings
4. Try the key in [Westlaw API tester](https://developer.thomsonreuters.com/)

### Azure OpenAI Errors

1. Verify endpoint URL is correct (include https://)
2. Check API key is valid
3. Confirm deployment name matches your Azure deployment
4. Ensure you have quota/credits available

### Build Errors

Clear Next.js cache:
```bash
rm -rf .next
npm run build
```

### User Settings Not Persisting

Check `.user-settings/` directory exists:
```bash
mkdir -p .user-settings
chmod 755 .user-settings
```

## Development Tips

### Hot Reload

The dev server supports hot reload:
```bash
npm run dev
```

Edit files and see changes instantly.

### TypeScript Type Checking

Run type checking:
```bash
npx tsc --noEmit
```

### Linting

Run ESLint:
```bash
npm run lint
```

Fix automatically:
```bash
npm run lint -- --fix
```

### Testing Westlaw Integration

Mock Westlaw responses for testing:

```typescript
// In lib/westlaw.ts, add mock mode
if (process.env.WESTLAW_MOCK_MODE === 'true') {
  return mockSearchResponse();
}
```

## Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] No API keys committed to git
- [ ] `.user-settings/` is in `.gitignore`
- [ ] HTTPS enabled in production
- [ ] API keys rotated regularly
- [ ] Rate limiting configured
- [ ] User authentication implemented (for production)
- [ ] Audit logging enabled

## Performance Optimization

### Caching

Implement caching for common queries:
```typescript
const cache = new Map();

async function searchWithCache(query) {
  if (cache.has(query)) {
    return cache.get(query);
  }
  const result = await client.search(query);
  cache.set(query, result);
  return result;
}
```

### Lazy Loading

Components are already lazy-loaded with Next.js.

### CDN

Deploy static assets to CDN for better performance.

## Monitoring

### Application Insights

The app includes Azure Application Insights integration:
- Automatic request tracking
- Error logging
- Performance metrics

View metrics in Azure Portal.

### Custom Logging

Add custom events:
```typescript
import { trackEvent } from '@/lib/telemetry';

trackEvent('westlaw_search', {
  query: searchQuery,
  results: resultCount,
});
```

## Getting Help

### Documentation

- [Main README](./README.md) - Overview and features
- [Westlaw Integration Guide](./WESTLAW_INTEGRATION.md) - Detailed Westlaw info
- [Azure Deployment Guide](./AZURE_DEPLOYMENT.md) - Azure-specific deployment

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Westlaw API Docs](https://developer.thomsonreuters.com/westlaw)
- [Azure OpenAI Docs](https://learn.microsoft.com/azure/ai-services/openai/)

### Support

For technical issues:
1. Check error logs
2. Review browser console
3. Check Application Insights
4. Contact system administrator

## Next Steps

After setup:

1. ✅ Verify the application runs
2. ✅ Connect your Westlaw account
3. ✅ Test a few research queries
4. 📚 Read the [Westlaw Integration Guide](./WESTLAW_INTEGRATION.md)
5. 🎨 Customize the UI as needed
6. 🚀 Deploy to production
7. 📊 Set up monitoring
8. 🔐 Implement proper authentication

Happy researching! 📖⚖️
