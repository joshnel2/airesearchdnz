# Document Redlining Feature

## Overview

The application now includes a comprehensive AI-powered document redlining system designed specifically for attorneys. This feature allows legal professionals to review, edit, and track changes in legal documents with precision and clarity.

## Key Features

### 1. **AI-Powered Document Revision**
- Upload any legal document (contract, agreement, motion, brief, etc.)
- AI analyzes and suggests improvements for:
  - Clarity and readability
  - Legal precision and accuracy
  - Grammar and formatting
  - Consistent terminology
  - Potential legal issues or ambiguities

### 2. **Visual Track Changes**
- **Additions**: Highlighted in green with underline
- **Deletions**: Highlighted in red with strikethrough
- **Real-time Statistics**: Track additions, deletions, accepted, rejected, and pending changes
- **Interactive Review**: Hover over any change to accept or reject it

### 3. **Granular Control**
- Accept/reject individual changes
- Accept all changes at once
- Reject all changes at once
- Export clean version with accepted changes

### 4. **Professional UI**
- Clean, intuitive interface
- Change statistics dashboard
- Visual legend for change types
- Export functionality for final documents

## How to Use

### Accessing the Redline Tool

1. Click the **"Redline"** button in the chat interface (next to the Upload Files button)
2. The redlining modal will open

### Creating a Redlined Document

1. **Enter Document Information** (optional):
   - Document Type (e.g., Contract, Agreement, Motion, Brief)
   - Revision Instructions (e.g., "Make it more concise", "Fix grammar", "Add legal disclaimers")

2. **Paste Document Text**:
   - Copy and paste your original document text into the text area

3. **Generate Redline**:
   - Click "Generate Redline" button
   - AI will analyze and create a revised version with tracked changes
   - Processing takes a few seconds depending on document length

### Reviewing Changes

Once the redline is generated:

1. **View All Changes**:
   - Green highlighted text = Additions
   - Red strikethrough text = Deletions
   - Change statistics displayed at the top

2. **Accept/Reject Individual Changes**:
   - Hover over any highlighted change
   - Click "✓ Accept" to keep the change
   - Click "✗ Reject" to revert the change
   - Accepted changes turn light green
   - Rejected changes turn light red

3. **Bulk Actions**:
   - **Accept All**: Accept all suggested changes
   - **Reject All**: Reject all suggested changes
   - **Show Changes Only**: Toggle to view only the changes (hide unchanged text)

4. **Export Document**:
   - Click "Export Clean" to download the final version
   - Only accepted changes will be included in the export
   - Downloads as a .txt file

5. **Start Over**:
   - Click "Back to Edit" to return to the input screen
   - Make changes to instructions or document text
   - Generate a new redline

## Technical Details

### AI Behavior

The AI redlining system is designed to:
- Be conservative with changes (not overly aggressive)
- Maintain legal intent and professional tone
- Focus on meaningful improvements
- Preserve document structure unless improvement is needed
- Use clear, precise legal language

### Document Types Supported

The redlining feature works with any text-based legal document:
- Contracts and Agreements
- Motions and Briefs
- Letters and Correspondence
- Legal Memoranda
- Discovery Documents
- Pleadings
- And more

### Integration with Chat Interface

The redlining tool is fully integrated with the main chat interface:
- Accessible via the "Redline" button
- Opens in a modal overlay
- Does not interrupt chat history
- Can be used alongside document upload and chat features

## API Endpoints

### `/api/redline` (POST)

Generates AI-powered redline suggestions for legal documents.

**Request Body**:
```json
{
  "originalText": "string (required)",
  "instructions": "string (optional)",
  "documentType": "string (optional)"
}
```

**Response**:
```json
{
  "originalText": "string",
  "revisedText": "string",
  "success": true
}
```

## Components

### `RedlineEditor.tsx`
- Main redlining component
- Handles diff visualization and change tracking
- Manages accept/reject functionality
- Provides export capabilities

### `RedlineModal.tsx`
- Modal wrapper for redlining interface
- Manages document input and AI interaction
- Integrates with the redline API

### Updated Components
- `ChatWindow.tsx`: Added redline modal integration
- `InputBox.tsx`: Added redline button
- `lib/openai.ts`: Updated system prompt with redlining capabilities

## System Prompt Updates

The AI assistant's system prompt has been enhanced to include:
- Document redlining and track changes expertise
- Legal document revision capabilities
- Clear guidance on editing behavior
- Focus on precision and clarity

## Dependencies

New dependencies added:
- `diff`: ^5.0.0 - For computing text differences
- `react-diff-viewer-continued`: ^3.0.0 - For advanced diff visualization
- `@types/diff`: ^5.0.0 (dev) - TypeScript types for diff library

## Best Practices

1. **Be Specific with Instructions**: Provide clear revision instructions for better results
2. **Review All Changes**: Always review AI suggestions before accepting
3. **Use Document Type**: Specify document type for context-aware suggestions
4. **Export Regularly**: Export your work regularly to avoid losing changes
5. **Iterative Approach**: You can generate multiple redlines with different instructions

## Security Considerations

- All redlining is performed server-side using Azure OpenAI
- Documents are not stored permanently
- All processing is confidential and internal
- Export files are generated client-side in the browser

## Future Enhancements

Potential future improvements:
- Support for multiple document formats (Word, PDF)
- Collaborative redlining with multiple attorneys
- Version history and comparison
- Integration with document management systems
- Advanced formatting preservation
- Comment and annotation features
- Side-by-side comparison view

## Support

For issues or questions about the redlining feature, contact your IT administrator or reference the main application documentation.

---

**Version**: 1.0  
**Last Updated**: 2025-11-21  
**Application**: Dorf Nelson & Zauderer Confidential AI Assistant
