declare global {
  interface CloudflareEnv {
    LLM_API_URL?: string;
    LLM_API_KEY?: string;
    LLM_MODEL?: string;
    VISION_MODEL?: string;
    SHORT_CODES?: KVNamespace;
  }
}

export {};
