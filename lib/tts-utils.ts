/**
 * Text-to-Speech Utilities
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TTSSpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

// Use browser's native types - these are already defined in DOM lib
// We just use them with casting
export class TTSManager {
  private readonly synth: any = null;
  private voices: any[] = [];
  private voicesLoaded = false;

  constructor() {
    if (globalThis.window !== undefined && "speechSynthesis" in globalThis) {
      this.synth = globalThis.speechSynthesis;
      this.loadVoices();
    }
  }

  private loadVoices() {
    if (!this.synth) return;

    // Load voices immediately
    this.voices = this.synth.getVoices();
    this.voicesLoaded = true;

    // Also listen for voiceschanged event (Chrome needs this)
    this.synth.onvoiceschanged = () => {
      this.voices = this.synth!.getVoices();
      this.voicesLoaded = true;
    };
  }

  isSupported(): boolean {
    return this.synth !== null;
  }

  waitForVoices(timeout: number = 2000): Promise<void> {
    if (this.voicesLoaded) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout waiting for voices to load"));
      }, timeout);

      const checkVoices = () => {
        if (this.voicesLoaded) {
          clearTimeout(timer);
          resolve();
        } else {
          setTimeout(checkVoices, 100);
        }
      };

      checkVoices();
    });
  }

  getVoices(lang?: string): any[] {
    if (lang) {
      return this.voices.filter(
        (voice) => voice.lang.startsWith(lang) || voice.lang.startsWith(lang.split("-")[0])
      );
    }
    return this.voices;
  }

  getVoice(name: string): any {
    return this.voices.find((v) => v.name === name);
  }

  getDefaultVoice(lang: string): any {
    const matchingVoices = this.getVoices(lang);
    if (matchingVoices.length === 0) {
      return undefined;
    }

    // Try to find a default voice
    const defaultVoice = matchingVoices.find((v) => v.default);
    if (defaultVoice) {
      return defaultVoice;
    }

    // Return first matching voice
    return matchingVoices[0];
  }

  speak(
    text: string,
    options: TTSSpeechOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error("Speech synthesis not supported"));
        return;
      }

      // Cancel any ongoing speech
      this.synth.cancel();

      const utterance = new (globalThis as any).SpeechSynthesisUtterance(text);

      // Set options
      if (options.lang) {
        utterance.lang = options.lang;
      }
      if (options.rate !== undefined) {
        utterance.rate = options.rate;
      }
      if (options.pitch !== undefined) {
        utterance.pitch = options.pitch;
      }
      if (options.volume !== undefined) {
        utterance.volume = options.volume;
      }

      // Set voice if specified
      if (options.lang) {
        const defaultVoice = this.getDefaultVoice(options.lang);
        if (defaultVoice) {
          utterance.voice = defaultVoice;
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = (event: any) => {
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      this.synth.speak(utterance);
    });
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  pause() {
    if (this.synth) {
      this.synth.pause();
    }
  }

  resume() {
    if (this.synth) {
      this.synth.resume();
    }
  }

  isSpeaking(): boolean {
    return this.synth !== null && this.synth.speaking;
  }

  isPaused(): boolean {
    return this.synth !== null && this.synth.paused;
  }
}

// Singleton instance
let ttsManagerInstance: TTSManager | null = null;

export function getTTSManager(): TTSManager {
  ttsManagerInstance ??= new TTSManager();
  return ttsManagerInstance;
}

// Convenience functions
export async function speakText(text: string, lang: string = "en-US"): Promise<void> {
  const tts = getTTSManager();
  if (!tts.isSupported()) {
    throw new Error("Text-to-speech is not supported in this browser");
  }
  await tts.waitForVoices();
  return tts.speak(text, { lang, rate: 0.9 }); // Slightly slower for learning
}

export function stopSpeaking(): void {
  const tts = getTTSManager();
  tts.stop();
}

export function isTTSSupported(): boolean {
  return globalThis.window !== undefined && "speechSynthesis" in globalThis;
}