'use client';

import React, { useState, useRef } from 'react';
import RedlineEditor from './RedlineEditor';

export default function RedlineInterface() {
  const [originalText, setOriginalText] = useState('');
  const [revisedText, setRevisedText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setError('');

    try {
      const content = await readFileContent(file);
      setOriginalText(content);
    } catch (err: any) {
      setError(`Failed to read file: ${err.message}`);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const result = e.target?.result;
        
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            const arrayBuffer = result as ArrayBuffer;
            const pdfjsLib = await import('pdfjs-dist');
            
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
            
            const uint8Array = new Uint8Array(arrayBuffer);
            const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
            
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(' ');
              fullText += `${pageText}\n\n`;
            }
            
            resolve(fullText.trim());
          } catch (error) {
            console.error('PDF parsing error:', error);
            reject(new Error('Failed to parse PDF file. Please ensure the PDF contains text.'));
          }
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   file.name.toLowerCase().endsWith('.docx')) {
          try {
            const arrayBuffer = result as ArrayBuffer;
            const mammoth = await import('mammoth');
            const mammothResult = await mammoth.extractRawText({ arrayBuffer });
            
            if (mammothResult.value && mammothResult.value.trim().length > 0) {
              resolve(mammothResult.value);
            } else {
              reject(new Error('Word document appears to be empty or corrupted'));
            }
          } catch (error) {
            reject(new Error('Failed to parse Word document'));
          }
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                   file.type === 'application/vnd.ms-excel' ||
                   file.name.toLowerCase().endsWith('.xlsx') ||
                   file.name.toLowerCase().endsWith('.xls')) {
          try {
            const arrayBuffer = result as ArrayBuffer;
            const xlsx = await import('xlsx');
            const workbook = xlsx.read(arrayBuffer, { type: 'array' });
            
            let excelContent = '';
            workbook.SheetNames.forEach((sheetName) => {
              const sheet = workbook.Sheets[sheetName];
              const csvData = xlsx.utils.sheet_to_csv(sheet);
              excelContent += `Sheet: ${sheetName}\n${csvData}\n\n`;
            });
            
            resolve(excelContent.trim());
          } catch (error) {
            reject(new Error('Failed to parse Excel file'));
          }
        } else {
          // Plain text files
          const content = result as string;
          resolve(content || '');
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      // Read as ArrayBuffer for PDFs, Excel, and Word docs, text for others
      if (file.type === 'application/pdf' || 
          file.name.toLowerCase().endsWith('.pdf') ||
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.type === 'application/vnd.ms-excel' ||
          file.name.toLowerCase().endsWith('.docx') ||
          file.name.toLowerCase().endsWith('.xlsx') ||
          file.name.toLowerCase().endsWith('.xls')) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleGenerateRedline = async () => {
    if (!originalText.trim()) {
      setError('Please enter document text or upload a file');
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

  const handleExportFinal = async (text: string, filePrefix: string = 'final') => {
    try {
      // Import docx library dynamically
      const { Document, Paragraph, TextRun, Packer } = await import('docx');
      
      // Split text into paragraphs
      const paragraphs = text.split('\n').map(line => 
        new Paragraph({
          children: [new TextRun(line || ' ')], // Use space for empty lines
        })
      );
      
      // Create Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs,
        }],
      });
      
      // Generate blob
      const blob = await Packer.toBlob(doc);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = uploadedFileName 
        ? `${filePrefix}-${uploadedFileName.replace(/\.[^/.]+$/, '')}.docx`
        : `${filePrefix}-document-${Date.now()}.docx`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting document:', error);
      alert('Failed to export document. Please try again.');
    }
  };

  const handleExportRedlined = async () => {
    try {
      // Import docx and diff libraries
      const { Document, Paragraph, TextRun, Packer } = await import('docx');
      const Diff = await import('diff');
      
      // Get the diff between original and revised
      const diff = Diff.diffWords(originalText, revisedText);
      
      // Build paragraphs with formatted text runs
      const paragraphs: any[] = [];
      let currentParagraph: any[] = [];
      
      diff.forEach((part) => {
        const text = part.value;
        const lines = text.split('\n');
        
        lines.forEach((line, index) => {
          if (part.added) {
            // Green text for additions
            currentParagraph.push(
              new TextRun({
                text: line,
                color: '008000', // Green
                bold: true,
              })
            );
          } else if (part.removed) {
            // Red strikethrough for deletions
            currentParagraph.push(
              new TextRun({
                text: line,
                color: 'FF0000', // Red
                strike: true,
              })
            );
          } else {
            // Normal text
            currentParagraph.push(
              new TextRun({
                text: line,
              })
            );
          }
          
          // Create new paragraph on line break (except for last line)
          if (index < lines.length - 1) {
            paragraphs.push(
              new Paragraph({
                children: currentParagraph.length > 0 ? currentParagraph : [new TextRun(' ')],
              })
            );
            currentParagraph = [];
          }
        });
      });
      
      // Add remaining content
      if (currentParagraph.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: currentParagraph,
          })
        );
      }
      
      // Create Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun(' ')] })],
        }],
      });
      
      // Generate blob
      const blob = await Packer.toBlob(doc);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = uploadedFileName 
        ? `redlined-${uploadedFileName.replace(/\.[^/.]+$/, '')}.docx`
        : `redlined-document-${Date.now()}.docx`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting redlined document:', error);
      alert('Failed to export redlined document. Please try again.');
    }
  };

  const handleReset = () => {
    setShowEditor(false);
    setRevisedText('');
    setError('');
  };

  const handleNewDocument = () => {
    setShowEditor(false);
    setRevisedText('');
    setOriginalText('');
    setInstructions('');
    setDocumentType('');
    setUploadedFileName('');
    setError('');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {!showEditor ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-8">
            {/* Welcome Section */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                AI-Powered Legal Document Redlining
              </h2>
              <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                Upload your legal documents or paste text below. Our AI will review, revise, and provide tracked changes with professional legal precision.
              </p>
            </div>

            {/* File Upload Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Upload Document
              </label>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="font-medium">Choose File</span>
                </button>
                {uploadedFileName && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{uploadedFileName}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Accepts any file type. Best results with: PDF, DOCX, TXT, RTF, XLSX, CSV
              </p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Document Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Document Type (optional)
                  </label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">Select type...</option>
                    <option value="Contract">Contract</option>
                    <option value="Agreement">Agreement</option>
                    <option value="Motion">Motion</option>
                    <option value="Brief">Brief</option>
                    <option value="Letter">Letter</option>
                    <option value="Memorandum">Memorandum</option>
                    <option value="Pleading">Pleading</option>
                    <option value="Discovery">Discovery Document</option>
                    <option value="Other">Other Legal Document</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Revision Instructions (optional)
                  </label>
                  <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g., Make more concise, Fix grammar, Add disclaimers"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Document Text
                </label>
                <textarea
                  value={originalText}
                  onChange={(e) => setOriginalText(e.target.value)}
                  placeholder="Paste your document text here, or upload a file above..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm resize-none"
                  rows={16}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleNewDocument}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Clear All
              </button>
              <button
                onClick={handleGenerateRedline}
                disabled={isLoading || !originalText.trim()}
                className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm hover:shadow-md font-medium"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Generating Redline...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Generate Redline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <div className="flex-shrink-0 flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleReset}
                className="text-sm px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Edit</span>
              </button>
              <button
                onClick={handleNewDocument}
                className="text-sm px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-colors flex items-center space-x-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Document</span>
              </button>
              {(documentType || uploadedFileName) && (
                <div className="flex items-center space-x-3 text-sm text-gray-600 ml-4">
                  {uploadedFileName && (
                    <span className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium">{uploadedFileName}</span>
                    </span>
                  )}
                  {documentType && (
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium">
                      {documentType}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <RedlineEditor
              originalText={originalText}
              revisedText={revisedText}
              onExportFinal={handleExportFinal}
              onExportRedlined={handleExportRedlined}
            />
          </div>
        </div>
      )}
    </div>
  );
}
