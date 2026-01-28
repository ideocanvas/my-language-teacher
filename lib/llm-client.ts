import {
  ExampleSentencesResponse,
  WordComparisonResponse,
  GrammarExplanationResponse,
  PronunciationHelpResponse,
  ChatMessage,
  EnrichedTranslationResponse,
} from "./vocabulary-types";

/**
 * OpenAI-compatible API Client for AI features
 */

export interface LLMClientOptions {
  baseUrl: string;
  apiKey: string;
  model?: string;
}

export interface ChatCompletionRequest {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LLMClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: LLMClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.model = options.model || "gpt-3.5-turbo";

    // Remove trailing slash from baseUrl
    if (this.baseUrl.endsWith("/")) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  private async makeChatCompletion(
    request: ChatCompletionRequest
  ): Promise<string> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 500,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `LLM API failed: ${response.statusText}`
      );
    }

    const data: ChatCompletionResponse = await response.json();

    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    throw new Error("Invalid response from LLM API");
  }

  async generateExampleSentences(
    word: string,
    translation: string,
    difficulty: 1 | 2 | 3 = 2
  ): Promise<ExampleSentencesResponse> {
    let difficultyDescription = "advanced and sophisticated";

    if (difficulty === 1) {
      difficultyDescription = "simple and easy to understand";
    } else if (difficulty === 2) {
      difficultyDescription = "moderately challenging";
    }

    const prompt = `Generate 3 example sentences for the word "${word}" (${translation}). 
Return a JSON object with this format:
{
  "sentences": [
    { "sentence": "...", "translation": "...", "difficulty": 1 }
  ]
}
Difficulty levels: 1 (easy/simple), 2 (medium), 3 (advanced/complex).
Make the sentences ${difficultyDescription}.`;

    try {
      const response = await this.makeChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are a language learning assistant. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        maxTokens: 500,
      });

      const parsed = JSON.parse(response);
      return {
        word,
        sentences: parsed.sentences || [],
      };
    } catch (error) {
      console.error("Failed to generate example sentences:", error);
      return { word, sentences: [] };
    }
  }

  async compareWords(
    words: string[],
    context?: string
  ): Promise<WordComparisonResponse> {
    const wordList = words.join(", ");
    const contextStr = context ? `Context: ${context}` : "";

    const prompt = `Compare these similar words: ${wordList}.
${contextStr}

Return a JSON object with this format:
{
  "differences": ["difference 1", "difference 2"],
  "examples": ["example sentence using word 1", "example sentence using word 2"],
  "recommendations": ["when to use word 1", "when to use word 2"]
}
Focus on nuances in meaning, usage, and context.`;

    try {
      const response = await this.makeChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are a language learning assistant. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        maxTokens: 800,
      });

      const parsed = JSON.parse(response);
      return {
        words,
        differences: parsed.differences || [],
        examples: parsed.examples || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      console.error("Failed to compare words:", error);
      return { words, differences: [], examples: [], recommendations: [] };
    }
  }

  async explainGrammar(
    topic: string,
    word?: string
  ): Promise<GrammarExplanationResponse> {
    const wordStr = word ? `Specific word: ${word}` : "";

    const prompt = `Explain the grammar topic: ${topic}.
${wordStr}

Return a JSON object with this format:
{
  "explanation": "clear explanation of the grammar rule",
  "examples": ["example 1", "example 2"],
  "commonMistakes": ["common mistake 1", "common mistake 2"]
}
Make it easy to understand for language learners.`;

    try {
      const response = await this.makeChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are a language learning assistant. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        maxTokens: 800,
      });

      const parsed = JSON.parse(response);
      return {
        topic,
        explanation: parsed.explanation || "",
        examples: parsed.examples || [],
        commonMistakes: parsed.commonMistakes || [],
      };
    } catch (error) {
      console.error("Failed to explain grammar:", error);
      return { topic, explanation: "", examples: [], commonMistakes: [] };
    }
  }

  async getPronunciationHelp(word: string): Promise<PronunciationHelpResponse> {
    const prompt = `Help with pronunciation of the word: "${word}".
Note: You cannot provide actual audio, but you can provide phonetic guidance.

Return a JSON object with this format:
{
  "ipa": "IPA transcription",
  "phoneticBreakdown": ["syllable 1", "syllable 2"],
  "similarSoundingWords": ["word1", "word2"],
  "commonMistakes": ["common pronunciation mistake 1"],
  "audioTranscription": "how to pronounce it in text"
}
Include IPA notation, break down syllables, list similar sounding words, and describe common pronunciation mistakes.`;

    try {
      const response = await this.makeChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are a language learning assistant. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 600,
      });

      const parsed = JSON.parse(response);
      return {
        word,
        ipa: parsed.ipa || "",
        phoneticBreakdown: parsed.phoneticBreakdown || [],
        similarSoundingWords: parsed.similarSoundingWords || [],
        commonMistakes: parsed.commonMistakes || [],
        audioTranscription: parsed.audioTranscription || "",
      };
    } catch (error) {
      console.error("Failed to get pronunciation help:", error);
      return {
        word,
        ipa: "",
        phoneticBreakdown: [],
        similarSoundingWords: [],
        commonMistakes: [],
      };
    }
  }

  async continueConversation(
    messages: ChatMessage[],
    systemPrompt?: string
  ): Promise<string> {
    const systemMessage: ChatMessage = {
      id: "system",
      role: "system",
      content:
        systemPrompt ||
        "You are a helpful language learning assistant. Help the user practice and learn the target language. Be patient, encouraging, and provide corrections when needed.",
      timestamp: Date.now(),
    };

    const apiMessages = [
      { role: systemMessage.role, content: systemMessage.content },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    return this.makeChatCompletion({
      messages: apiMessages as Array<{ role: "system" | "user" | "assistant"; content: string }>,
      temperature: 0.7,
      maxTokens: 1000,
    });
  }

  async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    dictionaryContext?: string
  ): Promise<EnrichedTranslationResponse> {
    let prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}:

"${text}"

`;

    if (dictionaryContext) {
      prompt += `Use this dictionary data as reference:\n${dictionaryContext}\n\n`;
    }

    prompt += `Return a JSON object with this format:
{
  "translatedText": "the translation",
  "pronunciation": "IPA pronunciation (if applicable, otherwise empty string)",
  "partOfSpeech": "noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection (if applicable, otherwise empty string)",
  "difficulty": 1-5 (1=easiest, 5=hardest, based on word complexity and usage frequency),
  "tags": ["tag1", "tag2", ...] (relevant tags like "common", "formal", "slang", "academic", "business", etc.),
  "notes": "brief usage notes or context (optional)"
}

Provide accurate translation and helpful metadata for language learners.`;

    try {
      const response = await this.makeChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are a professional translator and language learning assistant. Provide accurate translations with helpful metadata. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 800,
      });

      const parsed = JSON.parse(response);
      return {
        translatedText: parsed.translatedText || text,
        pronunciation: parsed.pronunciation || undefined,
        partOfSpeech: parsed.partOfSpeech || undefined,
        difficulty: (parsed.difficulty as 1 | 2 | 3 | 4 | 5) || 3,
        tags: parsed.tags || [],
        notes: parsed.notes || undefined,
      };
    } catch (error) {
      console.error("Failed to translate text:", error);
      // Fallback to simple translation
      return {
        translatedText: text,
        difficulty: 3,
        tags: [],
      };
    }
  }
}

export function createLLMClient(options: LLMClientOptions): LLMClient {
  return new LLMClient(options);
}