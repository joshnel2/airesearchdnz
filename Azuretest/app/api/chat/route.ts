import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient, SYSTEM_PROMPT } from '@/lib/openai';
import { logChatMessage } from '@/lib/telemetry';
import { getUserSettings } from '@/lib/user-settings';
import { WestlawClient, shouldSearchWestlaw, formatSearchResultsForAI } from '@/lib/westlaw';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  enableWestlaw?: boolean;
}

export async function POST(req: NextRequest) {
  const { messages, enableWestlaw = true }: ChatRequest = await req.json();

  const userMessage = messages[messages.length - 1]?.content || '';
  const userId = req.headers.get('x-user-id') || req.headers.get('x-forwarded-for') || 'anonymous';
  
  // Check if we should search Westlaw
  let westlawContext = '';
  if (enableWestlaw && shouldSearchWestlaw(userMessage)) {
    try {
      const settings = await getUserSettings(userId);
      if (settings?.oauthToken || settings?.westlawApiKey) {
        // SECURITY: OAuth token stays on server, never sent to client
        const client = new WestlawClient({
          oauthToken: settings.oauthToken, // Preferred: OAuth token
          apiKey: settings.westlawApiKey,  // Fallback: Legacy API key
          clientId: settings.westlawClientId,
        });
        
        const searchResponse = await client.search(userMessage, {
          limit: 5,
        });
        
        if (searchResponse.results.length > 0) {
          westlawContext = '\n\n--- Westlaw Search Results ---\n' + 
                          formatSearchResultsForAI(searchResponse) + 
                          '\n--- End Westlaw Results ---\n\n';
        }
      }
    } catch (error) {
      console.error('Westlaw search error in chat:', error);
      // Continue without Westlaw results
    }
  }

  const messagesWithSystem: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT + westlawContext },
    ...messages
  ];
  
  const stream = new ReadableStream({
    async start(controller) {
      const { client: openaiClient, deploymentName } = createOpenAIClient();
      
      const response = await openaiClient.chat.completions.create({
        model: deploymentName as any,
        messages: messagesWithSystem.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: true
      });

      let assistantMessage = '';

      for await (const chunk of response) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          assistantMessage += choice.delta.content;
          const data = JSON.stringify({ content: choice.delta.content });
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        }
      }

      logChatMessage(userId, userMessage, assistantMessage);

      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}