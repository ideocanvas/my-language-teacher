import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

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

    if (!llmApiUrl || !llmApiKey) {
      return NextResponse.json(
        { error: "LLM API not configured" },
        { status: 500 }
      );
    }

    // Prepare the prompt for text extraction
    const languageHint = language ? `The text is likely in ${language}.` : "";
    const prompt = `Extract all readable text from this image. ${languageHint} 

Return ONLY the extracted text, without any additional commentary or formatting. If no text is found, return an empty string.

If the image contains multiple lines or paragraphs, preserve the line breaks and structure as much as possible.`;

    // Make request to vision API
    const url = `${llmApiUrl.replace(/\/$/, "")}/v1/chat/completions`;

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
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
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
    const extractedText = data.choices?.[0]?.message?.content?.trim() || "";

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
