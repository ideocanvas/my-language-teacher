import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { LLMClient } from "@/lib/llm-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { word, translation, difficulty } = body;

    if (!word || !translation) {
      return NextResponse.json(
        { error: "Word and translation are required" },
        { status: 400 }
      );
    }

    // Get the Cloudflare context
    const { env } = getCloudflareContext();

    // Get LLM settings from Cloudflare secrets
    const llmApiUrl = env.LLM_API_URL as string | undefined;
    const llmApiKey = env.LLM_API_KEY as string | undefined;
    const llmModel = env.LLM_MODEL as string | undefined;

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

    const response = await client.generateExampleSentences(
      word,
      translation,
      difficulty || 2
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Generate sentences error:", error);
    return NextResponse.json(
      { error: "Failed to generate sentences" },
      { status: 500 }
    );
  }
}
