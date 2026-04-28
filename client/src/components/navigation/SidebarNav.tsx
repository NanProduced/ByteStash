import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Star,
  Clock,
  FolderOpen,
  Code2,
  Tag,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Snippet } from "../../types/snippets";

export interface LanguageCount {
  language: string;
  count: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface SidebarNavProps {
  metadata: {
    categories: string[];
    languages: string[];
    counts: { total: number };
  };
  snippets: Snippet[];
  isOpen: boolean;
  onToggle: () => void;
  onTagDrop?: (snippetId: string, tag: string) => void;
}

type ViewType = "all" | "favorites" | "recent";

const STORAGE_KEYS = {
  COLLAPSED_MY: "sidebar_collapsed_my",
  COLLAPSED_LANGUAGES: "sidebar_collapsed_languages",
  COLLAPSED_TAGS: "sidebar_collapsed_tags",
};

export const SidebarNav: React.FC<SidebarNavProps> = ({
  metadata,
  snippets,
  isOpen,
  onToggle,
  onTagDrop,
}) => {
  const { t: translate } = useTranslation('components/snippets/view/all');
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsedSections, setCollapsedSections] = useState({
    my: localStorage.getItem(STORAGE_KEYS.COLLAPSED_MY) === "true",
    languages: localStorage.getItem(STORAGE_KEYS.COLLAPSED_LANGUAGES) === "true",
    tags: localStorage.getItem(STORAGE_KEYS.COLLAPSED_TAGS) === "true",
  });

