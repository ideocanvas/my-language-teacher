
"use client";

import Peer, { DataConnection } from "peerjs";
import { ICE_SERVERS } from "@/lib/connection-strategies";
import { LogEntry } from "@/components/connection-logger";

export type ConnectionState =
  | "waiting"
  | "connecting"
  | "verifying"
  | "connected"
  | "transferring"
  | "disconnected";

export interface FileTransfer {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: "pending" | "transferring" | "completed" | "error";
  error?: string;
}

interface FileBuffer {
  chunks: (Uint8Array | undefined)[];
  metadata: {
    name: string;
    size: number;
    type: string;
    totalChunks: number;
  };
}

import type { SyncMessage } from "@/lib/vocabulary-types";

interface PeerManagerCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onFileReceived?: (file: Blob, metadata: { name: string; type: string }) => void;
  onTextReceived?: (text: string, contentType?: string) => void;
  onSyncMessage?: (message: SyncMessage) => void;
  onLog?: (log: LogEntry) => void;
}

const CHUNK_SIZE = 8192; // 8KB chunks
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

class PeerManager {
  private static instance: PeerManager;
  private readonly peer: Peer;
  private connection: DataConnection | null = null;
  private sessionId: string = '';
  private role: 'sender' | 'receiver' = 'sender';
  private callbacks: PeerManagerCallbacks[] = [];
  private peerId: string | null = null;

  // State management
  private connectionState: ConnectionState = "waiting";
  private files: FileTransfer[] = [];
  private error: string | null = null;
  private verificationCode: string | null = null;
  private isVerified: boolean = false;

  // Refs for cleanup
  private timeoutRef: NodeJS.Timeout | null = null;
  private readonly verificationTimeoutRef: NodeJS.Timeout | null = null;
  private readonly fileBuffers = new Map<string, FileBuffer>();

  static getInstance(): PeerManager {
    if (!PeerManager.instance) {
      PeerManager.instance = new PeerManager();
    }
    return PeerManager.instance;
  }

  private constructor() {
    // Create global Peer instance once
    this.peer = new Peer({
      debug: 1,
      config: { iceServers: ICE_SERVERS },
      host: "0.peerjs.com",
      port: 443,
      secure: true,
      path: "/",
    });

    this.peer.on('open', (id) => {
      console.log('Global Peer instance ready with ID:', id);
      this.peerId = id;
    });

    this.peer.on('error', (err) => {
      console.error('Global Peer error:', err);
    });
  }

