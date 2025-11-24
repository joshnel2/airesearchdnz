'use client';

import { useState, useEffect } from 'react';

interface WestlawConnectionProps {
  onConnectionChange?: (connected: boolean) => void;
}

export default function WestlawConnection({ onConnectionChange }: WestlawConnectionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/westlaw/connect');
      const data = await response.json();
      
      if (data.connected) {
        setIsConnected(true);
        setMaskedKey(data.maskedKey);
        onConnectionChange?.(true);
      }
    } catch (err) {
      console.error('Error checking connection:', err);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/westlaw/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey, clientId }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsConnected(true);
        setMaskedKey(data.maskedKey);
        setShowForm(false);
        setApiKey('');
        setClientId('');
        setSuccess('Successfully connected to Westlaw!');
        onConnectionChange?.(true);
      } else {
        setError(data.error || 'Failed to connect');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
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
        setMaskedKey('');
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

      {isConnected && !showForm && (
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">API Key</p>
            <p className="text-sm font-mono text-gray-900">{maskedKey}</p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
          >
            {loading ? 'Disconnecting...' : 'Disconnect Westlaw'}
          </button>
        </div>
      )}

      {!isConnected && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Connect Westlaw Account
        </button>
      )}

      {showForm && (
        <form onSubmit={handleConnect} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Westlaw API Key *
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Westlaw API key"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Client ID (Optional)
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Enter your client ID"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={loading || !apiKey}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError('');
              }}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Your API key is stored securely and encrypted. Get your API key from{' '}
            <a
              href="https://developer.thomsonreuters.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Thomson Reuters Developer Portal
            </a>
          </p>
        </form>
      )}
    </div>
  );
}
