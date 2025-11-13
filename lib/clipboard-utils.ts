import { ClipboardHistoryItem } from "./types";

export const canCopyToClipboard = (item: ClipboardHistoryItem): boolean => {
  // Text-based content can always be copied
  if (['text', 'html', 'code', 'url', 'contact', 'rich-text'].includes(item.type)) {
    return true;
  }

  // Files/images may not be supported by all browsers
  if (['image', 'file'].includes(item.type)) {
    // Check if browser supports writing files to clipboard
    return !!(navigator.clipboard && navigator.clipboard.write);
  }

  return false;
};

export const detectContentType = (clipboardData: globalThis.DataTransfer): {
  type: ClipboardHistoryItem['type'];
  content: string;
  file?: File;
} | null => {
  // Check for files first (images, documents, etc.)
  if (clipboardData.files && clipboardData.files.length > 0) {
    const files = Array.from(clipboardData.files) as File[];
    const file = files[0]; // Process first file

    if (file.type.startsWith('image/')) {
      return { type: 'image', content: `Image: ${file.type}`, file };
    } else {
      return { type: 'file', content: `File: ${file.name || file.type}`, file };
    }
  }

  // Check for HTML/rich text content first (before text)
  const htmlData = clipboardData.getData('text/html');
  if (htmlData) {
    // Check if it's simple HTML or rich text
    const isRichText = htmlData.includes('<b>') || htmlData.includes('<i>') ||
                      htmlData.includes('<strong>') || htmlData.includes('<em>') ||
                      htmlData.includes('<font') || htmlData.includes('style=');

    return {
      type: isRichText ? 'rich-text' : 'html',
      content: htmlData
    };
  }

  // Check for URLs and special content types
  const textData = clipboardData.getData('text/plain');
  if (textData) {
    // Detect URL content
    if (textData.startsWith('http://') || textData.startsWith('https://')) {
      return { type: 'url', content: textData };
    }
    // Detect code content (simple heuristic)
    else if (textData.includes('function ') || textData.includes('class ') ||
             textData.includes('import ') || textData.includes('export ') ||
             textData.includes('def ') || textData.includes('const ') ||
             textData.includes('let ') || textData.includes('var ')) {
      return { type: 'code', content: textData };
    }
    // Regular text content
    else {
      return { type: 'text', content: textData };
    }
  }

  return null;
};

export const createClipboardHistoryItem = (
  type: ClipboardHistoryItem['type'],
  content: string,
  file?: File,
  isLocal: boolean = true
): ClipboardHistoryItem => {
  const baseItem: ClipboardHistoryItem = {
    id: `${Date.now()}-${Math.random()}`,
    type,
    content,
    timestamp: Date.now(),
    isLocal
  };

  if (file) {
    const isImage = file.type.startsWith('image/');
    return {
      ...baseItem,
      data: file,
      mimeType: file.type,
      fileName: file.name || `clipboard-${isImage ? 'image' : 'file'}-${Date.now()}.${file.type.split('/')[1] || 'bin'}`,
      fileSize: file.size,
      previewUrl: isImage ? URL.createObjectURL(file) : undefined
    };
  }

  return baseItem;
};