import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { LLMClient } from "@/lib/llm-client";
import { fetchDictionaryData, formatDictionaryForLLM } from "@/lib/free-dictionary";

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
    console.log("Translating text:", { text, sourceLanguage, targetLanguage });
    console.log("Using LLM settings:", { llmApiUrl, llmModel, llmApiKey: llmApiKey  });

    // Fetch dictionary data for the source word (if it's a single word)
    let dictionaryContext = "";
    const trimmedText = text.trim();
    if (!trimmedText.includes(" ") && trimmedText.length < 50) {
      console.log("Fetching dictionary data for:", trimmedText);
      const dictData = await fetchDictionaryData(trimmedText, sourceLanguage);
      if (dictData) {
        dictionaryContext = formatDictionaryForLLM(dictData);
        console.log("Dictionary context:", dictionaryContext);
      }
    }

    // Perform translation with dictionary context
    const translationResult = await client.translateText(
      text,
      sourceLanguage || "auto",
      targetLanguage,
      dictionaryContext || undefined
    );

    return NextResponse.json(translationResult);
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
