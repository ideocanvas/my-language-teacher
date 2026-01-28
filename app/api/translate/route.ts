import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { LLMClient } from "@/lib/llm-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, sourceLanguage, targetLanguage } = body;

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: "Text and target language are required" },
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
    console.log("Translating text:", { text, sourceLanguage, targetLanguage });
    console.log("Using LLM settings:", { llmApiUrl, llmModel, llmApiKey: llmApiKey  });
    // Perform translation
    const translatedText = await client.translateText(
      text,
      sourceLanguage || "auto",
      targetLanguage
    );

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
