/**
 * User Settings Management
 * 
 * SECURITY: Stores OAuth tokens server-side only.
 * Tokens are NEVER sent to the client browser.
 * 
 * In production, use encrypted database (e.g., Azure Key Vault, AWS Secrets Manager)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { OAuthToken } from './westlaw-oauth';

const SETTINGS_DIR = path.join(process.cwd(), '.user-settings');

export interface UserSettings {
  userId: string;
  // Legacy API key support (deprecated in favor of OAuth)
  westlawApiKey?: string;
  westlawClientId?: string;
  // OAuth token storage (SECURE: Server-side only)
  oauthToken?: OAuthToken;
  authMethod?: 'api_key' | 'oauth';
  createdAt: string;
  updatedAt: string;
}

/**
 * Initialize settings directory
 */
async function ensureSettingsDir() {
  try {
    await fs.mkdir(SETTINGS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating settings directory:', error);
  }
}

/**
 * Hash user ID for file storage
 */
function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}

/**
 * Get user settings file path
 */
function getUserSettingsPath(userId: string): string {
  const hashedId = hashUserId(userId);
  return path.join(SETTINGS_DIR, `${hashedId}.json`);
}

/**
 * Save user settings
 * 
 * SECURITY: OAuth tokens stored here are NEVER sent to client
 */
export async function saveUserSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<UserSettings> {
  await ensureSettingsDir();
  
  const filePath = getUserSettingsPath(userId);
  let existingSettings: UserSettings | null = null;

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    existingSettings = JSON.parse(data);
  } catch (error) {
    // File doesn't exist, will create new
  }

  const now = new Date().toISOString();
  const updatedSettings: UserSettings = {
    userId,
    westlawApiKey: settings.westlawApiKey || existingSettings?.westlawApiKey,
    westlawClientId: settings.westlawClientId || existingSettings?.westlawClientId,
    oauthToken: settings.oauthToken || existingSettings?.oauthToken,
    authMethod: settings.authMethod || existingSettings?.authMethod || 'oauth',
    createdAt: existingSettings?.createdAt || now,
    updatedAt: now,
  };

  await fs.writeFile(filePath, JSON.stringify(updatedSettings, null, 2), 'utf-8');
  
  return updatedSettings;
}

/**
 * Get user settings
 */
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  try {
    const filePath = getUserSettingsPath(userId);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Delete user settings
 */
export async function deleteUserSettings(userId: string): Promise<boolean> {
  try {
    const filePath = getUserSettingsPath(userId);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if user has Westlaw configured (OAuth or API key)
 */
export async function hasWestlawConfigured(userId: string): Promise<boolean> {
  const settings = await getUserSettings(userId);
  return !!(settings?.oauthToken || settings?.westlawApiKey);
}

/**
 * Get user's OAuth token (server-side only)
 * SECURITY: This function must NEVER be exposed via API to client
 */
export async function getUserOAuthToken(userId: string): Promise<OAuthToken | null> {
  const settings = await getUserSettings(userId);
  return settings?.oauthToken || null;
}

/**
 * Save user's OAuth token (server-side only)
 * SECURITY: Token is stored server-side and NEVER sent to browser
 */
export async function saveUserOAuthToken(
  userId: string,
  token: OAuthToken
): Promise<void> {
  await saveUserSettings(userId, {
    oauthToken: token,
    authMethod: 'oauth',
  });
}

/**
 * Get masked API key for display
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return '****';
  return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
}
