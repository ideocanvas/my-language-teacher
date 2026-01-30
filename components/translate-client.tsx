"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import BuyMeACoffee from "@/components/BuyMeACoffee";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { useSettings } from "@/hooks/use-settings";
import { WordSuggestion } from "@/lib/vocabulary-types";
import {
  Volume2,
  Sparkles,
  BookOpen,
  ArrowRight,
  Plus,
  Check,
  Camera,
  X,
  Loader2,
  Crop,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { getTranslations, type Locale } from "@/lib/client-i18n";

interface TranslateClientProps {
  lang: Locale;
}

export function TranslateClient({ lang }: Readonly<TranslateClientProps>) {
  const router = useRouter();
  const { addWord, vocabulary } = useVocabulary();
  const { settings } = useSettings();
  const t = useMemo(() => getTranslations(lang), [lang]);

  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [translating, setTranslating] = useState(false);
  const [wordSuggestions, setWordSuggestions] = useState<WordSuggestion[]>([]);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Crop selection state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cropContainerRef = useRef<HTMLDivElement | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);

  const speakText = async (text: string, langCode: string) => {
    try {
      const { speakText: ttsSpeakText } = await import("@/lib/tts-utils");
      await ttsSpeakText(text, langCode === "zh" ? "zh-CN" : "en-US");
    } catch (err) {
      console.error("Failed to speak text:", err);
    }
  };

  // Normalize text for consistent storage and duplicate detection
  const normalizeText = (text: string): string => {
    return text
      .trim()
      .toLowerCase()
      // Replace multiple whitespace with single space
      .replace(/\s+/g, " ")
      // Remove trailing punctuation (.,!?;:)
      .replace(/[.,!?;:]+$/, "");
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      toast.error(t("translate.enterText"));
      return;
    }

    // Normalize the input text
    const normalizedInput = normalizeText(sourceText);

    // Check if already exists (using normalized comparison)
    const existingWord = vocabulary.find(
      (v) => normalizeText(v.word) === normalizedInput
    );

    if (existingWord) {
      // Show the existing translation
      setTargetText(existingWord.translation);
      toast.info(t("translate.alreadyExists"));
      return;
    }

    setTranslating(true);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: sourceText.trim(),
          sourceLanguage: lang === "zh" ? "zh-CN" : "en",
          targetLanguage: settings?.targetLanguage || "zh",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Translation failed");
      }

      const data = await response.json();
      setTargetText(data.translatedText);

      // Check if this is a sentence (contains spaces or is long)
      const isSentence = sourceText.trim().includes(" ") || sourceText.trim().length > 50;

      // Handle word suggestions from sentence translation
      if (isSentence) {
        // For sentences, show word suggestions but don't auto-save the sentence
        if (data.wordSuggestions && Array.isArray(data.wordSuggestions) && data.wordSuggestions.length > 0) {
          setWordSuggestions(data.wordSuggestions);
          setSavedWords(new Set());
          toast.success(t("translate.foundSuggestions").replace("{{count}}", data.wordSuggestions.length.toString()));
        } else {
          // No word suggestions extracted, just show the translation
          setWordSuggestions([]);
          toast.success(t("translate.sentenceTranslated"));
        }
      } else {
        // Single word translation - auto-save
        // Clean up trailing punctuation from the word
        const cleanedWord = normalizeText(sourceText);
        await addWord({
          word: cleanedWord,
          translation: data.translatedText.trim(),
          pronunciation: data.pronunciation || undefined,
          partOfSpeech: data.partOfSpeech || undefined,
          definitions: [],
          exampleSentences: [],
          tags: data.tags && Array.isArray(data.tags) ? data.tags : [],
          notes: data.notes || undefined,
          difficulty: data.difficulty || 3,
        });

        toast.success(t("translate.saved"));
        setWordSuggestions([]);
      }
    } catch (err) {
      console.error("Translation failed:", err);
      toast.error(t("translate.failed"));
    } finally {
      setTranslating(false);
    }
  };

  const saveSuggestedWord = async (suggestion: WordSuggestion) => {
    try {
      await addWord({
        word: suggestion.word,
        translation: suggestion.translation,
        pronunciation: suggestion.pronunciation,
        partOfSpeech: suggestion.partOfSpeech,
        definitions: [],
        exampleSentences: [],
        tags: suggestion.tags ?? [],
        notes: suggestion.notes,
        difficulty: suggestion.difficulty ?? 3,
      });

      setSavedWords((prev) => new Set(prev).add(suggestion.word));
      toast.success(t("translate.savedWord").replace("{{word}}", suggestion.word));
    } catch (err) {
      console.error("Failed to save word:", err);
      toast.error(t("translate.saveFailed"));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTranslate();
    }
  };

  // Camera functions
  const startCamera = async () => {
    setCameraLoading(true);
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready before playing
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            console.error("Failed to play video:", err);
          });
        };
      }
    } catch (err) {
      console.error("Failed to start camera:", err);
      toast.error(t("translate.camera.failed"));
      setShowCamera(false);
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Calculate resized dimensions (max 1280px width or height)
    const MAX_SIZE = 1280;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > height && width > MAX_SIZE) {
      height = Math.round((height * MAX_SIZE) / width);
      width = MAX_SIZE;
    } else if (height > MAX_SIZE) {
      width = Math.round((width * MAX_SIZE) / height);
      height = MAX_SIZE;
    }

    // Set canvas dimensions to resized size
    canvas.width = width;
    canvas.height = height;

    // Draw video frame to canvas (resized)
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    // Convert to base64 with reduced quality for smaller payload
    const imageData = canvas.toDataURL("image/jpeg", 0.85);

    // Stop camera and show crop modal
    stopCamera();
    setCapturedImage(imageData);
    // Initialize crop area to full image
    setCropArea({ x: 0, y: 0, width: 100, height: 100 });
    setShowCropModal(true);
  };

  // Crop selection handlers
  const handleCropMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cropContainerRef.current) return;
    
    const rect = cropContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setIsDragging(true);
    setDragStart({ x, y });
    setCropArea({ x, y, width: 0, height: 0 });
  }, []);

  const handleCropMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !cropContainerRef.current) return;
    
    const rect = cropContainerRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;
    
    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);
    
    setCropArea({ x, y, width, height });
  }, [isDragging, dragStart]);

  const handleCropMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCropTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!cropContainerRef.current) return;
    
    const touch = e.touches[0];
    const rect = cropContainerRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    
    setIsDragging(true);
    setDragStart({ x, y });
    setCropArea({ x, y, width: 0, height: 0 });
  }, []);

  const handleCropTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || !cropContainerRef.current) return;
    
    const touch = e.touches[0];
    const rect = cropContainerRef.current.getBoundingClientRect();
    const currentX = ((touch.clientX - rect.left) / rect.width) * 100;
    const currentY = ((touch.clientY - rect.top) / rect.height) * 100;
    
    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);
    
    setCropArea({ x, y, width, height });
  }, [isDragging, dragStart]);

  const handleCropTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetCrop = () => {
    setCropArea({ x: 0, y: 0, width: 100, height: 100 });
  };

  const cancelCrop = () => {
    setShowCropModal(false);
    setCapturedImage(null);
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
  };

  const confirmCropAndExtract = async () => {
    if (!capturedImage || !canvasRef.current) {
      toast.error("Missing image data");
      return;
    }

    setExtractingText(true);
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }

      // Create a temporary image to get dimensions
      const img = new Image();
      
      // Use a promise to wait for image load
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = capturedImage;
      });

      // Calculate crop coordinates in pixels
      const cropX = Math.round((cropArea.x / 100) * img.width);
      const cropY = Math.round((cropArea.y / 100) * img.height);
      const cropWidth = Math.max(1, Math.round((cropArea.width / 100) * img.width));
      const cropHeight = Math.max(1, Math.round((cropArea.height / 100) * img.height));

      // If no area selected (too small), use full image
      const finalCropX = cropWidth < 5 ? 0 : cropX;
      const finalCropY = cropHeight < 5 ? 0 : cropY;
      const finalCropWidth = cropWidth < 5 ? img.width : cropWidth;
      const finalCropHeight = cropHeight < 5 ? img.height : cropHeight;

      // Set canvas to crop size
      canvas.width = finalCropWidth;
      canvas.height = finalCropHeight;

      // Draw cropped portion
      ctx.drawImage(
        img,
        finalCropX,
        finalCropY,
        finalCropWidth,
        finalCropHeight,
        0,
        0,
        finalCropWidth,
        finalCropHeight
      );

      // Convert to base64
      const croppedImageData = canvas.toDataURL("image/jpeg", 0.9);

      // Close crop modal
      setShowCropModal(false);
      setCapturedImage(null);

      // Extract text from cropped image
      const response = await fetch("/api/vision/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: croppedImageData,
          language: settings?.sourceLanguage || "en",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to extract text");
      }

      const data = await response.json();
      
      if (data.text?.trim()) {
        setSourceText(data.text.trim());
        toast.success(t("translate.camera.extractSuccess"));
      } else {
        toast.info(t("translate.camera.noTextFound"));
      }
    } catch (err) {
      console.error("Text extraction failed:", err);
      toast.error(t("translate.camera.extractFail"));
    } finally {
      setExtractingText(false);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const getLanguageName = (code: string) => {
    // Map zh-CN to zh for settings key lookup if needed
    const lookupCode = code === "zh-CN" ? "zh" : code;
    return t(`settings.languages.${lookupCode}`) || code;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Translation Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 sm:mb-6">
          {/* Language Bar */}
          <div className="relative flex items-center justify-center px-4 sm:px-6 py-3 bg-gray-50 border-b">
            <span className="absolute left-4 sm:left-6 text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[40%]">
              {settings ? getLanguageName(settings.sourceLanguage) : "..."}
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span className="absolute right-4 sm:right-6 text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[40%]">
              {settings ? getLanguageName(settings.targetLanguage) : "..."}
            </span>
          </div>

          {/* Translation Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Source Text */}
            <div className="border-b md:border-b-0 md:border-r border-gray-200">
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={t("translate.placeholder.enter")}
                rows={6}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 resize-none focus:outline-none text-base sm:text-lg"
              />
              <div className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3 bg-gray-50 border-t">
                <span className="text-xs sm:text-sm text-gray-500">
                  {t("translate.chars").replace("{{count}}", sourceText.length.toString())}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={startCamera}
                    disabled={cameraLoading || extractingText}
                    className="text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                    title={t("translate.camera.start")}
                  >
                    {cameraLoading || extractingText ? (
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                  {sourceText && (
                    <button
                      onClick={() => speakText(sourceText, settings?.sourceLanguage || "en")}
                      className="text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Target Text */}
            <div>
              <textarea
                value={targetText}
                readOnly
                placeholder={t("translate.placeholder.translation")}
                rows={6}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 resize-none focus:outline-none text-base sm:text-lg bg-gray-50"
              />
              <div className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3 bg-gray-50 border-t">
                <span className="text-xs sm:text-sm text-gray-500">
                  {t("translate.chars").replace("{{count}}", targetText.length.toString())}
                </span>
                {targetText && (
                  <button
                    onClick={() => speakText(targetText, settings?.targetLanguage || "zh")}
                    className="text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Translate Button */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t">
            <button
              onClick={handleTranslate}
              disabled={translating || !sourceText.trim()}
              className="w-full bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
            >
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{translating ? t("translate.button.translating") : t("translate.button.translate")}</span>
            </button>
          </div>
        </div>

        {/* Camera Modal */}
        {showCamera && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative w-full max-w-lg bg-black rounded-xl overflow-hidden">
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
                <span className="text-white font-medium text-sm">{t("translate.camera.title")}</span>
                <button
                  onClick={stopCamera}
                  className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[4/3] object-cover bg-black"
              />

              {/* Loading State */}
              {cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                    <span className="text-white text-sm">{t("translate.camera.starting")}</span>
                  </div>
                </div>
              )}

              {/* Capture Button */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex justify-center">
                  <button
                    onClick={captureImage}
                    disabled={extractingText}
                    className="w-16 h-16 rounded-full bg-white border-4 border-white/30 hover:border-white/50 transition-all disabled:opacity-50 flex items-center justify-center"
                  >
                    {extractingText ? (
                      <Loader2 className="w-6 h-6 text-gray-800 animate-spin" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white" />
                    )}
                  </button>
                </div>
                <p className="text-center text-white/80 text-xs mt-2">
                  {t("translate.camera.tapToCapture")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Crop Selection Modal */}
        {showCropModal && capturedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
            <div className="relative w-full max-w-2xl bg-gray-900 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center space-x-2">
                  <Crop className="w-5 h-5 text-blue-400" />
                  <span className="text-white font-medium text-sm">{t("translate.crop.title")}</span>
                </div>
                <button
                  onClick={cancelCrop}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Crop Area */}
              <div className="p-4">
                <p className="text-gray-400 text-sm mb-3 text-center">
                  {t("translate.crop.instruction")}
                </p>
                
                <div
                  ref={cropContainerRef}
                  className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden cursor-crosshair select-none touch-none"
                  onMouseDown={handleCropMouseDown}
                  onMouseMove={handleCropMouseMove}
                  onMouseUp={handleCropMouseUp}
                  onMouseLeave={handleCropMouseUp}
                  onTouchStart={handleCropTouchStart}
                  onTouchMove={handleCropTouchMove}
                  onTouchEnd={handleCropTouchEnd}
                >
                  {/* Image */}
                  <img
                    ref={cropImageRef}
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                  
                  {/* Dark overlay outside crop area */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Top */}
                    <div
                      className="absolute bg-black/50"
                      style={{
                        top: 0,
                        left: 0,
                        right: 0,
                        height: `${cropArea.y}%`,
                      }}
                    />
                    {/* Bottom */}
                    <div
                      className="absolute bg-black/50"
                      style={{
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${100 - cropArea.y - cropArea.height}%`,
                      }}
                    />
                    {/* Left */}
                    <div
                      className="absolute bg-black/50"
                      style={{
                        top: `${cropArea.y}%`,
                        left: 0,
                        width: `${cropArea.x}%`,
                        height: `${cropArea.height}%`,
                      }}
                    />
                    {/* Right */}
                    <div
                      className="absolute bg-black/50"
                      style={{
                        top: `${cropArea.y}%`,
                        right: 0,
                        width: `${100 - cropArea.x - cropArea.width}%`,
                        height: `${cropArea.height}%`,
                      }}
                    />
                  </div>
                  
                  {/* Crop selection border */}
                  {cropArea.width > 0 && cropArea.height > 0 && (
                    <div
                      className="absolute border-2 border-blue-500 pointer-events-none"
                      style={{
                        left: `${cropArea.x}%`,
                        top: `${cropArea.y}%`,
                        width: `${cropArea.width}%`,
                        height: `${cropArea.height}%`,
                      }}
                    >
                      {/* Corner handles */}
                      <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full" />
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" />
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full" />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" />
                      
                      {/* Grid lines */}
                      <div className="absolute top-1/3 left-0 right-0 h-px bg-blue-500/50" />
                      <div className="absolute top-2/3 left-0 right-0 h-px bg-blue-500/50" />
                      <div className="absolute left-1/3 top-0 bottom-0 w-px bg-blue-500/50" />
                      <div className="absolute left-2/3 top-0 bottom-0 w-px bg-blue-500/50" />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-t border-gray-700">
                <button
                  onClick={resetCrop}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-sm">{t("translate.crop.reset")}</span>
                </button>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={cancelCrop}
                    className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors text-sm"
                  >
                    {t("translate.crop.cancel")}
                  </button>
                  <button
                    onClick={confirmCropAndExtract}
                    disabled={extractingText}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {extractingText ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">{t("translate.crop.extracting")}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span className="text-sm">{t("translate.crop.confirm")}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hidden canvas for image processing - always available */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Word Suggestions from Sentence Translation */}
        {wordSuggestions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 sm:mb-6">
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b">
              <h3 className="font-semibold text-gray-900 flex items-center space-x-2 text-sm sm:text-base">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                <span>{t("translate.suggestions.title")}</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {t("translate.suggestions.desc")}
              </p>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {wordSuggestions.map((suggestion) => {
                  const isSaved = savedWords.has(suggestion.word);
                  return (
                    <div
                      key={suggestion.word}
                      className={`border rounded-lg p-3 sm:p-4 transition-colors ${
                        isSaved
                          ? "bg-green-50 border-green-200"
                          : "bg-gray-50 border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                            <span className="font-bold text-gray-900 text-sm sm:text-base">{suggestion.word}</span>
                            <button
                              onClick={() => speakText(suggestion.word, settings?.sourceLanguage || "en")}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title={t("translate.suggestions.listen")}
                            >
                              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                            {suggestion.pronunciation && (
                              <span className="text-gray-500 text-xs sm:text-sm font-mono">
                                /{suggestion.pronunciation}/
                              </span>
                            )}
                            {suggestion.partOfSpeech && (
                              <span className="text-xs text-gray-500 bg-gray-200 px-1.5 sm:px-2 py-0.5 rounded">
                                {suggestion.partOfSpeech}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-700 text-sm sm:text-base">{suggestion.translation}</p>
                          {suggestion.tags && suggestion.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5 sm:mt-2">
                              {suggestion.tags.map((tag: string) => (
                                <span
                                  key={tag}
                                  className="text-xs bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {suggestion.notes && (
                            <p className="text-xs sm:text-sm text-gray-500 mt-1.5 sm:mt-2 italic">{suggestion.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => saveSuggestedWord(suggestion)}
                          disabled={isSaved}
                          className={`flex-shrink-0 p-1.5 sm:p-2 rounded-lg transition-colors ${
                            isSaved
                              ? "bg-green-100 text-green-600 cursor-default"
                              : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                          }`}
                          title={isSaved ? t("translate.suggestions.saved") : t("translate.suggestions.save")}
                        >
                          {isSaved ? (
                            <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={() => router.push(`/${lang}/vocabulary`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 text-left hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{t("translate.quickActions.viewVocab")}</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  {t("translate.quickActions.vocabCount").replace("{{count}}", vocabulary.length.toString()).replace("{{plural}}", vocabulary.length === 1 ? "" : "s")}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push(`/${lang}/quiz`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 text-left hover:border-blue-300 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              <div>
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{t("translate.quickActions.takeQuiz")}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{t("translate.quickActions.quizDesc")}</p>
              </div>
            </div>
          </button>
        </div>
      </main>

      <BuyMeACoffee language={lang === "zh" ? "zh-TW" : "en"} />
    </div>
  );
}
