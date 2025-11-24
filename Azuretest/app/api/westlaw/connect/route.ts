import { NextRequest, NextResponse } from 'next/server';
import { saveUserSettings, getUserSettings, deleteUserSettings, maskApiKey } from '@/lib/user-settings';
import { WestlawClient } from '@/lib/westlaw';

export async function POST(req: NextRequest) {
  try {
    const { apiKey, clientId } = await req.json();
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Westlaw API key is required' },
        { status: 400 }
      );
    }

    // Validate API key by attempting to create a client
    const client = new WestlawClient({ apiKey, clientId });
    const isValid = await client.validateApiKey();

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid Westlaw API key. Please check your credentials.' },
        { status: 401 }
      );
    }

    // Get user ID from session or generate one
    const userId = req.headers.get('x-user-id') || 
                   req.headers.get('x-forwarded-for') || 
                   'default-user';

    // Save settings
    await saveUserSettings(userId, {
      westlawApiKey: apiKey,
      westlawClientId: clientId,
    });

    return NextResponse.json({
      success: true,
      message: 'Westlaw API key connected successfully',
      maskedKey: maskApiKey(apiKey),
    });
  } catch (error) {
    console.error('Error connecting Westlaw:', error);
    return NextResponse.json(
      { error: 'Failed to connect Westlaw API' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || 
                   req.headers.get('x-forwarded-for') || 
                   'default-user';

    const settings = await getUserSettings(userId);

    if (!settings || !settings.westlawApiKey) {
      return NextResponse.json({
        connected: false,
      });
    }

    return NextResponse.json({
      connected: true,
      maskedKey: maskApiKey(settings.westlawApiKey),
      hasClientId: !!settings.westlawClientId,
    });
  } catch (error) {
    console.error('Error getting Westlaw status:', error);
    return NextResponse.json(
      { error: 'Failed to get Westlaw status' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || 
                   req.headers.get('x-forwarded-for') || 
                   'default-user';

    await deleteUserSettings(userId);

    return NextResponse.json({
      success: true,
      message: 'Westlaw API key disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Westlaw:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Westlaw API' },
      { status: 500 }
    );
  }
}
