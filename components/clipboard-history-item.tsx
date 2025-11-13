"use client";

import { Copy, X, Send } from "lucide-react";
import { toast } from "sonner";
import { ClipboardHistoryItem as ClipboardHistoryItemType } from "@/lib/types";
import { indexedDBStorage } from "@/lib/indexed-db";

interface ClipboardHistoryItemProps {
  item: ClipboardHistoryItemType;
  connectionState: string;
  onDelete: (id: string) => void;
  onSend: (item: ClipboardHistoryItemType) => void;
  t: (key: string) => string;
}

export function ClipboardHistoryItem({
  item,
  connectionState,
  onDelete,
  onSend,
  t
}: ClipboardHistoryItemProps) {
  const handleCopyToClipboard = async (item: ClipboardHistoryItemType) => {
    try {
      switch (item.type) {
        case 'text':
        case 'html':
        case 'code':
        case 'url':
        case 'contact':
        case 'rich-text':
          await navigator.clipboard.writeText(item.content);
          toast.success(t("common.copied"));
          break;
        case 'image':
        case 'file':
          if (item.data) {
            let blob: Blob;
            if (item.data instanceof Blob) {
              blob = item.data;
            } else {
              blob = new Blob([item.data], { type: item.mimeType || 'application/octet-stream' });
            }

            const clipboardItem = new globalThis.ClipboardItem({
              [item.mimeType || 'application/octet-stream']: blob
            });
            await navigator.clipboard.write([clipboardItem]);
            toast.success(`${item.type === 'image' ? 'Image' : 'File'} copied to clipboard`);
          } else {
            toast.error("No file data available to copy");
          }
          break;
        default:
          toast.error("Unsupported content type");
      }
    } catch (err) {
      console.error('Copy failed:', err);
      toast.error("Failed to copy to clipboard - browser may not support this file type");
    }
  };

  const canCopyToClipboard = (item: ClipboardHistoryItemType): boolean => {
    if (['text', 'html', 'code', 'url', 'contact', 'rich-text'].includes(item.type)) {
      return true;
    }

    if (['image', 'file'].includes(item.type)) {
      return !!(navigator.clipboard && navigator.clipboard.write);
    }

    return false;
  };

  const handleDownloadFile = async (item: ClipboardHistoryItemType) => {
    if (!item.data) return;

    try {
      const url = URL.createObjectURL(item.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName || `download-${item.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("File downloaded");
    } catch (err) {
      toast.error("Failed to download file");
    }
  };

  return (
    <div
      key={item.id}
      className={`border rounded-lg p-4 ${
        item.isLocal ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-500">
          {new Date(item.timestamp).toLocaleString()}
          {item.isLocal ? ' (Sent)' : ' (Received)'}
        </span>
        <div className="flex space-x-2">
          {/* Send Button - Always show if connected */}
          <button
            onClick={() => onSend(item)}
            disabled={connectionState !== "connected"}
            className={`${connectionState === "connected" ? 'text-green-600 hover:text-green-700' : 'text-gray-400 cursor-not-allowed'}`}
            title={connectionState === "connected" ? "Send to peer" : "No active connection"}
          >
            <Send className="w-4 h-4" />
          </button>

          {/* Download Button - Only for files/images */}
          {(item.type === 'file' || item.type === 'image') && (
            <button
              onClick={() => handleDownloadFile(item)}
              className="text-green-600 hover:text-green-700"
              title="Download"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}

          {/* Copy Button - Only show for supported types */}
          {canCopyToClipboard(item) && (
            <button
              onClick={() => handleCopyToClipboard(item)}
              className="text-blue-600 hover:text-blue-700"
              title="Copy"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}

          {/* Delete Button - Always show */}
          <button
            onClick={() => onDelete(item.id)}
            className="text-red-600 hover:text-red-700"
            title="Delete"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Display */}
      {item.type === 'text' && (
        <div className="max-h-32 overflow-y-auto">
          <p className="text-sm whitespace-pre-wrap break-words">
            {item.content}
          </p>
        </div>
      )}

      {item.type === 'image' && item.previewUrl && (
        <div className="space-y-2">
          <img
            src={item.previewUrl}
            alt={item.fileName || 'Received image'}
            className="max-w-full max-h-48 rounded-lg border border-gray-200"
            onLoad={() => URL.revokeObjectURL(item.previewUrl!)}
          />
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>{item.fileName}</span>
            <span>{Math.round((item.fileSize || 0) / 1024)} KB</span>
          </div>
          {item.metadata?.dimensions && (
            <p className="text-xs text-gray-400">
              {item.metadata.dimensions.width} × {item.metadata.dimensions.height}
            </p>
          )}
        </div>
      )}

      {item.type === 'file' && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm">
            <span className="font-medium">{item.fileName}</span>
            <span className="text-gray-500">
              ({Math.round((item.fileSize || 0) / 1024)} KB)
            </span>
          </div>
          <p className="text-xs text-gray-500">{item.mimeType}</p>
        </div>
      )}

      {item.type === 'html' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">HTML Content</p>
          <div
            className="text-xs bg-gray-50 p-2 rounded border max-h-32 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: item.content }}
          />
        </div>
      )}

      {item.type === 'code' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Code Snippet</p>
            {item.metadata?.language && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {item.metadata.language}
              </span>
            )}
          </div>
          <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded border max-h-32 overflow-y-auto">
            {item.content}
          </pre>
        </div>
      )}

      {item.type === 'url' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">URL</p>
          <a
            href={item.metadata?.url || item.content}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm break-all"
          >
            {item.content}
          </a>
        </div>
      )}

      {item.type === 'rich-text' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Rich Text</p>
          <div
            className="text-sm bg-gray-50 p-2 rounded border max-h-32 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: item.content }}
          />
        </div>
      )}

      {item.type === 'contact' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Contact Information</p>
          <div className="max-h-32 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap break-words">
              {item.content}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}