  subscribe(callbacks: PeerManagerCallbacks): () => void {
    this.callbacks.push(callbacks);

    // Immediately notify of current state
    callbacks.onConnectionStateChange(this.connectionState);

    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callbacks);
    };
  }

  private setConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.callbacks.forEach(cb => cb.onConnectionStateChange(state));
  }

  private log(level: LogEntry["level"], message: string, details?: string) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      details,
    };

    this.callbacks.forEach(cb => cb.onLog?.(entry));
    console.log(`[${level.toUpperCase()}] ${message}`, details || "");
  }

  private resetTimeout() {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }

    this.timeoutRef = setTimeout(() => {
      if (this.connectionState !== "transferring") {
        this.log("warning", "Session timed out after 15 minutes");
        this.error = "Session timed out";
        this.setConnectionState("disconnected");
        this.cleanup();
      }
    }, SESSION_TIMEOUT);
  }

  private cleanup() {
    if (this.timeoutRef) clearTimeout(this.timeoutRef);

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    // Reset state for new connection
    this.verificationCode = null;
    this.isVerified = false;
    this.error = null;
    this.files = [];

    // Don't destroy the global peer instance, just close the connection
    this.fileBuffers.clear();
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private setupPeerJSConnection(conn: DataConnection) {
    this.connection = conn;

    if (conn.open) {
      this.handlePeerJSConnectionOpen(conn);
    } else {
      conn.on("open", () => {
        this.handlePeerJSConnectionOpen(conn);
      });
    }

    conn.on("data", (data: unknown) => {
      this.resetTimeout();

      // Handle binary data from PeerJS
      if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        try {
          const uint8Array = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
          const text = new TextDecoder().decode(uint8Array);
          const jsonData = JSON.parse(text);
          this.handleIncomingData(jsonData);
        } catch (err) {
          this.log("error", "Failed to parse binary data", String(err));
        }
      } else {
        this.handleIncomingData(data);
      }
    });

    conn.on("close", () => {
      this.log("info", "Connection closed");
      this.setConnectionState("disconnected");
    });

    conn.on("error", (err) => {
      this.log("error", "Connection error", String(err));
    });
  }

  private handlePeerJSConnectionOpen(conn: DataConnection) {
    this.log("success", "Data channel open");

    if (this.role === "sender") {
      // Generate and send verification code
      const code = this.generateVerificationCode();
      this.verificationCode = code;
      this.setConnectionState("verifying");
      this.log("info", "Verification code generated", `Code: ${code}`);

      // Send verification request as binary data
      const message = {
        type: "verification-request",
        verificationCode: code,
      };
      const jsonString = JSON.stringify(message);
      const binaryData = new TextEncoder().encode(jsonString);
      conn.send(binaryData);
    } else {
      // Receiver waits for verification request
      this.setConnectionState("verifying");
      this.log("info", "Waiting for verification code");
    }

    this.error = null;
    this.resetTimeout();
  }

  private handleIncomingData(data: unknown) {
    // Log the actual data structure for debugging
    if (typeof data === "object" && data !== null) {
      const dataObj = data as Record<string, unknown>;
      if (dataObj.type) {
        this.log("info", `Processing data type: ${typeof dataObj.type === 'string' ? dataObj.type : JSON.stringify(dataObj.type)}`);
        // Debug: log vocabulary entries count if present
        if (dataObj.vocabularyEntries && Array.isArray(dataObj.vocabularyEntries)) {
          this.log("info", `Received ${dataObj.vocabularyEntries.length} vocabulary entries`);
        }
      }
    }

    if (typeof data !== "object" || data === null) return;

    const dataObj = data as Record<string, unknown>;
    const dataType = dataObj.type as string;

    switch (dataType) {
      case "verification-request":
        this.handleVerificationRequest(dataObj);
        break;
      case "verification-response":
        this.handleVerificationResponse(dataObj);
        break;
      case "verification-success":
        this.handleVerificationSuccess();
        break;
      case "verification-failed":
        this.handleVerificationFailed();
        break;
      case "file-metadata":
        this.handleFileMetadata(dataObj);
        break;
      case "file-chunk":
        this.handleFileChunk(dataObj);
        break;
      case "text-content":
        this.handleTextContent(dataObj);
        break;
      case "sync-request":
      case "sync-response":
      case "sync-complete":
      case "sync-error":
        this.handleSyncMessage(dataObj, dataType);
        break;
    }
  }

  private handleVerificationRequest(dataObj: Record<string, unknown>): void {
    if (this.role === "receiver") {
      this.verificationCode = dataObj.verificationCode as string;
      this.log("info", "Verification code received", "Waiting for user to confirm");
    } else {
      this.verificationCode = null;
    }
  }

  private handleVerificationResponse(dataObj: Record<string, unknown>): void {
    if (this.role !== "sender") return;

    const enteredCode = dataObj.verificationCode as string;
    this.log("info", "Received verification response", `Entered code: ${enteredCode}, Expected: ${this.verificationCode}`);

    if (enteredCode === this.verificationCode) {
      this.isVerified = true;
      this.setConnectionState("connected");
      this.log("success", "Receiver verified the connection");

      const message = { type: "verification-success" };
      if (this.connection?.open) {
        try {
          this.connection.send(message);
          this.log("success", "Sent verification success to receiver");
        } catch (err) {
          this.log("error", "Failed to send verification success", String(err));
        }
      }
    } else {
      this.log("error", "Receiver entered incorrect code", `Expected: ${this.verificationCode}, Got: ${enteredCode}`);
      this.error = "Receiver verification failed - incorrect code";

      const message = { type: "verification-failed" };
      if (this.connection?.open) {
        this.connection.send(message);
        this.log("info", "Sent verification failure to receiver");
      }
    }
  }

  private handleVerificationSuccess(): void {
    if (this.role !== "receiver") return;

    this.isVerified = true;
    this.setConnectionState("connected");
    this.log("success", "Verification successful");
    if (this.verificationTimeoutRef) clearTimeout(this.verificationTimeoutRef);
  }

  private handleVerificationFailed(): void {
    if (this.role !== "receiver") return;

    this.log("error", "Verification failed - incorrect code entered");
    this.error = "Verification failed - please check the code and try again";
    this.setConnectionState("verifying");
  }

  private handleFileMetadata(dataObj: Record<string, unknown>): void {
    if (!this.isVerified) {
      this.log("error", "File transfer attempted before verification");
      return;
    }

    const { id, name, size, fileType, totalChunks } = dataObj as {
      id: string;
      name: string;
      size: number;
      fileType: string;
      totalChunks: number;
    };

    this.fileBuffers.set(id, {
      chunks: new Array(totalChunks),
      metadata: { name, size, type: fileType, totalChunks },
    });

    this.files = [
      ...this.files,
      { id, name, size, type: fileType, progress: 0, status: "transferring" },
    ];

    this.setConnectionState("transferring");
    this.log("info", `Receiving: ${name}`, `${(size / 1024 / 1024).toFixed(2)} MB, ${totalChunks} chunks`);
  }

  private handleFileChunk(dataObj: Record<string, unknown>): void {
    const { fileId, chunkIndex, chunk } = dataObj as {
      fileId: string;
      chunkIndex: number;
      chunk: number[];
    };
    const fileBuffer = this.fileBuffers.get(fileId);

    if (!fileBuffer) return;

    fileBuffer.chunks[chunkIndex] = new Uint8Array(chunk);

    const receivedChunks = fileBuffer.chunks.filter((c) => c !== undefined).length;
    const progress = (receivedChunks / fileBuffer.metadata.totalChunks) * 100;

    if (receivedChunks % 10 === 0 || receivedChunks === fileBuffer.metadata.totalChunks) {
      this.log("info", `File chunk progress: ${fileBuffer.metadata.name}`,
        `${receivedChunks}/${fileBuffer.metadata.totalChunks} chunks (${progress.toFixed(1)}%)`);
    }

    this.files = this.files.map((f) =>
      f.id === fileId
        ? { ...f, progress, status: progress === 100 ? "completed" : "transferring" }
        : f
    );

    if (receivedChunks === fileBuffer.metadata.totalChunks) {
      this.completeFileTransfer(fileBuffer, fileId);
    }
  }

  private completeFileTransfer(fileBuffer: FileBuffer, fileId: string): void {
    const orderedChunks: BlobPart[] = [];
    for (let i = 0; i < fileBuffer.metadata.totalChunks; i++) {
      const chunk = fileBuffer.chunks[i];
      if (chunk === undefined) {
        this.log("error", `Missing chunk ${i} for file ${fileBuffer.metadata.name}`);
        return;
      }
      orderedChunks.push(chunk.buffer as ArrayBuffer);
    }

    const completeFile = new Blob(orderedChunks, { type: fileBuffer.metadata.type });

    if (completeFile.size !== fileBuffer.metadata.size) {
      this.log("error", `File size mismatch: expected ${fileBuffer.metadata.size}, got ${completeFile.size}`);
      return;
    }

    this.callbacks.forEach(cb => cb.onFileReceived?.(completeFile, {
      name: fileBuffer.metadata.name,
      type: fileBuffer.metadata.type,
    }));
    this.log("success", `Received: ${fileBuffer.metadata.name} (${completeFile.size} bytes)`);

    this.fileBuffers.delete(fileId);

    const allComplete = this.files.every((f) => f.status === "completed");
    if (allComplete) {
      this.setConnectionState("connected");
    }
  }

  private handleTextContent(dataObj: Record<string, unknown>): void {
    const { content, contentType } = dataObj as { content: string; contentType?: string };

    if (content && this.isVerified) {
      this.callbacks.forEach(cb => cb.onTextReceived?.(content, contentType));
      this.log("success", "Text content received", `${content.length} characters, type: ${contentType || 'text'}`);
    } else if (!this.isVerified) {
      this.log("error", "Text content received before verification");
    }
  }

  private handleSyncMessage(dataObj: Record<string, unknown>, dataType: string): void {
    if (this.isVerified) {
      this.callbacks.forEach(cb => cb.onSyncMessage?.(dataObj as unknown as SyncMessage));
      this.log("info", `Sync message received: ${dataType}`);
    } else {
      this.log("error", "Sync message received before verification");
    }
  }

  async connect(role: 'sender' | 'receiver', sessionId?: string): Promise<string> {
    this.role = role;
    this.cleanup();

    return new Promise((resolve, reject) => {
      try {
        this.setConnectionState("connecting");
        this.log("info", "Starting PeerJS connection");

        const peer = this.peer;
        const connectionTimeoutRef = this.setupConnectionTimeout(reject);

        if (this.peerId) {
          this.handleExistingPeer(role, sessionId, peer, connectionTimeoutRef, resolve, reject);
        } else {
          this.waitForPeerOpen(role, sessionId, peer, connectionTimeoutRef, resolve, reject);
        }

        if (role === "receiver") {
          this.setupReceiverHandler(peer, connectionTimeoutRef, resolve);
        }
      } catch (err) {
        this.log("error", "PeerJS failed", String(err));
        this.error = "Failed to initialize connection";
        this.setConnectionState("disconnected");
        reject(err);
      }
    });
  }

  private setupConnectionTimeout(reject: (reason?: unknown) => void): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      this.log("warning", "PeerJS connection timed out after 15s");
      this.error = "Connection timeout";
      this.setConnectionState("disconnected");
      reject(new Error("Connection timeout"));
    }, 15000);
  }

  private handleExistingPeer(
    role: 'sender' | 'receiver',
    sessionId: string | undefined,
    peer: Peer,
    connectionTimeoutRef: ReturnType<typeof setTimeout>,
    resolve: (value: string) => void,
    reject: (reason?: unknown) => void
  ): void {
    this.log("success", `PeerJS peer already open: ${this.peerId}`);
    this.resetTimeout();
    this.sessionId = this.peerId!;

    if (role === "sender" && sessionId) {
      this.connectToReceiver(peer, sessionId, connectionTimeoutRef, resolve, reject);
    } else {
      this.log("info", "Receiver ready, waiting for sender connection");
      resolve(this.peerId!);
    }
  }

  private waitForPeerOpen(
    role: 'sender' | 'receiver',
    sessionId: string | undefined,
    peer: Peer,
    connectionTimeoutRef: ReturnType<typeof setTimeout>,
    resolve: (value: string) => void,
    reject: (reason?: unknown) => void
  ): void {
    const openHandler = (id: string) => {
      this.log("success", `PeerJS peer open: ${id}`);
      this.peerId = id;
      this.sessionId = id;
      clearTimeout(connectionTimeoutRef);
      this.resetTimeout();

      if (role === "sender" && sessionId) {
        this.connectToReceiver(peer, sessionId, connectionTimeoutRef, resolve, reject);
      } else {
        this.log("info", "Receiver ready, waiting for sender connection");
        resolve(id);
      }
    };

    peer.once("open", openHandler);
  }

  private connectToReceiver(
    peer: Peer,
    sessionId: string,
    connectionTimeoutRef: ReturnType<typeof setTimeout>,
    resolve: (value: string) => void,
    reject: (reason?: unknown) => void
  ): void {
    setTimeout(() => {
      this.log("info", "Attempting to connect to receiver...");
      const conn = peer.connect(sessionId, {
        reliable: true,
        serialization: "binary",
      });

      const connectTimeout = setTimeout(() => {
        this.log("warning", "Connection attempt timed out");
        conn.close();
        this.error = "Connection timeout";
        this.setConnectionState("disconnected");
        reject(new Error("Connection timeout"));
      }, 8000);

      conn.on("open", () => {
        this.log("success", "Data connection established");
        clearTimeout(connectTimeout);
        this.setupPeerJSConnection(conn);
        resolve(this.peerId!);
      });

      conn.on("error", (err) => {
        this.log("error", "Connection error", String(err));
        clearTimeout(connectTimeout);
        this.error = "Connection failed";
        this.setConnectionState("disconnected");
        reject(err);
      });
    }, 1000);
  }

  private setupReceiverHandler(
    peer: Peer,
    connectionTimeoutRef: ReturnType<typeof setTimeout>,
    resolve: (value: string) => void
  ): void {
    const connectionHandler = (conn: DataConnection) => {
      this.log("success", "Sender connected via PeerJS");
      clearTimeout(connectionTimeoutRef);
      this.setupPeerJSConnection(conn);
      resolve(this.peerId!);
    };

    peer.on("connection", connectionHandler);
  }

  async sendFiles(filesToSend: File[]): Promise<void> {
    if (!this.canSend()) return;

    try {
      this.setConnectionState("transferring");
      this.log("info", `Sending ${filesToSend.length} file(s)`);

      for (let fileIndex = 0; fileIndex < filesToSend.length; fileIndex++) {
        await this.sendSingleFile(filesToSend[fileIndex], fileIndex, filesToSend.length);
      }

      this.setConnectionState("connected");
    } catch (err) {
      this.handleSendError(err);
    }
  }

  private canSend(): boolean {
    if (this.connectionState !== "connected") {
      this.error = "No active connection. Please verify the connection first.";
      return false;
    }

    if (!this.isVerified) {
      this.error = "Connection not verified yet";
      return false;
    }

    return true;
  }

  private async sendSingleFile(file: File, fileIndex: number, totalFiles: number): Promise<void> {
    const fileId = `${Date.now()}-${Math.random()}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      this.addFileToTracking(fileId, file);
      this.logFileStart(file, fileIndex, totalFiles);

      await this.sendFileMetadata(fileId, file, totalChunks);
      await this.sendFileChunks(fileId, file, totalChunks);

      this.log("success", `✓ Sent: ${file.name}`);

      if (fileIndex < totalFiles - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error_) {
      this.handleFileSendError(fileId, file.name, error_);
    }
  }

  private addFileToTracking(fileId: string, file: File): void {
    this.files = [
      ...this.files,
      {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: "transferring",
      },
    ];
  }

  private logFileStart(file: File, fileIndex: number, totalFiles: number): void {
    this.log(
      "info",
      `Sending: ${file.name} (${fileIndex + 1}/${totalFiles})`,
      `${(file.size / 1024 / 1024).toFixed(2)} MB`
    );
  }

  private async sendFileMetadata(fileId: string, file: File, totalChunks: number): Promise<void> {
    const metadata = {
      type: "file-metadata",
      id: fileId,
      name: file.name,
      size: file.size,
      fileType: file.type,
      totalChunks,
    };

    const jsonString = JSON.stringify(metadata);
    const binaryData = new TextEncoder().encode(jsonString);
    if (this.connection) {
      this.connection.send(binaryData);
    }
  }

  private async sendFileChunks(fileId: string, file: File, totalChunks: number): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();

    for (let i = 0; i < totalChunks; i++) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const chunk = arrayBuffer.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await this.sendChunk(fileId, i, chunk, totalChunks);
    }
  }

  private async sendChunk(fileId: string, chunkIndex: number, chunk: ArrayBuffer, totalChunks: number): Promise<void> {
    const chunkData = {
      type: "file-chunk",
      fileId,
      chunkIndex,
      chunk: Array.from(new Uint8Array(chunk)),
    };

    const chunkJsonString = JSON.stringify(chunkData);
    const chunkBinaryData = new TextEncoder().encode(chunkJsonString);
    if (this.connection) {
      this.connection.send(chunkBinaryData);
    }

    const progress = ((chunkIndex + 1) / totalChunks) * 100;
    this.updateFileProgress(fileId, progress);
    this.resetTimeout();
  }

  private updateFileProgress(fileId: string, progress: number): void {
    this.files = this.files.map((f) =>
      f.id === fileId
        ? { ...f, progress, status: progress === 100 ? "completed" : "transferring" }
        : f
    );
  }

  private handleFileSendError(fileId: string, fileName: string, error: unknown): void {
    this.log("error", `Failed to send: ${fileName}`, String(error));
    this.files = this.files.map((f) =>
      f.id === fileId ? { ...f, status: "error", error: String(error) } : f
    );
  }

  private handleSendError(err: unknown): void {
    this.log("error", "Transfer failed", String(err));
    this.error = "Failed to send files";
    this.files = this.files.map((f) =>
      f.status === "transferring" ? { ...f, status: "error" } : f
    );
  }

  async sendText(text: string, contentType: string = 'text'): Promise<void> {
    if (this.connectionState !== "connected") {
      this.error = "No active connection. Please verify the connection first.";
      return;
    }

    if (!this.isVerified) {
      this.error = "Connection not verified yet";
      return;
    }

    try {
      this.setConnectionState("transferring");
      this.log("info", "Sending text content");

      const textData = {
        type: "text-content",
        content: text,
        contentType: contentType,
        timestamp: Date.now(),
      };

      // Send as binary data to avoid JSON size limits for large text
      const jsonString = JSON.stringify(textData);
      const binaryData = new TextEncoder().encode(jsonString);

      if (this.connection) {
        this.connection.send(binaryData);
        this.log("success", "Text content sent successfully");
      }

      this.setConnectionState("connected");
    } catch (err) {
      this.log("error", "Failed to send text", String(err));
      this.error = "Failed to send content";
      throw err;
    }
  }

  submitVerificationCode(enteredCode: string): boolean {
    // Both devices can submit verification code for bidirectional clipboard

    if (!enteredCode?.length || enteredCode.length !== 6) {
      this.log(
        "error",
        "Invalid verification code format",
        "Code must be 6 digits"
      );
      this.error = "Please enter a valid 6-digit code";
      return false;
    }

    // Send verification response to sender
    const message = {
      type: "verification-response",
      verificationCode: enteredCode,
    };

    if (this.connection) {
      this.connection.send(message);
      this.log(
        "info",
        "Verification code submitted via PeerJS",
        "Waiting for confirmation"
      );
      this.error = null; // Clear any previous errors

    }

    return true;
  }

  async sendSyncMessage(message: SyncMessage): Promise<void> {
    if (this.connectionState !== "connected") {
      this.error = "No active connection. Please verify the connection first.";
      throw new Error("No active connection");
    }

    if (!this.isVerified) {
      this.error = "Connection not verified yet";
      throw new Error("Connection not verified");
    }

    try {
      this.log("info", `Sending sync message: ${message.type}`);

      // Send as binary data to avoid JSON size limits for large messages
      const jsonString = JSON.stringify(message);
      const binaryData = new TextEncoder().encode(jsonString);

      if (this.connection) {
        this.connection.send(binaryData);
        this.log("success", `Sync message sent: ${message.type}`);
      }
    } catch (err) {
      this.log("error", "Failed to send sync message", String(err));
      this.error = "Failed to send sync message";
      throw err;
    }
  }

  disconnect(): void {
    this.cleanup();
    this.setConnectionState("disconnected");
  }

  getState() {
    return {
      connectionState: this.connectionState,
      files: [...this.files],
      error: this.error,
      verificationCode: this.verificationCode,
      isVerified: this.isVerified,
      peerId: this.peerId,
    };
  }
}

export default PeerManager;