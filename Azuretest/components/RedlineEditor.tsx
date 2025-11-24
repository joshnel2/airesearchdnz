'use client';

import React, { useState, useEffect } from 'react';
import * as Diff from 'diff';

interface Change {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  original: string;
  revised: string;
  lineNumber: number;
  accepted?: boolean;
  rejected?: boolean;
}

interface RedlineEditorProps {
  originalText: string;
  revisedText: string;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onExportFinal?: (text: string, filePrefix?: string) => void | Promise<void>;
  onExportRedlined?: () => void | Promise<void>;
}

export default function RedlineEditor({ 
  originalText, 
  revisedText,
  onAcceptAll,
  onRejectAll,
  onExportFinal,
  onExportRedlined
}: RedlineEditorProps) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const [finalText, setFinalText] = useState(revisedText);

  useEffect(() => {
    generateChanges();
  }, [originalText, revisedText]);

  const generateChanges = () => {
    const diff = Diff.diffWords(originalText, revisedText);
    const changesList: Change[] = [];
    let lineNumber = 1;

    diff.forEach((part, index) => {
      if (part.added) {
        changesList.push({
          id: `change-${index}`,
          type: 'addition',
          original: '',
          revised: part.value,
          lineNumber,
          accepted: undefined
        });
      } else if (part.removed) {
        changesList.push({
          id: `change-${index}`,
          type: 'deletion',
          original: part.value,
          revised: '',
          lineNumber,
          accepted: undefined
        });
      }
      
      // Count line breaks
      const newlines = (part.value.match(/\n/g) || []).length;
      lineNumber += newlines;
    });

    setChanges(changesList);
  };

  const acceptChange = (id: string) => {
    setChanges(prev => prev.map(change => 
      change.id === id ? { ...change, accepted: true, rejected: false } : change
    ));
  };

  const rejectChange = (id: string) => {
    setChanges(prev => prev.map(change => 
      change.id === id ? { ...change, rejected: true, accepted: false } : change
    ));
  };

  const acceptAllChanges = () => {
    setChanges(prev => prev.map(change => ({ ...change, accepted: true, rejected: false })));
    setFinalText(revisedText);
    onAcceptAll?.();
  };

  const rejectAllChanges = () => {
    setChanges(prev => prev.map(change => ({ ...change, rejected: true, accepted: false })));
    setFinalText(originalText);
    onRejectAll?.();
  };

  const renderRedlineText = () => {
    const diff = Diff.diffWords(originalText, revisedText);
    const elements: React.ReactNode[] = [];
    
    for (let index = 0; index < diff.length; index++) {
      const part = diff[index];
      const nextPart = diff[index + 1];
      const changeId = `change-${index}`;
      const change = changes.find(c => c.id === changeId);
      
      // Check if this is a deletion followed by an addition (a replacement)
      const isReplacement = part.removed && nextPart?.added;
      
      if (part.added) {
        const isAccepted = change?.accepted;
        const isRejected = change?.rejected;
        const prevPart = diff[index - 1];
        
        // Skip if this addition is part of a replacement (handled by the deletion)
        if (prevPart?.removed) continue;
        
        if (isRejected) continue;
        
        elements.push(
          <span
            key={index}
            className={`${
              isAccepted 
                ? 'bg-green-100 text-green-900' 
                : 'bg-green-200 text-green-900 border-b-2 border-green-500'
            } px-0.5 inline-flex items-center`}
          >
            <span>{part.value}</span>
            {!isAccepted && (
              <span className="inline-flex items-center space-x-0.5 ml-1 bg-gray-900 text-white text-xs px-1.5 py-0.5 rounded shadow-md">
                <button
                  onClick={() => acceptChange(changeId)}
                  className="hover:text-green-400 px-1 cursor-pointer font-bold"
                  title="Accept this edit"
                >
                  ✓
                </button>
                <span className="text-gray-500">|</span>
                <button
                  onClick={() => rejectChange(changeId)}
                  className="hover:text-red-400 px-1 cursor-pointer font-bold"
                  title="Reject this edit"
                >
                  ✗
                </button>
              </span>
            )}
          </span>
        );
      } else if (part.removed) {
        const isAccepted = change?.accepted;
        const isRejected = change?.rejected;
        const nextChange = changes.find(c => c.id === `change-${index + 1}`);
        
        if (isAccepted) continue;
        
        if (isReplacement) {
          // This is a replacement - show both deletion and addition together with ONE set of buttons
          const allAccepted = isAccepted && nextChange?.accepted;
          const allRejected = isRejected && nextChange?.rejected;
          
          elements.push(
            <span key={index} className="inline-flex items-center">
              <span className={`${
                isRejected 
                  ? 'bg-red-100 text-red-900' 
                  : 'bg-red-200 text-red-900 line-through'
              } px-0.5`}>
                {part.value}
              </span>
              <span className="mx-1 text-gray-500">→</span>
              <span className={`${
                nextChange?.accepted 
                  ? 'bg-green-100 text-green-900' 
                  : 'bg-green-200 text-green-900 border-b-2 border-green-500'
              } px-0.5`}>
                {nextPart.value}
              </span>
              {!allAccepted && !allRejected && (
                <span className="inline-flex items-center space-x-0.5 ml-1 bg-gray-900 text-white text-xs px-1.5 py-0.5 rounded shadow-md">
                  <button
                    onClick={() => {
                      acceptChange(changeId);
                      acceptChange(`change-${index + 1}`);
                    }}
                    className="hover:text-green-400 px-1 cursor-pointer font-bold"
                    title="Accept this edit"
                  >
                    ✓
                  </button>
                  <span className="text-gray-500">|</span>
                  <button
                    onClick={() => {
                      rejectChange(changeId);
                      rejectChange(`change-${index + 1}`);
                    }}
                    className="hover:text-red-400 px-1 cursor-pointer font-bold"
                    title="Reject this edit"
                  >
                    ✗
                  </button>
                </span>
              )}
            </span>
          );
          index++; // Skip the next part since we already processed it
        } else {
          // Pure deletion
          elements.push(
            <span
              key={index}
              className={`${
                isRejected 
                  ? 'bg-red-100 text-red-900' 
                  : 'bg-red-200 text-red-900 line-through'
              } px-0.5 inline-flex items-center`}
            >
              <span>{part.value}</span>
              {!isRejected && (
                <span className="inline-flex items-center space-x-0.5 ml-1 bg-gray-900 text-white text-xs px-1.5 py-0.5 rounded shadow-md">
                  <button
                    onClick={() => acceptChange(changeId)}
                    className="hover:text-green-400 px-1 cursor-pointer font-bold"
                    title="Accept this edit"
                  >
                    ✓
                  </button>
                  <span className="text-gray-500">|</span>
                  <button
                    onClick={() => rejectChange(changeId)}
                    className="hover:text-red-400 px-1 cursor-pointer font-bold"
                    title="Reject this edit"
                  >
                    ✗
                  </button>
                </span>
              )}
            </span>
          );
        }
      } else {
        elements.push(<span key={index}>{part.value}</span>);
      }
    }
    
    return elements;
  };

  const getChangeStats = () => {
    const additions = changes.filter(c => c.type === 'addition').length;
    const deletions = changes.filter(c => c.type === 'deletion').length;
    const accepted = changes.filter(c => c.accepted).length;
    const rejected = changes.filter(c => c.rejected).length;
    const pending = changes.filter(c => !c.accepted && !c.rejected).length;

    return { additions, deletions, accepted, rejected, pending };
  };

  const stats = getChangeStats();

  const exportFinalDocument = () => {
    // Build final text based on accepted/rejected changes
    let result = originalText;
    const diff = Diff.diffWords(originalText, revisedText);
    
    result = diff.map((part, index) => {
      const changeId = `change-${index}`;
      const change = changes.find(c => c.id === changeId);
      
      if (part.added) {
        if (change?.rejected) return '';
        return part.value;
      } else if (part.removed) {
        if (change?.accepted) return '';
        return part.value;
      }
      return part.value;
    }).join('');
    
    onExportFinal?.(result);
  };

  const exportRedlinedDocument = () => {
    onExportRedlined?.();
  };

  const exportCurrentVersion = () => {
    // Build text based on current accept/reject state
    // Pending changes are treated as accepted (included)
    const diff = Diff.diffWords(originalText, revisedText);
    
    const result = diff.map((part, index) => {
      const changeId = `change-${index}`;
      const change = changes.find(c => c.id === changeId);
      
      if (part.added) {
        // Include if accepted OR pending (not rejected)
        if (change?.rejected) return '';
        return part.value;
      } else if (part.removed) {
        // Exclude if accepted, include if rejected OR pending
        if (change?.accepted) return '';
        if (change?.rejected) return part.value;
        // Pending deletion - exclude it (treat as accepted)
        return '';
      }
      return part.value;
    }).join('');
    
    onExportFinal?.(result, 'custom');
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header with Stats and Controls */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Document Redline</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowOnlyChanges(!showOnlyChanges)}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            >
              {showOnlyChanges ? 'Show All' : 'Show Changes Only'}
            </button>
            <button
              onClick={acceptAllChanges}
              className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={rejectAllChanges}
              className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Reject All
            </button>
            <button
              onClick={exportCurrentVersion}
              className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center space-x-1"
              title="Download based on your accept/reject decisions"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download This Version</span>
            </button>
            <button
              onClick={exportRedlinedDocument}
              className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors flex items-center space-x-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Redlined Version</span>
            </button>
            <button
              onClick={exportFinalDocument}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Final Version</span>
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="text-gray-700">{stats.additions} additions</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            <span className="text-gray-700">{stats.deletions} deletions</span>
          </div>
          <div className="text-gray-500">|</div>
          <div className="text-gray-700">
            <span className="font-semibold text-green-600">{stats.accepted}</span> accepted
          </div>
          <div className="text-gray-700">
            <span className="font-semibold text-red-600">{stats.rejected}</span> rejected
          </div>
          <div className="text-gray-700">
            <span className="font-semibold text-blue-600">{stats.pending}</span> pending
          </div>
        </div>
      </div>

      {/* Redline Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {renderRedlineText()}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-center space-x-6 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <span className="bg-green-200 px-2 py-0.5 rounded">text</span>
            <span>= Addition</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="bg-red-200 line-through px-2 py-0.5 rounded">text</span>
            <span>= Deletion</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="bg-green-100 px-2 py-0.5 rounded">text</span>
            <span>= Accepted</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="bg-red-100 px-2 py-0.5 rounded">text</span>
            <span>= Rejected</span>
          </div>
          <div className="text-gray-500">
            Click ✓ or ✗ next to each change
          </div>
        </div>
      </div>
    </div>
  );
}
