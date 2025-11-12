import { NextRequest, NextResponse } from "next/server";

// Cloudflare KV binding for short code mappings
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// @ts-expect-error - Cloudflare KV binding
const SHORT_CODES: KVNamespace = process.env.SHORT_CODES;

// In-memory fallback for development
const devShortCodes = new Map<
  string,
  {
    peerId: string;
    createdAt: number;
  }
>();

const TTL = 15 * 60; // 15 minutes in seconds

// Clean up old dev codes every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [shortCode, data] of devShortCodes.entries()) {
      if (now - data.createdAt > TTL * 1000) {
        devShortCodes.delete(shortCode);
      }
    }
  }, 5 * 60 * 1000);
}

// Generate a random 6-character alphanumeric code
function generateShortCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Use KV if available, otherwise fallback to in-memory storage
async function getShortCode(shortCode: string): Promise<string | null> {
  if (SHORT_CODES) {
    return await SHORT_CODES.get(shortCode);
  } else {
    const data = devShortCodes.get(shortCode);
    return data ? data.peerId : null;
  }
}

async function putShortCode(shortCode: string, peerId: string): Promise<void> {
  if (SHORT_CODES) {
    await SHORT_CODES.put(shortCode, peerId, { expirationTtl: TTL });
  } else {
    devShortCodes.set(shortCode, {
      peerId,
      createdAt: Date.now()
    });
  }
}

async function deleteShortCode(shortCode: string): Promise<void> {
  if (SHORT_CODES) {
    await SHORT_CODES.delete(shortCode);
  } else {
    devShortCodes.delete(shortCode);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { peerId } = body;

    if (!peerId) {
      return NextResponse.json({ error: "Peer ID required" }, { status: 400 });
    }

    // Generate a unique short code
    let shortCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      shortCode = generateShortCode();
      const existing = await getShortCode(shortCode);
      
      if (!existing) {
        // Code is available, store it
        await putShortCode(shortCode, peerId);
        break;
      }
      
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return NextResponse.json({ error: "Failed to generate unique short code" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      shortCode,
      expiresIn: TTL,
      storage: SHORT_CODES ? "kv" : "memory"
    });
  } catch (error) {
    console.error("Short code registration error:", error);
    return NextResponse.json({ error: "Failed to register short code" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shortCode = searchParams.get("shortCode");

    if (!shortCode) {
      return NextResponse.json({ error: "Short code required" }, { status: 400 });
    }

    // Lookup peer ID from short code
    const peerId = await getShortCode(shortCode);

    if (!peerId) {
      return NextResponse.json({ error: "Short code not found or expired" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      peerId,
      shortCode,
      storage: SHORT_CODES ? "kv" : "memory"
    });
  } catch (error) {
    console.error("Short code lookup error:", error);
    return NextResponse.json({ error: "Failed to lookup short code" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shortCode = searchParams.get("shortCode");

    if (!shortCode) {
      return NextResponse.json({ error: "Short code required" }, { status: 400 });
    }

    await deleteShortCode(shortCode);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Short code deletion error:", error);
    return NextResponse.json({ error: "Failed to delete short code" }, { status: 500 });
  }
}