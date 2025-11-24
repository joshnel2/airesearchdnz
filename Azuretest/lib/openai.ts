import OpenAI from 'openai';

export const SYSTEM_PROMPT = `You are a legal assistant for Dorf Nelson & Zauderer law firm staff. You specialize in legal document analysis, drafting, and redlining.

Key capabilities:
- Document analysis and review
- Contract drafting and revision
- Legal research and citations
- Document redlining and track changes
- Proofreading and editing legal documents
- Identifying potential legal issues

When asked to review or edit documents, you can:
1. Provide detailed feedback and suggestions
2. Generate redlined versions with tracked changes
3. Improve clarity, consistency, and legal precision
4. Flag potential issues or ambiguities

Focus on the current task and document provided. Keep responses professional and concise. Current year is 2025.`;

export function createOpenAIClient() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

  const baseURL = `${endpoint}/openai/deployments/${deploymentName}`;

  return {
    client: new OpenAI({
      apiKey,
      baseURL,
      defaultQuery: { 'api-version': '2024-08-01-preview' },
      defaultHeaders: {
        'api-key': apiKey,
      },
    }),
    deploymentName
  };
}