# Westlaw Integration Guide

This guide explains how the Thomson Reuters Westlaw API is integrated into the Legal Research Tool and how to use it effectively.

## Overview

The application integrates with Thomson Reuters Westlaw API to provide:
- **Legal Database Search**: Access to millions of cases, statutes, and regulations
- **Case Law Analysis**: Detailed case information with citations
- **KeyCite**: Case validation and precedent analysis
- **Jurisdiction Filtering**: Search by specific jurisdictions
- **AI Enhancement**: Search results are automatically fed to the AI for analysis

## Architecture

### Components

1. **Westlaw Client** (`lib/westlaw.ts`)
   - Core API client for Westlaw integration
   - Handles authentication, search, and document retrieval
   - Formats results for AI consumption

2. **User Settings** (`lib/user-settings.ts`)
   - Secure storage of user Westlaw API keys
   - File-based storage (can be upgraded to database)
   - Hashed user IDs for privacy

3. **API Routes** (`app/api/westlaw/`)
   - `/api/westlaw/connect` - Manage API key connections
   - `/api/westlaw/search` - Direct search endpoint

4. **UI Components**
   - `WestlawConnection.tsx` - API key management interface
   - `LegalResearchInterface.tsx` - Main research interface

## Getting Your Westlaw API Key

### For Development/Testing

