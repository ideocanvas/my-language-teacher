import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, language } = body;

    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    // Get the Cloudflare context
    const { env } = getCloudflareContext();

    // Get LLM settings from Cloudflare secrets
    const llmApiUrl = env.LLM_API_URL;
    const llmApiKey = env.LLM_API_KEY;
    const visionModel = env.VISION_MODEL || env.LLM_MODEL || "gpt-4o";
    const debugMode = env.DEBUG === "true";

    if (!llmApiUrl || !llmApiKey) {
      return NextResponse.json(
        { error: "LLM API not configured" },
        { status: 500 }
      );
    }

    // Save image to local file if DEBUG is true
    if (debugMode) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `vision-debug-${timestamp}.jpg`;
        const debugDir = join(process.cwd(), "debug");
        const filepath = join(debugDir, filename);
        
        // Create debug directory if it doesn't exist
        await mkdir(debugDir, { recursive: true });
        
        // Extract base64 data (remove data:image/jpeg;base64, prefix)
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        await writeFile(filepath, bytes);
        console.log("[DEBUG] Image saved to:", filepath);
      } catch (err) {
        console.error("[DEBUG] Failed to save image:", err);
      }
    }

    // Prepare the prompt for text extraction - more explicit OCR instructions
    const languageHint = language 
      ? `The text in the image is likely in ${language} language.` 
      : "Extract text in any language found in the image.";
    
    const prompt = `You are an OCR (Optical Character Recognition) expert. Your task is to extract ALL readable text from the provided image.

${languageHint}

Instructions:
1. Look carefully at the entire image and identify all text
2. Extract the text exactly as it appears, preserving spelling and characters
3. If there are multiple lines, preserve the line breaks
4. If the text is in a specific language, preserve the original characters (don't translate)
5. Return ONLY the extracted text, with no additional commentary, explanations, or formatting
6. If you truly cannot find any text, return exactly: NO_TEXT_FOUND

Extracted text:`;

    // Make request to vision API
    const url = `${llmApiUrl.replace(/\/$/, "")}/v1/chat/completions`;

    console.log("Vision API request:", {
      model: visionModel,
      url: url,
      imageLength: image.length,
      debugMode,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmApiKey}`,
      },
      body: JSON.stringify({
        model: visionModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: image,
                  detail: "high",
                },
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Vision API error:", errorData);
      return NextResponse.json(
        { error: errorData.error?.message || "Vision API failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    let extractedText = data.choices?.[0]?.message?.content?.trim() || "";
    
    console.log("Vision API response:", { extractedText: extractedText.substring(0, 100) });

    // Handle the NO_TEXT_FOUND marker
    if (extractedText === "NO_TEXT_FOUND" || extractedText === "NO_TEXT_FOUND.") {
      extractedText = "";
    }

    // Clean up common LLM responses that indicate no text
    const noTextIndicators = [
      "no text found",
      "no readable text",
      "i cannot see any text",
      "i don't see any text",
      "there is no text",
      "unable to extract",
      "no text visible",
    ];
    
    const lowerText = extractedText.toLowerCase();
    if (noTextIndicators.some(indicator => lowerText.includes(indicator))) {
      extractedText = "";
    }

    return NextResponse.json({
      text: extractedText,
      success: true,
    });
  } catch (error) {
    console.error("Vision extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract text from image" },
      { status: 500 }
    );
  }
}
