import { NextRequest, NextResponse } from 'next/server';
import { getUserSettings } from '@/lib/user-settings';
import { WestlawClient, formatSearchResultsForAI } from '@/lib/westlaw';

export async function POST(req: NextRequest) {
  try {
    const { query, options } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Get user ID and settings
    const userId = req.headers.get('x-user-id') || 
                   req.headers.get('x-forwarded-for') || 
                   'default-user';

    const settings = await getUserSettings(userId);

    if (!settings || !settings.westlawApiKey) {
      return NextResponse.json(
        { error: 'Westlaw API key not configured. Please connect your Westlaw account first.' },
        { status: 401 }
      );
    }

    // Create Westlaw client and perform search
    const client = new WestlawClient({
      apiKey: settings.westlawApiKey,
      clientId: settings.westlawClientId,
    });

    const searchResponse = await client.search(query, options || {});

    return NextResponse.json({
      success: true,
      results: searchResponse.results,
      totalResults: searchResponse.totalResults,
      query: searchResponse.query,
      formattedForAI: formatSearchResultsForAI(searchResponse),
    });
  } catch (error) {
    console.error('Westlaw search error:', error);
    return NextResponse.json(
      { error: 'Failed to search Westlaw database' },
      { status: 500 }
    );
  }
}
