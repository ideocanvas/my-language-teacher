
export interface FileTransfer {
  id: string
  file?: File
  name: string
  size: number
  progress: number
  status: 'pending' | 'transferring' | 'completed' | 'error' | 'receiving'
  data?: ArrayBuffer
  error?: string
  startTime?: number
  endTime?: number
}

export interface WebRTCMessage {
  type: 'verification-request' | 'verification-response' | 'verification-success' | 'verification-failed' |
        'file-start' | 'file-chunk' | 'file-complete' | 'file-error' |
        'connection-status' | 'ping' | 'pong'
  data?: unknown
  verificationCode?: string
  fileId?: string
  fileName?: string
  fileSize?: number
  chunk?: ArrayBuffer
  chunkIndex?: number
  totalChunks?: number
  error?: string
  timestamp?: number
}

export interface PeerConnection {
  id: string
  role: 'sender' | 'receiver'
  sessionId: string
  status: 'waiting' | 'connecting' | 'verifying' | 'connected' | 'transferring' | 'disconnected'
  createdAt: number
  lastActivity?: number
}

export interface QRCodeData {
  sessionId: string
  url: string
  timestamp: number
}

export interface SessionConfig {
  maxFileSize?: number
  allowedFileTypes?: string[]
  idleTimeout: number // in milliseconds
  chunkSize: number // in bytes
}

export interface TransferStats {
  totalFiles: number
  totalSize: number
  transferredSize: number
  transferSpeed: number // bytes per second
  estimatedTimeRemaining: number // in seconds
  startTime: number
  endTime?: number
}

export interface ConnectionInfo {
  localCandidate?: RTCIceCandidate
  remoteCandidate?: RTCIceCandidate
  connectionState: RTCPeerConnectionState
  iceConnectionState: RTCIceConnectionState
  signalingState: RTCSignalingState
  dataChannelState?: RTCDataChannelState
}

export type ConnectionState = 'waiting' | 'connecting' | 'verifying' | 'connected' | 'transferring' | 'disconnected'

export type UserRole = 'sender' | 'receiver'

export interface WebRTCHookReturn {
  connectionState: ConnectionState
  sentFiles: FileTransfer[]
  receivedFiles: FileTransfer[]
  transferStats?: TransferStats
  connectionInfo?: ConnectionInfo
  initializeConnection: () => void
  sendFile: (file: File) => Promise<void>
  sendMessage: (message: WebRTCMessage) => void
  resetConnection: () => void
  isConnected: boolean
  error?: string
}

export interface ClipboardHistoryItem {
  id: string;
  type: 'text' | 'image' | 'file' | 'html' | 'code' | 'url' | 'contact' | 'rich-text';
  content: string;
  data?: Blob;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  timestamp: number;
  isLocal: boolean;
  previewUrl?: string;
  metadata?: {
    language?: string; // For code snippets
    url?: string; // For URLs
    format?: string; // For rich text formatting
    dimensions?: { width: number; height: number }; // For images
  };
}
