"use client";

import {
  ArrowRight,
  BookOpen,
  Brain,
  Settings,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProfileSelector } from "./profile-selector";
import { useState, useMemo } from "react";
import { locales, defaultLocale, type Locale, getTranslations } from "@/lib/client-i18n";

export function AppNavigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Extract current locale from pathname
  const currentLocale = useMemo<Locale>(() => {
    if (!pathname) return defaultLocale;
    const segments = pathname.split('/');
    const firstSegment = segments[1];
    if (locales.includes(firstSegment as Locale)) {
      return firstSegment as Locale;
    }
    return defaultLocale;
  }, [pathname]);

  const t = useMemo(() => getTranslations(currentLocale), [currentLocale]);

  // Build nav items with current locale
  const navItems = useMemo(() => {
    return [
      { path: "/vocabulary", icon: BookOpen, label: t("navigation.vocabulary"), href: `/${currentLocale}/vocabulary` },
      { path: "/quiz", icon: Brain, label: t("navigation.quiz"), href: `/${currentLocale}/quiz` },
      { path: "/ai", icon: Sparkles, label: t("navigation.ai"), href: `/${currentLocale}/ai` },
      { path: "/translate", icon: ArrowRight, label: t("navigation.translate"), href: `/${currentLocale}/translate` },
      { path: "/settings", icon: Settings, label: t("navigation.settings"), href: `/${currentLocale}/settings` },
    ];
  }, [currentLocale, t]);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={`/${currentLocale}`} className="flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg text-gray-900 hidden sm:inline">{t("metadata.title")}</span>
            <span className="font-bold text-lg text-gray-900 sm:hidden">LT</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              const isTranslateButton = item.path === "/translate";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    (() => {
                      if (isActive) {
                        return "bg-blue-100 text-blue-700";
                      }
                      if (isTranslateButton) {
                        return "bg-green-600 text-white hover:bg-green-700";
                      }
                      return "text-gray-600 hover:bg-gray-100";
                    })()
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="border-l border-gray-200 ml-2 pl-2">
              <ProfileSelector />
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-2 md:hidden">
            <ProfileSelector />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                const isTranslateButton = item.path === "/translate";

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                      (() => {
                        if (isActive) {
                          return "bg-blue-100 text-blue-700";
                        }
                        if (isTranslateButton) {
                          return "bg-green-600 text-white";
                        }
                        return "text-gray-600 hover:bg-gray-100";
                      })()
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
