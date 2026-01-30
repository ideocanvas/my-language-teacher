"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNavigation } from "@/components/app-navigation";
import BuyMeACoffee from "@/components/BuyMeACoffee";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { useSettings } from "@/hooks/use-settings";
import { getDaysUntilReview } from "@/lib/srs-algorithm";
import {
  Search,
  Filter,
  Volume2,
  Calendar,
  Tag,
  Trash2,
  Edit,
  Plus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Book,
  GitCompare,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getTranslations, type Locale } from "@/lib/client-i18n";

interface VocabularyListClientProps {
  readonly lang: Locale;
}

const ITEMS_PER_PAGE = 20;

export function VocabularyListClient({ lang }: VocabularyListClientProps) {
  const router = useRouter();
  const { vocabulary, loading, deleteWord, getAllTags } = useVocabulary();
  const { settings } = useSettings();
  const t = useMemo(() => getTranslations(lang), [lang]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // AI shortcut states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allTags = getAllTags();

  const speakWord = async (word: string) => {
    try {
      const { speakText } = await import("@/lib/tts-utils");
      await speakText(word, lang === "zh" ? "zh-CN" : "en-US");
    } catch (err) {
      console.error(t("vocabulary.speakError"), err);
      toast.error(t("vocabulary.pronunciationError"));
    }
  };

  const handleDelete = async (id: string, word: string) => {
    if (globalThis.confirm(t("vocabulary.deleteConfirm").replace("{{word}}", word))) {
      try {
        await deleteWord(id);
        toast.success(t("vocabulary.deleted").replace("{{word}}", word));
      } catch (err) {
        console.error(t("vocabulary.deleteError"), err);
         // Ideally show a toast here too
      }
    }
  };

  const handleGoogleTranslate = (word: string) => {
    // Use user's language settings for translation direction
    const sourceLang = settings?.sourceLanguage || "en";
    const targetLang = settings?.targetLanguage || "zh";
    const url = `https://translate.google.com/?sl=${sourceLang}&tl=${targetLang}&text=${encodeURIComponent(word)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // AI shortcut functions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleGenerateSentences = (entry: typeof vocabulary[0]) => {
    const params = new Array<{ key: string; value: string }>();
    params.push({ key: "feature", value: "sentences" });
    params.push({ key: "word", value: entry.word });
    params.push({ key: "translation", value: entry.translation });
    params.push({ key: "difficulty", value: entry.difficulty.toString() });
    const queryString = params.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
    router.push(`/${lang}/ai?${queryString}`);
  };

  const handleCompareWords = () => {
    if (selectedIds.size < 2) {
      toast.error(t("vocabulary.selectAtLeastTwo") || "Select at least 2 words to compare");
      return;
    }
    const selectedEntries = vocabulary.filter((v) => selectedIds.has(v.id));
    const words = selectedEntries.map((v) => v.word).join(",");
    const params = new Array<{ key: string; value: string }>();
    params.push({ key: "feature", value: "compare" });
    params.push({ key: "words", value: words });
    const queryString = params.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
    router.push(`/${lang}/ai?${queryString}`);
  };

  const selectAllVisible = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const visibleIds = filteredVocabulary
      .slice(startIndex, startIndex + ITEMS_PER_PAGE)
      .map((v) => v.id);
    setSelectedIds(new Set(visibleIds));
  };

  // Filter vocabulary
  const filteredVocabulary = vocabulary.filter((entry) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        entry.word.toLowerCase().includes(query) ||
        entry.translation.toLowerCase().includes(query) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(query));

      if (!matchesSearch) return false;
    }

    // Tag filter
    if (selectedTags.length > 0) {
      const hasSelectedTag = selectedTags.some((tag) => entry.tags.includes(tag));
      if (!hasSelectedTag) return false;
    }

    // Difficulty filter
    if (selectedDifficulty.length > 0) {
      if (!selectedDifficulty.includes(entry.difficulty)) return false;
    }

    return true;
  }).sort((a, b) => b.createdAt - a.createdAt);


  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTags([]);
    setSelectedDifficulty([]);
    setCurrentPage(1);
  };

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setCurrentPage(1);
  };

  const handleToggleDifficulty = (difficulty: number) => {
    setSelectedDifficulty((prev) =>
      prev.includes(difficulty) ? prev.filter((d) => d !== difficulty) : [...prev, difficulty]
    );
    setCurrentPage(1);
  };

  const hasFilters = searchQuery || selectedTags.length > 0 || selectedDifficulty.length > 0;

  const getDifficultyColor = (difficulty: number) => {
    switch (difficulty) {
      case 1:
        return "bg-green-100 text-green-800";
      case 2:
        return "bg-blue-100 text-blue-800";
      case 3:
        return "bg-yellow-100 text-yellow-800";
      case 4:
        return "bg-orange-100 text-orange-800";
      case 5:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t("vocabulary.title")}</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              {t("vocabulary.wordCount").replace("{{count}}", vocabulary.length.toString()).replace("{{plural}}", vocabulary.length === 1 ? "" : "s")}
            </p>
          </div>
          <button
            onClick={() => router.push(`/${lang}/vocabulary/add`)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            <span>{t("vocabulary.addWord")}</span>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder={t("vocabulary.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
                  hasFilters
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Filter className="w-5 h-5" />
                <span className="hidden sm:inline">{t("vocabulary.filters")}</span>
              </button>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {t("vocabulary.clear")}
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="border-t pt-4">
              {/* Tag filters */}
              {allTags.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Tag className="w-4 h-4 mr-1" />
                    {t("vocabulary.tags")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleToggleTag(tag)}
                        className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                          selectedTags.includes(tag)
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Difficulty filters */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{t("vocabulary.difficulty")}</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => handleToggleDifficulty(level)}
                      className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                        selectedDifficulty.includes(level)
                          ? getDifficultyColor(level)
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vocabulary List */}
        {(() => {
          if (loading) {
            return (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">{t("vocabulary.loading")}</p>
              </div>
            );
          }
          if (filteredVocabulary.length === 0) {
            return (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-12 text-center">
                {hasFilters ? (
                  <>
                    <Search className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{t("vocabulary.noMatchingWords")}</h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-4">{t("vocabulary.adjustFilters")}</p>
                    <button
                      onClick={clearFilters}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm sm:text-base"
                    >
                      {t("vocabulary.clearFiltersBtn")}
                    </button>
                  </>
                ) : (
                  <>
                    <Plus className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{t("vocabulary.noVocabularyYet")}</h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-4">
                      {t("vocabulary.startBuilding")}
                    </p>
                    <button
                      onClick={() => router.push(`/${lang}/vocabulary/add`)}
                      className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
                    >
                      {t("vocabulary.addFirstWord")}
                    </button>
                  </>
                )}
              </div>
            );
          }
          // Pagination logic
          const totalPages = Math.ceil(filteredVocabulary.length / ITEMS_PER_PAGE);
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
          const paginatedVocabulary = filteredVocabulary.slice(startIndex, startIndex + ITEMS_PER_PAGE);

          return (
          <div className="space-y-3 sm:space-y-4">
            {paginatedVocabulary.map((entry) => {
              const daysUntilReview = getDaysUntilReview(entry.srsData);
              const isDue = daysUntilReview === 0;

              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:border-blue-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Checkbox for selection mode */}
                    {selectionMode && (
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelection(entry.id)}
                          className="w-5 h-5 mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          aria-label={`Select ${entry.word}`}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {/* Word and pronunciation */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900">{entry.word}</h3>
                        {entry.pronunciation && (
                          <span className="text-gray-500 text-xs sm:text-sm font-mono">
                            /{entry.pronunciation}/
                          </span>
                        )}
                        <button
                          onClick={() => speakWord(entry.word)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(
                            entry.difficulty
                          )}`}
                        >
                          {entry.difficulty}
                        </span>
                        {entry.translationCount > 1 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {entry.translationCount}x
                          </span>
                        )}
                      </div>

                      {/* Translation */}
                      <p className="text-base sm:text-lg text-gray-700 mb-2 sm:mb-3">{entry.translation}</p>

                      {/* Tags */}
                      {entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs sm:text-sm"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Example sentence */}
                      {entry.exampleSentences.length > 0 && (
                        <p className="text-gray-600 text-xs sm:text-sm italic mb-2 sm:mb-3">
                          "{entry.exampleSentences[0]}"
                        </p>
                      )}

                      {/* Next review */}
                      <div className="flex items-center text-xs sm:text-sm text-gray-500">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        {isDue ? (
                          <span className="text-orange-600 font-medium">{t("vocabulary.dueForReview")}</span>
                        ) : (
                          <span>
                            {t("vocabulary.reviewIn").replace("{{days}}", daysUntilReview.toString()).replace("{{plural}}", daysUntilReview === 1 ? "" : "s")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-1 sm:space-x-2 sm:ml-4">
                      <button
                        onClick={() => handleGenerateSentences(entry)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t("vocabulary.generateSentences") || "Generate Sentences"}
                      >
                        <Book className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <button
                        onClick={toggleSelectionMode}
                        className={`p-2 rounded-lg transition-colors ${
                          selectionMode
                            ? "text-green-600 bg-green-50"
                            : "text-gray-600 hover:text-green-600 hover:bg-green-50"
                        }`}
                        title={t("vocabulary.compareWords") || "Compare Words"}
                      >
                        <GitCompare className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <button
                        onClick={() => handleGoogleTranslate(entry.word)}
                        className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Google Translate"
                      >
                        <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <button
                        onClick={() => router.push(`/${lang}/vocabulary/${entry.id}`)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t("vocabulary.edit")}
                      >
                        <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id, entry.word)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t("vocabulary.delete")}
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 mt-4">
                <div className="text-sm text-gray-600">
                  {t("vocabulary.showing")?.replace("{{start}}", (startIndex + 1).toString())
                    ?.replace("{{end}}", Math.min(startIndex + ITEMS_PER_PAGE, filteredVocabulary.length).toString())
                    ?.replace("{{total}}", filteredVocabulary.length.toString())
                    || `Showing ${startIndex + 1}-${Math.min(startIndex + ITEMS_PER_PAGE, filteredVocabulary.length)} of ${filteredVocabulary.length}`}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={t("vocabulary.previousPage") || "Previous page"}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-gray-700 px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={t("vocabulary.nextPage") || "Next page"}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* Bulk Action Bar for Selection Mode */}
        {selectionMode && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-50">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-4">
                <span className="font-medium text-gray-900">
                  {(t("vocabulary.selectedCount") || "{{count}} selected").replace("{{count}}", selectedIds.size.toString())}
                </span>
                <button
                  onClick={selectAllVisible}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  {t("vocabulary.selectAll") || "Select All"}
                </button>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  onClick={handleCompareWords}
                  disabled={selectedIds.size < 2}
                  className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <GitCompare className="w-4 h-4" />
                  <span>{(t("vocabulary.compareSelected") || "Compare Selected ({{count}})").replace("{{count}}", selectedIds.size.toString())}</span>
                </button>
                <button
                  onClick={toggleSelectionMode}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <BuyMeACoffee language={lang === "zh" ? "zh-TW" : "en"} />
    </div>
  );
}
