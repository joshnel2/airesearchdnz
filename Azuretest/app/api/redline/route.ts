import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/openai';
import { logChatMessage } from '@/lib/telemetry';

const REDLINE_SYSTEM_PROMPT = `You are an expert legal document editor and attorney assistant specializing in document revision and redlining.

Your role is to:
1. Carefully review legal documents for clarity, accuracy, and legal soundness
2. Suggest precise edits, improvements, and corrections
3. Maintain the legal intent and professional tone of the document
4. Flag potential issues, ambiguities, or problematic language
5. Ensure consistency in terminology and formatting
6. Improve readability while preserving legal precision

When revising documents:
- Make targeted, purposeful changes
- Preserve the original structure unless improvement is needed
- Use clear, precise legal language
- Fix grammatical errors and typos
- Improve sentence structure for clarity
- Ensure consistent terminology
- Add necessary legal qualifications or disclaimers where appropriate
- Remove redundant or unclear language

Output ONLY the revised version of the document. Do not add explanations, commentary, or metadata. The output should be the complete revised document that will be compared against the original to generate redline markup.`;

export interface RedlineRequest {
  originalText: string;
  instructions?: string;
  documentType?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { originalText, instructions, documentType }: RedlineRequest = await req.json();

    if (!originalText) {
      return NextResponse.json(
        { error: 'Original text is required' },
        { status: 400 }
      );
    }

    const { client: openaiClient, deploymentName } = createOpenAIClient();
    
    // Build the user prompt
    let userPrompt = `Please review and revise the following ${documentType || 'legal document'}.\n\n`;
    
    if (instructions) {
      userPrompt += `Specific instructions: ${instructions}\n\n`;
    }
    
    userPrompt += `Original Document:\n\n${originalText}\n\n`;
    userPrompt += `Provide the complete revised version:`;

    const messages = [
      { role: 'system', content: REDLINE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ];

    const response = await openaiClient.chat.completions.create({
      model: deploymentName as any,
      messages: messages as any,
      temperature: 0.3, // Lower temperature for more consistent, conservative edits
      max_tokens: 4000
    });

    const revisedText = response.choices[0]?.message?.content || '';

    // Log the redline request
    const userId = req.headers.get('x-forwarded-for') || 'anonymous';
    logChatMessage(userId, `Redline request: ${documentType || 'document'}`, 'Redline generated');

    return NextResponse.json({
      originalText,
      revisedText,
      success: true
    });
  } catch (error: any) {
    console.error('Error in redline API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate redline' },
      { status: 500 }
    );
  }
}