1. Visit the [Thomson Reuters Developer Portal](https://developer.thomsonreuters.com/)
2. Sign up for a developer account
3. Create a new application
4. Generate API credentials
5. Note your API Key and Client ID

### For Production

1. Contact Thomson Reuters sales for an enterprise license
2. Request API access for your organization
3. Configure production API endpoints
4. Set up billing and usage limits

## Configuration

### Environment Variables

```bash
# Optional: Custom Westlaw API endpoint
WESTLAW_API_BASE_URL=https://api.westlaw.com/v1
```

The default endpoint is `https://api.westlaw.com/v1`. Only set this if using a different environment (staging, custom deployment, etc.).

### User API Keys

Users connect their individual Westlaw API keys through the UI:
1. Click "Connect Westlaw" button
2. Enter Westlaw API Key
3. Optionally enter Client ID
4. System validates the key
5. Key is stored securely (encrypted, hashed user ID)

## API Features

### 1. Search

Search the Westlaw database with natural language or boolean queries:

```typescript
const client = new WestlawClient({ apiKey: 'your-api-key' });

const results = await client.search('employment discrimination', {
  jurisdiction: ['US-CA', 'US-NY'],
  documentType: ['cases'],
  limit: 10,
});
```

**Search Options:**
- `jurisdiction`: Array of jurisdiction codes (e.g., ['US-CA', 'US-NY'])
- `documentType`: Filter by type (['cases', 'statutes', 'regulations'])
- `startDate`: Date range start (YYYY-MM-DD)
- `endDate`: Date range end (YYYY-MM-DD)
- `limit`: Number of results (default: 10)
- `offset`: Pagination offset

### 2. Get Document

Retrieve full document by ID:

```typescript
const document = await client.getDocument('document-id-123');
```

Returns full text, metadata, and citation information.

### 3. Search by Citation

Find cases by citation:

```typescript
const case = await client.searchByCitation('410 U.S. 113');
```

### 4. KeyCite

Get KeyCite information (case validity, history):

```typescript
const keycite = await client.getKeyCite('410 U.S. 113');
```

### 5. Headnotes

Retrieve case headnotes:

```typescript
const headnotes = await client.getHeadnotes('document-id-123');
```

## AI Integration

The chat API automatically integrates Westlaw results:

### How It Works

1. User asks a legal research question
2. System detects legal keywords (case law, statutes, etc.)
3. Automatically searches Westlaw database
4. Top 5 results are formatted and added to AI context
5. AI analyzes results and provides informed response

### Triggering Westlaw Search

Westlaw search is triggered when the user's message contains keywords like:
- "case law", "precedent", "statute", "regulation"
- "find cases", "search law", "legal research"
- "citation", "court decision", "judicial opinion"
- Court names: "supreme court", "circuit court", etc.
- Jurisdictions: "federal law", "state law"

### Disabling Westlaw for Specific Queries

```typescript
// In frontend code
fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages: [...],
    enableWestlaw: false, // Disable Westlaw search
  }),
});
```

## Usage Examples

### Example 1: Finding Cases on a Legal Topic

**User Query:**
```
"Find cases about employment discrimination based on pregnancy"
```

**What Happens:**
1. Keywords "cases" and "employment" trigger Westlaw search
2. System searches: `"employment discrimination based on pregnancy"`
3. Returns top 5 relevant cases with citations
4. AI analyzes results and provides:
   - Summary of key cases
   - Legal standards
   - Relevant holdings
   - Citations in proper format

### Example 2: Jurisdiction-Specific Research

**User Query:**
```
"What's the standard for summary judgment in California courts?"
```

**What Happens:**
1. System detects "California" and "courts"
2. Searches with jurisdiction filter: `US-CA`
3. Returns California-specific cases
4. AI explains California's legal standard

### Example 3: Citation Lookup

**User Query:**
```
"Tell me about the case 410 U.S. 113"
```

**What Happens:**
1. System extracts citation: "410 U.S. 113"
2. Direct lookup of that case (Roe v. Wade)
3. Returns full case information
4. AI summarizes the case, holdings, and impact

## Security Considerations

### API Key Storage

- Keys are stored in `.user-settings/` directory
- User IDs are hashed (SHA-256) for filenames
- Keys are stored in plain text in files (protected by file system permissions)
- **Production Recommendation**: Use encrypted database with proper key management

### Best Practices

1. **Never commit API keys** to version control
2. **Rotate keys regularly** (every 90 days)
3. **Monitor usage** for unexpected spikes
4. **Set rate limits** on API calls
5. **Use HTTPS** for all API communications

### Upgrading Security

For production, consider:
- Database encryption (e.g., Azure Key Vault, AWS Secrets Manager)
- API key rotation policies
- User authentication (OAuth, SAML)
- Audit logging of all searches

## Rate Limiting

Westlaw APIs have rate limits. The client handles:
- Request throttling
- Exponential backoff on errors
- Caching of frequent queries (optional)

**Recommendations:**
- Monitor your usage in Thomson Reuters dashboard
- Implement caching for common queries
- Use pagination for large result sets

## Error Handling

The integration gracefully handles errors:

```typescript
try {
  const results = await client.search(query);
} catch (error) {
  // Falls back to AI knowledge without Westlaw results
  console.error('Westlaw search failed:', error);
}
```

Common errors:
- `401 Unauthorized`: Invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `404 Not Found`: Document doesn't exist
- `500 Server Error`: Westlaw service issue

## Testing

### Mock Mode (Development)

For development without a Westlaw API key, the system:
- Accepts any API key in connect form
- Returns empty results for searches
- AI responds based on training data only

### Integration Testing

```bash
# Set test API key
export WESTLAW_API_KEY=test-key

# Run tests
npm test
```

## Monitoring

Track Westlaw usage:
- API call counts
- Response times
- Error rates
- Top queries
- User engagement

Use Application Insights or custom logging.

## Troubleshooting

### "Invalid Westlaw API key"

**Solution:**
- Verify key is correct (copy-paste from portal)
- Check key hasn't expired
- Ensure subscription is active

### "Failed to search Westlaw database"

**Solution:**
- Check internet connectivity
- Verify Westlaw API status
- Check rate limits
- Review API endpoint configuration

### No Results Returned

**Solution:**
- Try broader search terms
- Check jurisdiction filters
- Verify date ranges
- Test with known case citations

### Slow Response Times

**Solution:**
- Reduce result limit
- Use more specific queries
- Implement caching
- Check network latency

## Future Enhancements

Potential improvements:
1. **Advanced Filters**: More granular search options
2. **Citation Network**: Visualize case relationships
3. **Saved Searches**: Store and reuse queries
4. **Alerts**: Monitor new cases on topics
5. **Collaborative Research**: Share findings with team
6. **Export**: Save results to PDF/Word
7. **Analytics**: Track research patterns

## Support

For Westlaw API issues:
- [Thomson Reuters Developer Portal](https://developer.thomsonreuters.com/)
- [Westlaw API Documentation](https://developer.thomsonreuters.com/westlaw)
- [Support Contact](https://legal.thomsonreuters.com/en/support)

For application issues:
- Check logs in Application Insights
- Review error messages in browser console
- Contact system administrator

## API Reference

### WestlawClient Methods

```typescript
class WestlawClient {
  // Search database
  search(query: string, options?: SearchOptions): Promise<WestlawSearchResponse>
  
  // Get specific document
  getDocument(documentId: string): Promise<WestlawDocument>
  
  // Search by citation
  searchByCitation(citation: string): Promise<WestlawDocument | null>
  
  // Get headnotes
  getHeadnotes(documentId: string): Promise<string[]>
  
  // Get KeyCite info
  getKeyCite(citation: string): Promise<any>
  
  // Validate API key
  validateApiKey(): Promise<boolean>
}
```

### Helper Functions

```typescript
// Format results for AI
formatSearchResultsForAI(response: WestlawSearchResponse): string

// Format document for AI
formatDocumentForAI(document: WestlawDocument): string

// Check if query should trigger search
shouldSearchWestlaw(message: string): boolean

// Extract citations from text
extractCitations(text: string): string[]
```

## License

This integration uses Thomson Reuters Westlaw API. Ensure you have proper licensing for your use case.
