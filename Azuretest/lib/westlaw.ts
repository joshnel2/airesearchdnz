import axios, { AxiosInstance } from 'axios';

export interface WestlawConfig {
  apiKey: string;
  clientId?: string;
}

export interface WestlawSearchResult {
  documentId: string;
  title: string;
  citation: string;
  snippet: string;
  jurisdiction?: string;
  court?: string;
  date?: string;
  url?: string;
  relevanceScore?: number;
}

export interface WestlawSearchResponse {
  results: WestlawSearchResult[];
  totalResults: number;
  query: string;
}

export interface WestlawDocument {
  documentId: string;
  title: string;
  fullText: string;
  citation: string;
  metadata: Record<string, any>;
}

export class WestlawClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string;

  constructor(config: WestlawConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = process.env.WESTLAW_API_BASE_URL || 'https://api.westlaw.com/v1';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Search the Westlaw database
   * @param query - Natural language or boolean search query
   * @param options - Search options (jurisdiction, date range, document type, etc.)
   */
  async search(
    query: string,
    options: {
      jurisdiction?: string[];
      documentType?: string[];
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<WestlawSearchResponse> {
    try {
      const params = {
        q: query,
        jurisdiction: options.jurisdiction?.join(','),
        documentType: options.documentType?.join(','),
        startDate: options.startDate,
        endDate: options.endDate,
        limit: options.limit || 10,
        offset: options.offset || 0,
      };

      // Filter out undefined values
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined)
      );

      const response = await this.client.get('/search', {
        params: filteredParams,
      });

      return this.parseSearchResponse(response.data, query);
    } catch (error) {
      console.error('Westlaw search error:', error);
      throw new Error('Failed to search Westlaw database');
    }
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string): Promise<WestlawDocument> {
    try {
      const response = await this.client.get(`/documents/${documentId}`);
      return this.parseDocumentResponse(response.data);
    } catch (error) {
      console.error('Westlaw document retrieval error:', error);
      throw new Error('Failed to retrieve document from Westlaw');
    }
  }

  /**
   * Search for cases by citation
   */
  async searchByCitation(citation: string): Promise<WestlawDocument | null> {
    try {
      const response = await this.client.get('/citations', {
        params: { citation },
      });
      
      if (response.data && response.data.documentId) {
        return this.getDocument(response.data.documentId);
      }
      
      return null;
    } catch (error) {
      console.error('Westlaw citation search error:', error);
      return null;
    }
  }

  /**
   * Get headnotes for a specific case
   */
  async getHeadnotes(documentId: string): Promise<string[]> {
    try {
      const response = await this.client.get(`/documents/${documentId}/headnotes`);
      return response.data.headnotes || [];
    } catch (error) {
      console.error('Westlaw headnotes retrieval error:', error);
      return [];
    }
  }

  /**
   * Get KeyCite information for a case
   */
  async getKeyCite(citation: string): Promise<any> {
    try {
      const response = await this.client.get('/keycite', {
        params: { citation },
      });
      return response.data;
    } catch (error) {
      console.error('Westlaw KeyCite error:', error);
      return null;
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.client.get('/validate');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private parseSearchResponse(data: any, query: string): WestlawSearchResponse {
    const results: WestlawSearchResult[] = (data.results || []).map((item: any) => ({
      documentId: item.documentId || item.id,
      title: item.title || item.name,
      citation: item.citation || '',
      snippet: item.snippet || item.summary || '',
      jurisdiction: item.jurisdiction,
      court: item.court,
      date: item.decisionDate || item.date,
      url: item.url || `https://next.westlaw.com/Document/${item.documentId}`,
      relevanceScore: item.relevanceScore || item.score,
    }));

    return {
      results,
      totalResults: data.totalResults || results.length,
      query,
    };
  }

  private parseDocumentResponse(data: any): WestlawDocument {
    return {
      documentId: data.documentId || data.id,
      title: data.title || data.name,
      fullText: data.fullText || data.text || data.content || '',
      citation: data.citation || '',
      metadata: {
        jurisdiction: data.jurisdiction,
        court: data.court,
        date: data.decisionDate || data.date,
        judges: data.judges,
        parties: data.parties,
        docketNumber: data.docketNumber,
        ...data.metadata,
      },
    };
  }
}

/**
 * Format search results for AI consumption
 */
export function formatSearchResultsForAI(
  searchResponse: WestlawSearchResponse
): string {
  if (searchResponse.results.length === 0) {
    return `No results found in Westlaw for query: "${searchResponse.query}"`;
  }

  let formatted = `Westlaw Search Results for "${searchResponse.query}" (${searchResponse.totalResults} total results):\n\n`;

  searchResponse.results.forEach((result, index) => {
    formatted += `${index + 1}. ${result.title}\n`;
    formatted += `   Citation: ${result.citation}\n`;
    if (result.court) formatted += `   Court: ${result.court}\n`;
    if (result.date) formatted += `   Date: ${result.date}\n`;
    if (result.jurisdiction) formatted += `   Jurisdiction: ${result.jurisdiction}\n`;
    formatted += `   Summary: ${result.snippet}\n`;
    if (result.url) formatted += `   URL: ${result.url}\n`;
    formatted += '\n';
  });

  return formatted;
}

/**
 * Format document for AI consumption
 */
export function formatDocumentForAI(document: WestlawDocument): string {
  let formatted = `Document: ${document.title}\n`;
  formatted += `Citation: ${document.citation}\n\n`;

  if (document.metadata) {
    if (document.metadata.court) formatted += `Court: ${document.metadata.court}\n`;
    if (document.metadata.date) formatted += `Date: ${document.metadata.date}\n`;
    if (document.metadata.jurisdiction) formatted += `Jurisdiction: ${document.metadata.jurisdiction}\n`;
    if (document.metadata.docketNumber) formatted += `Docket Number: ${document.metadata.docketNumber}\n`;
    formatted += '\n';
  }

  formatted += `Full Text:\n${document.fullText}\n`;

  return formatted;
}

/**
 * Determine if a query should trigger Westlaw search
 */
export function shouldSearchWestlaw(message: string): boolean {
  const legalKeywords = [
    'case law', 'precedent', 'statute', 'regulation', 'legal research',
    'find cases', 'search law', 'westlaw', 'legal database',
    'citation', 'keycite', 'headnote', 'jurisdiction',
    'court decision', 'judicial opinion', 'legal authority',
    'case about', 'law on', 'legal standard', 'court held',
    'supreme court', 'circuit court', 'district court',
    'federal law', 'state law', 'constitutional', 'statutory'
  ];

  const messageLower = message.toLowerCase();
  return legalKeywords.some(keyword => messageLower.includes(keyword));
}

/**
 * Extract citations from text
 */
export function extractCitations(text: string): string[] {
  // Common citation patterns
  const patterns = [
    /\d+\s+[A-Z][a-z.]+\s+\d+/g, // e.g., "410 U.S. 113"
    /\d+\s+[A-Z]\.\s*\d+d\s+\d+/g, // e.g., "123 F.3d 456"
    /\d+\s+S\.\s*Ct\.\s+\d+/g, // e.g., "100 S. Ct. 1234"
  ];

  const citations: Set<string> = new Set();

  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => citations.add(match.trim()));
    }
  });

  return Array.from(citations);
}
