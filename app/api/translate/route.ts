import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { LLMClient } from "@/lib/llm-client";
import { fetchDictionaryData, formatDictionaryForLLM, isDictionarySupported } from "@/lib/free-dictionary";

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
    
    // Fetch dictionary data for the source word (if it's a single word and language is supported)
    let dictionaryContext = "";
    const trimmedText = text.trim();
    const effectiveSourceLang = sourceLanguage || "auto";
    if (!trimmedText.includes(" ") && trimmedText.length < 50 && isDictionarySupported(effectiveSourceLang)) {
      console.log("Fetching dictionary data for:", trimmedText);
      const dictData = await fetchDictionaryData(trimmedText, effectiveSourceLang);
      if (dictData) {
        dictionaryContext = formatDictionaryForLLM(dictData);
        console.log("Dictionary context:", dictionaryContext);
      }
    }

    // Check if input is a sentence (contains spaces or is longer than 50 chars)
    const isSentence = trimmedText.includes(" ") || trimmedText.length > 50;

    let translationResult;

    if (isSentence) {
      // Use sentence translation with word extraction
      console.log("Translating sentence with word extraction");
      translationResult = await client.translateSentence(
        text,
        sourceLanguage || "auto",
        targetLanguage
      );
    } else {
      // Use single word translation
      translationResult = await client.translateText(
        text,
        sourceLanguage || "auto",
        targetLanguage,
        dictionaryContext || undefined
      );
    }

    return NextResponse.json(translationResult);
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
