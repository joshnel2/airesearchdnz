# Azure Deployment Guide

## ✅ Repository Structure - Ready for Azure

The repository is now properly structured for Azure Web App deployment with all files at the root level.

### Key Files for Azure Deployment

```
/workspace/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── chat/route.ts        # Chat endpoint
│   │   ├── health/route.ts      # Health check
│   │   └── redline/route.ts     # Redlining endpoint
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home page
├── components/                   # React components
│   ├── ChatWindow.tsx
│   ├── InputBox.tsx
│   ├── RedlineEditor.tsx        # NEW: Redlining component
│   └── RedlineModal.tsx         # NEW: Redlining modal
├── lib/                         # Utility libraries
│   ├── openai.ts               # Azure OpenAI client
│   └── telemetry.ts            # Application Insights
├── public/                      # Static assets
├── package.json                 # Dependencies & scripts
├── app.js                       # Custom Node.js server
├── startup.sh                   # Azure startup script
├── web.config                   # IIS configuration
├── next.config.js              # Next.js configuration
├── Dockerfile                   # Container deployment
└── .deployment                  # Azure build configuration
```

## 🔑 Required Environment Variables

You need **3 environment variables** in your Azure Web App:

```bash
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
```

### How to Set Environment Variables in Azure

**Option 1: Azure Portal**
1. Go to your Azure Web App
2. Navigate to **Settings** → **Configuration**
3. Click **New application setting**
4. Add each variable (name and value)
5. Click **Save** and **Continue**

**Option 2: Azure CLI**
```bash
az webapp config appsettings set \
  --name your-app-name \
  --resource-group your-resource-group \
  --settings \
  AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/" \
  AZURE_OPENAI_API_KEY="your-api-key" \
  AZURE_OPENAI_DEPLOYMENT_NAME="your-deployment"
```

## 🚀 Deployment Methods

### Method 1: GitHub Actions (Recommended)

Your repository includes a GitHub Actions workflow at `.github/workflows/main_dnz-ai1.yml`.

**To deploy:**
1. Push to main branch
2. GitHub Actions automatically deploys to Azure
3. Monitor deployment in the **Actions** tab

### Method 2: Azure CLI

```bash
# Login to Azure
az login

# Deploy from local repository
az webapp up \
  --name your-app-name \
  --resource-group your-resource-group \
  --runtime "NODE:18-lts"
```

### Method 3: Azure Portal (Git Deploy)

1. In Azure Portal, go to your Web App
2. Navigate to **Deployment** → **Deployment Center**
3. Select **GitHub** as source
4. Authorize and select your repository
5. Select the **main** branch
6. Save configuration

### Method 4: Local Git Deploy

```bash
# Add Azure remote
az webapp deployment source config-local-git \
  --name your-app-name \
  --resource-group your-resource-group

# Get deployment credentials
az webapp deployment list-publishing-credentials \
  --name your-app-name \
  --resource-group your-resource-group

# Push to Azure
git remote add azure <deployment-git-url>
git push azure main
```

## 📦 Build Process

Azure will automatically:
1. Detect Node.js application
2. Run `npm install`
3. Run `npm run build` (which executes `next build`)
4. Start the application with `npm start` (which runs `node app.js`)

### Custom Build Configuration

The `.deployment` file ensures:
- `SCM_DO_BUILD_DURING_DEPLOYMENT=true` - Builds on Azure

The `package.json` includes:
```json
{
  "scripts": {
    "build": "next build",
    "start": "node app.js",
    "postinstall": "next build"
  }
}
```

## 🔍 Verifying Deployment

### Health Check Endpoint
```bash
curl https://your-app.azurewebsites.net/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T16:00:00.000Z"
}
```

### Check Logs
```bash
# Stream logs
az webapp log tail --name your-app-name --resource-group your-resource-group

# Download logs
az webapp log download --name your-app-name --resource-group your-resource-group
```

### Azure Portal Logs
1. Go to your Web App
2. Navigate to **Monitoring** → **Log stream**
3. View real-time logs

## 🐛 Troubleshooting

### Common Issues

**1. Application won't start**
- Check environment variables are set correctly
- Verify `AZURE_OPENAI_ENDPOINT` has trailing slash
- Check logs for error messages

**2. Build fails**
- Ensure Node.js version is compatible (18-lts recommended)
- Check `package.json` for correct dependencies
- Verify no TypeScript errors: `npm run build` locally

**3. 404 errors**
- Check `web.config` is present
- Verify `app.js` exists at root
- Ensure build completed successfully

**4. API endpoints not working**
- Verify environment variables are set
- Check API routes exist in `app/api/`
- Review Application Insights for errors

### Debug Commands

```bash
# Check app settings
az webapp config appsettings list \
  --name your-app-name \
  --resource-group your-resource-group

# Restart app
az webapp restart \
  --name your-app-name \
  --resource-group your-resource-group

# Check deployment status
az webapp deployment list \
  --name your-app-name \
  --resource-group your-resource-group
```

## 🎨 New Features

### Document Redlining
- AI-powered document revision
- Visual track changes (red/green highlighting)
- Accept/reject individual changes
- Export clean documents

**Endpoint:** `/api/redline`
**Access:** Click "Redline" button in chat interface

See `REDLINING_FEATURE.md` for detailed documentation.

## 📊 Monitoring

### Application Insights
Telemetry is automatically sent to Azure Application Insights (if configured).

Monitor:
- Request rates
- Response times
- Errors and exceptions
- Custom events (chat messages, redlines)

### Metrics to Watch
- Response time for `/api/chat`
- Response time for `/api/redline`
- Error rates
- OpenAI API usage

## 🔒 Security

### Environment Variables
- Never commit `.env` files
- Use Azure Key Vault for sensitive data (optional)
- Rotate API keys regularly

### Network Security
- Enable HTTPS only
- Configure CORS if needed
- Use Azure Private Endpoints for OpenAI (optional)

### Authentication
- Consider adding Azure AD authentication
- Implement IP restrictions if needed
- Enable audit logging

## 📈 Scaling

### Vertical Scaling
```bash
az appservice plan update \
  --name your-plan-name \
  --resource-group your-resource-group \
  --sku P1V2
```

### Horizontal Scaling
```bash
az appservice plan update \
  --name your-plan-name \
  --resource-group your-resource-group \
  --number-of-workers 3
```

### Auto-scaling
Configure in Azure Portal:
1. **Settings** → **Scale out (App Service plan)**
2. Choose **Custom autoscale**
3. Add scale rules based on CPU/memory

## 🔄 CI/CD Pipeline

The included GitHub Actions workflow handles:
- ✅ Code checkout
- ✅ Node.js setup
- ✅ Dependency installation
- ✅ Build process
- ✅ Deployment to Azure
- ✅ Health check verification

## 📞 Support

### Resources
- [Azure Web Apps Documentation](https://docs.microsoft.com/azure/app-service/)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Azure OpenAI Documentation](https://learn.microsoft.com/azure/ai-services/openai/)

### Useful Scripts
- `azure-troubleshoot.sh` - Diagnostic script
- `check-deployment-method.sh` - Verify deployment config
- `deploy-azure.sh` - Quick deployment script

---

**Last Updated:** 2025-11-21  
**Repository:** https://github.com/joshnel2/Azuretest  
**Application:** Dorf Nelson & Zauderer Confidential AI Assistant
