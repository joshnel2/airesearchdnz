'use client';

import { useState, useEffect } from 'react';

interface WestlawConnectionOAuthProps {
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Westlaw Connection Component with OAuth 2.0
 * 
 * SECURITY ARCHITECTURE:
 * 
 * ✅ Front-Channel (User's Browser):
 * - User clicks "Connect Westlaw"
 * - Redirected to Westlaw login page
 * - User enters THEIR Westlaw credentials at Westlaw (not our app)
 * - Returns with one-time authorization code
 * 
 * 🔒 Back-Channel (Our Server Only):
 * - Server exchanges code for access token using Client Secret
 * - Client Secret NEVER reaches the browser
 * - Access token stored server-side
 * - Token used for API calls on user's behalf
 * 
 * ❌ User NEVER Sees:
 * - Client Secret
 * - Access tokens
 * - Refresh tokens
 * - Any server-side credentials
 */
export default function WestlawConnectionOAuth({ onConnectionChange }: WestlawConnectionOAuthProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkConnection();
    
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth');
    const oauthError = urlParams.get('error');
    
    if (oauthSuccess === 'success') {
      setSuccess('Successfully connected to Westlaw!');
      setIsConnected(true);
      onConnectionChange?.(true);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauthError) {
      setError(decodeURIComponent(oauthError));
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/westlaw/connect');
      const data = await response.json();
      
      if (data.connected) {
        setIsConnected(true);
        onConnectionChange?.(true);
      }
    } catch (err) {
      console.error('Error checking connection:', err);
    }
  };

  /**
   * STEP 1: Initiate OAuth Flow (Front-Channel)
   * 
   * User clicks this button → Gets authorization URL from server
   * → Redirected to Westlaw login page
   * 
   * SECURITY: No secrets involved, only Client ID (public)
   */
  const handleConnect = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get authorization URL from our server
      const response = await fetch('/api/westlaw/oauth/authorize');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate OAuth');
      }

      // Redirect user to Westlaw login page
      // SECURITY: User will enter credentials at Westlaw, not our app
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Westlaw account?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/westlaw/connect', {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsConnected(false);
        setSuccess('Successfully disconnected from Westlaw');
        onConnectionChange?.(false);
      }
    } catch (err) {
      setError('Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">WL</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Westlaw Connection</h3>
            <p className="text-xs text-gray-500">Thomson Reuters Legal Research</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
          <span className="text-xs text-gray-600">
            {isConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>
      </div>

      {(error || success) && (
        <div className={`mb-3 p-3 rounded-lg text-sm ${
          error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
        }`}>
          {error || success}
        </div>
      )}

      {isConnected ? (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-800">Westlaw Authenticated</span>
            </div>
            <p className="text-xs text-green-700">
              Your Westlaw account is connected via secure OAuth 2.0. All API calls are made server-side using your personal access token.
            </p>
          </div>
          
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
          >
            {loading ? 'Disconnecting...' : 'Disconnect Westlaw'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">🔒 Secure OAuth 2.0 Flow</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• You'll login with YOUR Westlaw credentials at Thomson Reuters</li>
              <li>• Your password NEVER passes through our servers</li>
              <li>• We receive only an access token (not your password)</li>
              <li>• All credentials stay secure with Thomson Reuters</li>
            </ul>
          </div>

          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Redirecting...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Connect Westlaw Account</span>
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            By connecting, you'll be redirected to Thomson Reuters to authenticate securely
          </p>
        </div>
      )}

      {/* Security Information */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
            How is this secure?
          </summary>
          <div className="mt-2 space-y-2 text-xs">
            <p><strong>OAuth 2.0 Authorization Code Flow:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>You're redirected to Westlaw's official login page</li>
              <li>You enter your credentials at Westlaw (not here)</li>
              <li>Westlaw sends us a one-time authorization code</li>
              <li>Our server exchanges code for access token (using our Client Secret)</li>
              <li>Access token stored securely on our server (never in browser)</li>
              <li>We use the token to make API requests on your behalf</li>
            </ol>
            <p className="text-green-700 font-medium mt-2">
              ✓ Your Client Secret never leaves our server<br />
              ✓ Your password never touches our systems<br />
              ✓ Access tokens never exposed to your browser
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
