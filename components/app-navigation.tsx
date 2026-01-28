"use client";

import {
  ArrowRight,
  BookOpen,
  Brain,
  Settings,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/en/vocabulary", icon: BookOpen, label: "Vocabulary" },
  { href: "/en/quiz", icon: Brain, label: "Quiz" },
  { href: "/en/ai", icon: Sparkles, label: "AI Assistant" },
  { href: "/en/vocabulary/add", icon: ArrowRight, label: "Translate" },
  { href: "/en/settings", icon: Settings, label: "Settings" },
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/en" className="flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg text-gray-900">Language Teacher</span>
          </Link>

          <div className="flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              const isTranslateButton = item.href === "/en/vocabulary/add";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : isTranslateButton
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}