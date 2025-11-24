# DNZ AI Document Redlining System

Professional AI-powered legal document redlining for Dorf Nelson & Zauderer LLP.

## Overview

This application provides attorneys with advanced AI-powered document redlining capabilities using Azure OpenAI. Upload legal documents or paste text, and receive intelligent revisions with visual track changes (additions in green, deletions in red).

## Key Features

### 🎯 AI-Powered Document Revision
- Intelligent legal document editing and improvement
- Maintains legal intent and professional tone
- Context-aware suggestions based on document type
- Conservative editing approach for legal precision

### 📄 Multiple File Format Support
- **PDF** - Extract and redline PDF documents
- **Word** (.docx, .doc) - Process Word documents
- **Text** (.txt, .rtf, .csv) - Plain text files
- **Excel** (.xlsx, .xls) - Spreadsheet data

### 🎨 Visual Track Changes
- **Green highlighting** - Additions and improvements
- **Red strikethrough** - Deletions and removed text
- **Interactive controls** - Hover to accept/reject individual changes
- **Real-time statistics** - Track additions, deletions, pending changes

### ⚡ Professional Workflow
- Upload documents or paste text directly
- Specify document type (Contract, Brief, Motion, etc.)
- Provide custom revision instructions
- Accept/reject changes individually or in bulk
- Export clean final documents

## Technology Stack

- **Next.js 14** - React framework with App Router
- **Azure OpenAI** - GPT-4 powered document analysis
- **TypeScript** - Type-safe code
- **Tailwind CSS** - Modern, responsive UI
- **Diff Library** - Precise word-level change tracking

## Setup & Deployment

### Environment Variables

You need **3 environment variables** from Azure AI Foundry:

```bash
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
```

### Local Development

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your Azure credentials

# Run development server
npm run dev

# Open http://localhost:3000
```

### Azure Deployment

The repository is structured for Azure Web App deployment:

```bash
# Using Azure CLI
az webapp up \
  --name your-app-name \
  --resource-group your-resource-group \
  --runtime "NODE:18-lts"

# Or use GitHub Actions (workflow included)
git push origin main
```

See `AZURE_DEPLOYMENT_GUIDE.md` for detailed deployment instructions.

## How to Use

### 1. Upload or Paste Document

**Option A: Upload File**
- Click "Choose File" button
- Select your legal document (PDF, Word, Text, Excel)
- Document text is automatically extracted

**Option B: Paste Text**
- Copy your document text
- Paste directly into the text area

### 2. Configure Settings (Optional)

- **Document Type**: Select from Contract, Agreement, Motion, Brief, etc.
- **Revision Instructions**: Specify custom editing goals
  - Examples: "Make more concise", "Fix grammar", "Add legal disclaimers"

### 3. Generate Redline

- Click "Generate Redline" button
- AI analyzes and revises the document
- Track changes are displayed with color coding

### 4. Review Changes

- **Green text** = Additions
- **Red strikethrough** = Deletions
- Hover over changes to accept/reject
- View statistics: additions, deletions, pending

### 5. Finalize Document

- **Accept All** - Keep all AI suggestions
- **Reject All** - Revert to original
- **Export Clean** - Download final version
- **New Document** - Start over with new file

## API Endpoints

### `POST /api/redline`

Generate AI-powered redline for a document.

**Request:**
```json
{
  "originalText": "string",
  "instructions": "string (optional)",
  "documentType": "string (optional)"
}
```

**Response:**
```json
{
  "originalText": "string",
  "revisedText": "string",
  "success": true
}
```

### `GET /api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T16:00:00.000Z"
}
```

## Project Structure

```
/
├── app/
│   ├── api/
│   │   ├── redline/route.ts    # Redlining AI endpoint
│   │   └── health/route.ts     # Health check
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main page
├── components/
│   ├── RedlineInterface.tsx    # Main UI component
│   ├── RedlineEditor.tsx       # Track changes viewer
│   └── RedlineModal.tsx        # Legacy modal (unused)
├── lib/
│   ├── openai.ts              # Azure OpenAI client
│   └── telemetry.ts           # Application Insights
├── public/                     # Static assets
├── package.json               # Dependencies
├── app.js                     # Custom Node.js server
├── web.config                 # IIS configuration
└── startup.sh                 # Azure startup script
```

## Document Types Supported

The AI is optimized for various legal document types:

- **Contracts** - Purchase agreements, service contracts
- **Agreements** - NDAs, partnership agreements
- **Motions** - Court motions and filings
- **Briefs** - Legal briefs and memoranda
- **Letters** - Legal correspondence
- **Pleadings** - Complaints, answers, petitions
- **Discovery** - Interrogatories, requests for production
- **Memoranda** - Legal memos and research

## AI Behavior

The redlining AI is designed to:

✅ **Maintain Legal Intent** - Preserves original legal meaning  
✅ **Professional Tone** - Keeps formal legal language  
✅ **Conservative Edits** - Makes purposeful, targeted changes  
✅ **Grammar & Clarity** - Fixes errors, improves readability  
✅ **Consistency** - Ensures consistent terminology  
✅ **Flag Issues** - Identifies potential problems or ambiguities  

Temperature is set to 0.3 for consistent, reliable editing.

## Security & Compliance

- **Confidential Processing** - All processing is internal
- **No Data Storage** - Documents are not permanently stored
- **Azure Security** - Leverages Azure's enterprise-grade security
- **HTTPS Only** - Encrypted data transmission
- **Access Control** - Internal use for DNZ LLP staff only

## Monitoring

Application includes Azure Application Insights telemetry:

- Request rates and response times
- Error tracking and diagnostics
- Custom events (redline requests)
- Performance metrics

## Support & Documentation

- `REDLINING_FEATURE.md` - Detailed feature documentation
- `AZURE_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `AZURE_DEPLOYMENT.md` - Azure-specific configuration

## Development

### Key Dependencies

```json
{
  "next": "14.2.5",
  "react": "^18",
  "openai": "^4.57.0",
  "diff": "^5.0.0",
  "pdfjs-dist": "3.11.174",
  "mammoth": "^1.11.0",
  "xlsx": "^0.18.5"
}
```

### Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

## License

Proprietary - For internal use by Dorf Nelson & Zauderer LLP only.

## Version

**Version:** 2.0  
**Last Updated:** 2025-11-21  
**Focus:** AI Document Redlining

---

**Dorf Nelson & Zauderer LLP**  
Confidential Legal Technology
