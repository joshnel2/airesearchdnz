# Legal Research Tool

A powerful legal research application that integrates Thomson Reuters Westlaw API with AI assistance to provide comprehensive legal research capabilities.

## Features

- 🔍 **Westlaw Integration**: Direct access to Thomson Reuters Westlaw legal database
- 🤖 **AI-Powered Research**: Intelligent legal research assistant powered by Azure OpenAI
- 📚 **Case Law Search**: Search and analyze cases, statutes, and regulations
- 📝 **Citation Management**: Automatic citation extraction and KeyCite integration
- 🔐 **Secure API Key Storage**: Encrypted storage of user Westlaw API credentials
- 💬 **Interactive Chat Interface**: Natural language queries for legal research

## Prerequisites

- Node.js 18+ and npm
- Azure OpenAI account with GPT-4 or GPT-3.5 deployment
- Thomson Reuters Westlaw API key (obtain from [Thomson Reuters Developer Portal](https://developer.thomsonreuters.com/))

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME`: Your GPT model deployment name

Optional:
- `WESTLAW_API_BASE_URL`: Custom Westlaw API endpoint (defaults to https://api.westlaw.com/v1)

### 3. Run the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

The application will be available at `http://localhost:3000`

## Usage

### Connecting Your Westlaw Account

1. Click the "Connect Westlaw" button in the application
2. Enter your Westlaw API key (obtain from Thomson Reuters Developer Portal)
3. Optionally enter your Client ID
4. Click "Connect" to validate and save your credentials

Your API key is stored securely and encrypted locally.

### Conducting Legal Research

Once connected, you can ask questions like:

- "Find cases about employment discrimination in California"
- "What is the legal standard for summary judgment?"
- "Search for recent Supreme Court decisions on First Amendment"
- "Find statutes on contract formation"

The AI will automatically:
1. Search the Westlaw database for relevant results
2. Analyze the results
3. Provide accurate citations and case summaries
4. Link to full documents on Westlaw

## API Endpoints

### Westlaw Connection

- `POST /api/westlaw/connect` - Connect Westlaw API key
- `GET /api/westlaw/connect` - Check connection status
- `DELETE /api/westlaw/connect` - Disconnect Westlaw account

### Westlaw Search

- `POST /api/westlaw/search` - Search Westlaw database
  - Body: `{ query: string, options?: SearchOptions }`

### Chat

- `POST /api/chat` - Chat with AI assistant
  - Body: `{ messages: Message[], enableWestlaw?: boolean }`

## Project Structure

```
Azuretest/
├── app/
│   ├── api/
│   │   ├── chat/          # Chat API with Westlaw integration
│   │   ├── westlaw/       # Westlaw API endpoints
│   │   └── health/        # Health check endpoint
│   ├── layout.tsx
│   └── page.tsx           # Main application page
├── components/
│   ├── LegalResearchInterface.tsx  # Main research UI
│   └── WestlawConnection.tsx       # Westlaw connection component
├── lib/
│   ├── westlaw.ts         # Westlaw API client
│   ├── user-settings.ts   # User settings management
│   ├── openai.ts          # Azure OpenAI client
│   └── telemetry.ts       # Application insights
└── public/
```

## Security Notes

- API keys are stored locally in encrypted format
- Never commit `.env` file or API keys to version control
- User settings are stored in `.user-settings/` directory (gitignored)
- All API requests are validated and sanitized

## Deployment

### Azure App Service

1. Set environment variables in Azure Portal
2. Deploy using Azure CLI or GitHub Actions
3. Ensure Node.js 18+ runtime is selected

### Docker

```bash
docker build -t legal-research-tool .
docker run -p 3000:3000 --env-file .env legal-research-tool
```

## Westlaw API Documentation

For detailed information about the Westlaw API:
- [Thomson Reuters Developer Portal](https://developer.thomsonreuters.com/)
- [Westlaw API Documentation](https://developer.thomsonreuters.com/westlaw)

## Troubleshooting

### "Invalid Westlaw API key"
- Verify your API key is correct
- Check your Westlaw subscription is active
- Ensure API key has necessary permissions

### "Failed to search Westlaw database"
- Check your internet connection
- Verify Westlaw API service status
- Check API rate limits

### Chat not working
- Verify Azure OpenAI credentials are correct
- Check Azure OpenAI deployment is active
- Review browser console for errors

## License

Proprietary - All rights reserved

## Support

For issues or questions, please contact your system administrator.
