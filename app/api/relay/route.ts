
import { NextRequest, NextResponse } from "next/server";

// In-memory file chunks storage (in production, use Redis or cloud storage)
const fileChunks = new Map<
  string, // sessionId
  {
    files: Map<string, { // fileId
      chunks: Map<number, Uint8Array>;
      metadata?: {
        id: string;
        name: string;
        size: number;
        type: string;
        totalChunks: number;
      };
      totalChunks?: number;
    }>;
    verificationCode?: string;
    verificationConfirmed?: boolean;
    createdAt: number;
  }
>();

// Clean up old file data every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of fileChunks.entries()) {
    if (now - data.createdAt > 15 * 60 * 1000) {
      // 15 minutes
      fileChunks.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, type, data } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Initialize session if it doesn't exist
    if (!fileChunks.has(sessionId)) {
      fileChunks.set(sessionId, {
        files: new Map(),
        createdAt: Date.now(),
      });
    }

    const session = fileChunks.get(sessionId)!;
    session.createdAt = Date.now(); // Update activity

    switch (type) {
      case "verification":
        // Store verification code
        session.verificationCode = body.verificationCode;
        session.verificationConfirmed = false;
        break;
      case "verification-confirmed":
        // Mark verification as confirmed by receiver
        session.verificationConfirmed = true;
        break;
      case "metadata":
        const fileId = data.id;
        if (!session.files.has(fileId)) {
          session.files.set(fileId, {
            chunks: new Map(),
            metadata: data,
            totalChunks: data.totalChunks,
          });
        }
        break;
      case "chunk":
        const chunkFileId = data.fileId;
        const fileData = session.files.get(chunkFileId);
        if (fileData) {
          // Store chunk (convert base64 back to binary)
          const binaryString = atob(data.data);
          const chunkData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            chunkData[i] = binaryString.charCodeAt(i);
          }
          fileData.chunks.set(data.index, chunkData);
        }
        break;
      case "complete":
        // File transfer complete marker
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Relay error:", error);
    return NextResponse.json({ error: "Relay failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const fileId = searchParams.get("fileId");
    const chunkIndex = searchParams.get("chunkIndex");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    const session = fileChunks.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Return all files metadata and verification status
    if (!fileId && !chunkIndex) {
      const filesMetadata = Array.from(session.files.entries()).map(([id, data]) => ({
        id, // Include file ID
        ...data.metadata,
        availableChunks: data.chunks.size,
        totalChunks: data.totalChunks,
      }));

      return NextResponse.json({
        files: filesMetadata,
        verificationCode: session.verificationCode,
        verificationConfirmed: session.verificationConfirmed,
      });
    }

    // Return specific chunk
    if (chunkIndex && fileId) {
      const fileData = session.files.get(fileId);
      if (!fileData) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      const index = parseInt(chunkIndex);
      const chunk = fileData.chunks.get(index);
      if (!chunk) {
        return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
      }

      // Convert binary to base64 for JSON transport
      const base64 = btoa(String.fromCharCode.apply(null, Array.from(chunk)));
      return NextResponse.json({ data: base64, index });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Relay polling error:", error);
    return NextResponse.json({ error: "Polling failed" }, { status: 500 });
  }
}
