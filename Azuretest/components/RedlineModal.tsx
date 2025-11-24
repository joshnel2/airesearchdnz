'use client';

import React, { useState } from 'react';
import RedlineEditor from './RedlineEditor';

interface RedlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
}

export default function RedlineModal({ isOpen, onClose, initialText = '' }: RedlineModalProps) {
  const [originalText, setOriginalText] = useState(initialText);
  const [revisedText, setRevisedText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateRedline = async () => {
    if (!originalText.trim()) {
      setError('Please enter document text');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/redline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalText,
          instructions,
          documentType
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate redline');
      }

      const data = await response.json();
      setRevisedText(data.revisedText);
      setShowEditor(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate redline');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = (text: string) => {
    // Create a downloadable text file
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redlined-document-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setShowEditor(false);
    setRevisedText('');
    setInstructions('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Document Redlining</h2>
            <p className="text-sm text-gray-600 mt-1">AI-powered document revision with track changes</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {!showEditor ? (
            <div className="h-full flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Type (optional)
                  </label>
                  <input
                    type="text"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    placeholder="e.g., Contract, Agreement, Motion, Brief"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Revision Instructions (optional)
                  </label>
                  <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g., Make it more concise, Fix grammar, Add legal disclaimers"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Document Text
                </label>
                <textarea
                  value={originalText}
                  onChange={(e) => setOriginalText(e.target.value)}
                  placeholder="Paste your document text here..."
                  className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateRedline}
                  disabled={isLoading || !originalText.trim()}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Generating Redline...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Generate Redline</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleReset}
                    className="text-sm px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Back to Edit</span>
                  </button>
                  {documentType && (
                    <span className="text-sm text-gray-600">
                      Document Type: <span className="font-semibold">{documentType}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <RedlineEditor
                  originalText={originalText}
                  revisedText={revisedText}
                  onExportFinal={handleExport}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
