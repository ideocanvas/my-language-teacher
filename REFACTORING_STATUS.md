# Refactoring & Internationalization Status

## Design Pattern

To ensure proper server-side rendering support and optimized client-side interactivity, we are refactoring all pages in `app/[lang]/*` to follow this pattern:

### 1. Server Component Wrapper (`page.tsx`)

- Responsible for `generateStaticParams` (for SSG of implementation paths).
- Await `params` to extract the `lang` (e.g., "en", "zh").
- Passes `lang` to the client component.
- **Code Example**:

  ```tsx
  import { FeatureClient } from "@/components/feature-client";

  export function generateStaticParams() {
    return [{ lang: "en" }, { lang: "zh" }];
  }

  export default async function FeaturePage({
    params,
  }: {
    params: Promise<{ lang: string }>;
  }) {
    const { lang } = await params;
    return <FeatureClient lang={lang} />;
  }
  ```

### 2. Client Component (`components/*-client.tsx`)

- Contains all React hooks (`useState`, `useEffect`, etc.).
- Handles state management and UI interactivity.
- Receives `lang` as a prop.
- Uses `getTranslations` helper within `useMemo` for efficient translation loading.
- **Code Example**:

  ```tsx
  "use client";
  import { useMemo } from "react";
  import { getTranslations } from "@/lib/client-i18n";

  export function FeatureClient({ lang }: { lang: string }) {
    const t = useMemo(() => getTranslations(lang), [lang]);

    return <h1>{t("feature.title")}</h1>;
  }
  ```

## Progress Tracker

### Completed ✅

- **Global Components**:
  - `AppNavigation`, `ProfileSelector`, `SyncPanel`, `ClipboardHistoryItem` fully localized.
- **Dashboard (`/`)**:
  - Refactored to `components/dashboard-client.tsx`.
- **AI Assistant (`/ai`)**:
  - Refactored to `components/ai-client.tsx`.
- **Vocabulary List (`/vocabulary`)**:
  - Refactored to `components/vocabulary-list-client.tsx`.
- **Sync (`/sync`)**:
  - Refactored to `components/sync-client.tsx`.

### Completed ✅

- **Global Components**:
  - `AppNavigation`, `ProfileSelector`, `SyncPanel`, `ClipboardHistoryItem` fully localized.
- **Dashboard (`/`)**:
  - Refactored to `components/dashboard-client.tsx`.
- **AI Assistant (`/ai`)**:
  - Refactored to `components/ai-client.tsx`.
- **Vocabulary List (`/vocabulary`)**:
  - Refactored to `components/vocabulary-list-client.tsx`.
- **Sync (`/sync`)**:
  - Refactored to `components/sync-client.tsx`.
- **Settings (`/settings`)**:
  - Refactored to `components/settings-client.tsx`.
  - All locale strings localized.

### Pending 📅

1. **Translate Page (`/translate`)**:
   - Needs localization and structural refactor.
2. **Vocabulary Details (`/vocabulary/[id]`)**:
   - Needs localization (Edit functionality) and refactor.
3. **Vocabulary Add (`/vocabulary/add`)**:
   - Needs localization and refactor.
4. **Quiz Hub (`/quiz`)**:
   - Needs localization and refactor.
5. **Quiz Modes**:
   - `fill-blank`
   - `flashcard`
   - `listening`
   - `multiple-choice`
   - `typing`

## Next Steps

1. Tackle **Vocabulary Add/Edit** pages to complete the vocabulary domain.
2. Refactor **Quiz** section (largest remaining module).