  const [draggedSnippet, setDraggedSnippet] = useState<string | null>(null);
  const [dragOverTag, setDragOverTag] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COLLAPSED_MY, String(collapsedSections.my));
    localStorage.setItem(STORAGE_KEYS.COLLAPSED_LANGUAGES, String(collapsedSections.languages));
    localStorage.setItem(STORAGE_KEYS.COLLAPSED_TAGS, String(collapsedSections.tags));
  }, [collapsedSections]);

  // Keep metadata for compatibility (not currently used, but passed from parent)
  void metadata;

  const currentView = useMemo((): ViewType => {
    const favorites = searchParams.get("favorites") === "true";
    const recent = searchParams.get("recent") === "true";
    if (favorites) return "favorites";
    if (recent) return "recent";
    return "all";
  }, [searchParams]);

  const currentLanguage = searchParams.get("language") || "";
  const currentCategories = searchParams.get("categories")?.split(",").filter(Boolean) || [];

  const languageCounts = useMemo((): LanguageCount[] => {
    const counts: Record<string, number> = {};
    snippets.forEach((snippet) => {
      const languages = new Set<string>();
      snippet.fragments.forEach((f) => {
        if (f.language) {
          languages.add(f.language);
        }
      });
      languages.forEach((lang) => {
        counts[lang] = (counts[lang] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);
  }, [snippets]);

  const tagCounts = useMemo((): TagCount[] => {
    const counts: Record<string, number> = {};
    snippets.forEach((snippet) => {
      snippet.categories.forEach((cat) => {
        counts[cat] = (counts[cat] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [snippets]);

  const favoritesCount = useMemo(() => {
    return snippets.filter((s) => s.is_favorite === 1).length;
  }, [snippets]);

  const recentCount = Math.min(10, snippets.length);

  const toggleSection = useCallback((section: "my" | "languages" | "tags") => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const setView = useCallback(
    (view: ViewType) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (view === "favorites") {
          next.set("favorites", "true");
          next.delete("recent");
        } else if (view === "recent") {
          next.set("recent", "true");
          next.delete("favorites");
        } else {
          next.delete("favorites");
          next.delete("recent");
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const setLanguageFilter = useCallback(
    (language: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (language) {
          next.set("language", language);
        } else {
          next.delete("language");
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const toggleCategoryFilter = useCallback(
    (category: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const current = next.get("categories")?.split(",").filter(Boolean) || [];
        const updated = current.includes(category)
          ? current.filter((c) => c !== category)
          : [...current, category];

        if (updated.length > 0) {
          next.set("categories", updated.join(","));
        } else {
          next.delete("categories");
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const handleDragOver = useCallback((e: React.DragEvent, tag: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTag(tag);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTag(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, tag: string) => {
      e.preventDefault();
      const snippetId = e.dataTransfer.getData("text/plain");
      if (snippetId && onTagDrop) {
        onTagDrop(snippetId, tag);
      }
      setDraggedSnippet(null);
      setDragOverTag(null);
    },
    [onTagDrop]
  );

  const clearAllFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("favorites");
      next.delete("recent");
      next.delete("language");
      next.delete("categories");
      return next;
    });
  }, [setSearchParams]);

  const hasActiveFilters = currentView !== "all" || currentLanguage || currentCategories.length > 0;

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-r-lg shadow-lg hover:bg-light-hover dark:hover:bg-dark-hover transition-colors"
        title={translate('sidebar.expand')}
      >
        <PanelLeftOpen size={20} className="text-light-text-secondary dark:text-dark-text-secondary" />
      </button>
    );
  }

  const SectionHeader: React.FC<{
    title: string;
    section: "my" | "languages" | "tags";
    collapsed: boolean;
  }> = ({ title, section, collapsed }) => (
    <button
      onClick={() => toggleSection(section)}
      className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover/50 dark:hover:bg-dark-hover/50 transition-colors"
    >
      {collapsed ? (
        <ChevronRight size={14} className="shrink-0" />
      ) : (
        <ChevronDown size={14} className="shrink-0" />
      )}
      <span className="truncate">{title}</span>
    </button>
  );

  const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    count?: number;
    active: boolean;
    onClick: () => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: () => void;
    onDrop?: (e: React.DragEvent) => void;
    draggable?: boolean;
    isDragOver?: boolean;
  }> = ({
    icon,
    label,
    count,
    active,
    onClick,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    draggable,
    isDragOver,
  }) => (
    <button
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors rounded ${
        active
          ? "bg-light-primary/15 dark:bg-dark-primary/15 text-light-primary dark:text-dark-primary font-medium"
          : "text-light-text dark:text-dark-text hover:bg-light-hover/50 dark:hover:bg-dark-hover/50"
      } ${
        isDragOver
          ? "bg-light-primary/20 dark:bg-dark-primary/20 border-2 border-dashed border-light-primary dark:border-dark-primary"
          : ""
      }`}
    >
      <span className="shrink-0 text-light-text-secondary dark:text-dark-text-secondary">{icon}</span>
      <span className="truncate flex-1 text-left">{label}</span>
      {count !== undefined && (
        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-light-hover dark:bg-dark-hover text-light-text-secondary dark:text-dark-text-secondary">
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="w-64 shrink-0 bg-light-surface dark:bg-dark-surface border-r border-light-border dark:border-dark-border flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-light-border dark:border-dark-border">
        <h2 className="text-sm font-semibold text-light-text dark:text-dark-text">
          {translate('sidebar.title')}
        </h2>
        <div className="flex items-center gap-1">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="p-1 hover:bg-light-hover dark:hover:bg-dark-hover rounded transition-colors"
              title={translate('sidebar.clearFilters')}
            >
              <X size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1 hover:bg-light-hover dark:hover:bg-dark-hover rounded transition-colors"
            title={translate('sidebar.collapse')}
          >
            <PanelLeftClose size={16} className="text-light-text-secondary dark:text-dark-text-secondary" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          <SectionHeader
            title={translate('sidebar.my')}
            section="my"
            collapsed={collapsedSections.my}
          />
          {!collapsedSections.my && (
            <div className="mt-1">
              <NavItem
                icon={<FolderOpen size={16} />}
                label={translate('sidebar.all')}
                count={snippets.length}
                active={currentView === "all"}
                onClick={() => setView("all")}
              />
              <NavItem
                icon={<Star size={16} />}
                label={translate('sidebar.favorites')}
                count={favoritesCount}
                active={currentView === "favorites"}
                onClick={() => setView("favorites")}
              />
              <NavItem
                icon={<Clock size={16} />}
                label={translate('sidebar.recent')}
                count={recentCount}
                active={currentView === "recent"}
                onClick={() => setView("recent")}
              />
            </div>
          )}
        </div>

        <div className="border-t border-light-border dark:border-dark-border py-2">
          <SectionHeader
            title={translate('sidebar.languages')}
            section="languages"
            collapsed={collapsedSections.languages}
          />
          {!collapsedSections.languages && languageCounts.length > 0 && (
            <div className="mt-1">
              <NavItem
                icon={<Code2 size={16} />}
                label={translate('sidebar.allLanguages')}
                count={snippets.length}
                active={!currentLanguage}
                onClick={() => setLanguageFilter("")}
              />
              {languageCounts.map(({ language, count }) => (
                <NavItem
                  key={language}
                  icon={<Code2 size={16} />}
                  label={language}
                  count={count}
                  active={currentLanguage === language}
                  onClick={() => setLanguageFilter(language)}
                />
              ))}
            </div>
          )}
          {!collapsedSections.languages && languageCounts.length === 0 && (
            <div className="px-3 py-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {translate('sidebar.noLanguages')}
            </div>
          )}
        </div>

        <div className="border-t border-light-border dark:border-dark-border py-2">
          <SectionHeader
            title={translate('sidebar.tags')}
            section="tags"
            collapsed={collapsedSections.tags}
          />
          {!collapsedSections.tags && tagCounts.length > 0 && (
            <div className="mt-1">
              {tagCounts.map(({ tag, count }) => (
                <NavItem
                  key={tag}
                  icon={<Tag size={16} />}
                  label={tag}
                  count={count}
                  active={currentCategories.includes(tag)}
                  onClick={() => toggleCategoryFilter(tag)}
                  onDragOver={(e) => handleDragOver(e, tag)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, tag)}
                  isDragOver={dragOverTag === tag}
                />
              ))}
            </div>
          )}
          {!collapsedSections.tags && tagCounts.length === 0 && (
            <div className="px-3 py-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {translate('sidebar.noTags')}
            </div>
          )}
        </div>
      </div>

      {draggedSnippet && (
        <div className="px-3 py-2 border-t border-light-border dark:border-dark-border bg-light-hover/50 dark:bg-dark-hover/50">
          <div className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
            <MoreHorizontal size={14} className="animate-pulse" />
            <span>{translate('sidebar.dragHint')}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarNav;
