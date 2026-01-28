import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { LLMClient } from "@/lib/llm-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { words, context } = body;

    if (!words || !Array.isArray(words) || words.length < 2) {
      return NextResponse.json(
        { error: "At least 2 words are required" },
        { status: 400 }
      );
    }

    // Get the Cloudflare context
    const { env } = getCloudflareContext();

    // Get LLM settings from Cloudflare secrets
    const llmApiUrl = env.LLM_API_URL;
    const llmApiKey = env.LLM_API_KEY;
    const llmModel = env.LLM_MODEL;

    if (!llmApiUrl || !llmApiKey) {
      return NextResponse.json(
        { error: "LLM API not configured" },
        { status: 500 }
      );
    }

    // Create LLM client
    const client = new LLMClient({
      baseUrl: llmApiUrl,
      apiKey: llmApiKey,
      model: llmModel,
    });

    const response = await client.compareWords(words, context);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Compare words error:", error);
    return NextResponse.json(
      { error: "Failed to compare words" },
      { status: 500 }
    );
  }
}
