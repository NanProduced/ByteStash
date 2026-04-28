import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { initializeMonaco } from "../../../../utils/language/languageUtils";
import { useAuth } from "../../../../hooks/useAuth";
import { useSettings } from "../../../../hooks/useSettings";
import { useCreateSnippet, useEditSnippet, useSnippetsInfiniteQuery, SnippetsQueryKey } from "../../../../hooks/useSnippetsQuery";
import { useToast } from "../../../../hooks/useToast";
import { SearchAndFilter } from "../../../search/SearchAndFilter";
import { snippetService } from "../../../../service/snippetService";
import { Snippet } from "../../../../types/snippets";
import SettingsModal from "../../../settings/SettingsModal";
import { UserDropdown } from "../../../auth/UserDropdown";
import EditSnippetModal from "../../edit/EditSnippetModal";
import { ShareMenu } from "../../share/ShareMenu";
import SnippetContentArea from "./SnippetContentArea";
import StorageHeader from "./StorageHeader";
import SidebarNav from "../../../navigation/SidebarNav";
import { getSnippetById, editSnippet } from "../../../../utils/api/snippets";

const SIDEBAR_OPEN_KEY = "sidebar_open";

const BaseSnippetStorage: React.FC = () => {
  const { t: translate } = useTranslation('components/snippets/view/common');
  const [, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { isAuthenticated, logout } = useAuth();
  const {
    viewMode,
    setViewMode,
    compactView,
    showCodePreview,
    previewLines,
    includeCodeInSearch,
    updateSettings,
    showCategories,
    expandCategories,
    showLineNumbers,
    theme,
    locale,
    showFavorites,
    setShowFavorites,
  } = useSettings();

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_OPEN_KEY);
    return stored !== "false";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_OPEN_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

  const [metadata, setMetadata] = useState<{ categories: string[]; languages: string[]; counts: { total: number } }>({
    categories: [],
    languages: [],
    counts: { total: 0 }
  });

  const [isEditSnippetModalOpen, setIsEditSnippetModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [snippetToEdit, setSnippetToEdit] = useState<Snippet | null>(null);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [snippetToShare, setSnippetToShare] = useState<Snippet | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const mountedRef = useRef(false);

  const createSnippetMutation = useCreateSnippet();
  const editSnippetMutation = useEditSnippet();

  const unfilteredQueryFilters: SnippetsQueryKey = useMemo(() => ({
    search: undefined,
    searchCode: false,
    language: undefined,
    category: undefined,
    favorites: false,
    recycled: false,
    sort: "newest",
    viewType: "base",
  }), []);

  const { data: unfilteredData } = useSnippetsInfiniteQuery(unfilteredQueryFilters);

  const allSnippets = useMemo(() => {
    return unfilteredData?.pages.flatMap(page => page.data) ?? [];
  }, [unfilteredData]);

  useEffect(() => {
    mountedRef.current = true;
    initializeMonaco();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const data = await snippetService.getSnippetsMetadata();
        setMetadata(data);
      } catch (error) {
        console.error("Failed to fetch metadata:", error);
      }
    };
    fetchMetadata();
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, snippetId: string) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", snippetId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTagDrop = useCallback(async (snippetId: string, tag: string) => {
    try {
      const snippet = await getSnippetById(snippetId);
      if (!snippet) {
        addToast(translate('baseSnippetStorage.error.tagAddFailed'), "error");
        return;
      }

      const hasTag = snippet.categories.includes(tag);
      if (hasTag) {
        addToast(translate('baseSnippetStorage.info.tagAlreadyExists'), "info");
        return;
      }

      const updatedCategories = [...snippet.categories, tag];

      const result = await editSnippet(snippetId, {
        title: snippet.title,
        description: snippet.description,
        categories: updatedCategories,
        fragments: snippet.fragments,
        is_public: snippet.is_public,
        is_pinned: snippet.is_pinned,
        is_favorite: snippet.is_favorite,
      });

      if (result) {
        addToast(translate('baseSnippetStorage.success.tagAdded'), "success");
      }
    } catch (error: any) {
      console.error("Failed to add tag:", error);
      if (error.status === 401 || error.status === 403) {
        logout();
        addToast(translate('baseSnippetStorage.error.sessionExpired'), "error");
      } else {
        addToast(translate('baseSnippetStorage.error.tagAddFailed'), "error");
      }
    } finally {
      setIsDragging(false);
    }
  }, [addToast, logout]);

  const handleDrop = useCallback(
    (e: React.DragEvent, tag: string) => {
      e.preventDefault();
      const snippetId = e.dataTransfer.getData("text/plain");
      if (snippetId) {
        handleTagDrop(snippetId, tag);
      }
    },
    [handleTagDrop]
  );

  const handleSearchChange = useCallback((search: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        next.set("search", trimmedSearch);
      } else {
        next.delete("search");
      }
      return next;
    });
  }, [setSearchParams]);

  const handleLanguageChange = useCallback((language: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (language) {
        next.set("language", language);
      } else {
        next.delete("language");
      }
      return next;
    });
  }, [setSearchParams]);

  const handleCategoryToggle = useCallback((category: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const current = next.get("categories")?.split(",").filter(Boolean) || [];
      const updated = current.includes(category)
        ? current.filter(c => c !== category)
        : [...current, category];

      if (updated.length > 0) {
        next.set("categories", updated.join(","));
      } else {
        next.delete("categories");
      }
      return next;
    });
  }, [setSearchParams]);

  const handleSortChange = useCallback((sort: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("sort", sort);
      return next;
    });
  }, [setSearchParams]);

  const handleShowFavorites = useCallback(() => {
    setShowFavorites((prev) => {
      const newValue = !prev;
      if (newValue) {
        addToast(translate('baseSnippetStorage.success.displayFavorites'), "success");
      } else {
        addToast(translate('baseSnippetStorage.success.displayAll'), "info");
      }
      return newValue;
    });
  }, [setShowFavorites, addToast]);

  const openEditSnippetModal = useCallback((snippet: Snippet | null = null) => {
    setSnippetToEdit(snippet);
    setIsEditSnippetModalOpen(true);
  }, []);

  const closeEditSnippetModal = useCallback(() => {
    setSnippetToEdit(null);
    setIsEditSnippetModalOpen(false);
  }, []);
  
  const sessionExpiredHandler = useCallback(() => {
    logout();
    addToast(translate('baseSnippetStorage.error.sessionExpired'), "error");
  }, []);

  const handleSnippetSubmit = useCallback(async (snippetData: Omit<Snippet, "id" | "updated_at">) => {
    try {
      if (snippetToEdit) {
        await editSnippetMutation.mutateAsync({ id: snippetToEdit.id, snippet: snippetData });
        addToast(translate('baseSnippetStorage.success.snippetUpdated'), "success");
      } else {
        await createSnippetMutation.mutateAsync(snippetData);
        addToast(translate('baseSnippetStorage.success.snippetCreated'), "success");
      }
      closeEditSnippetModal();
    } catch (error: any) {
      console.error("Error saving snippet:", error);
      if (error.status === 401 || error.status === 403) {
        sessionExpiredHandler();
      } else {
        addToast(
          snippetToEdit
            ? translate('baseSnippetStorage.error.snippetUpdated')
            : translate('baseSnippetStorage.error.snippetCreated'),
          "error"
        );
      }
      throw error;
    }
  }, [snippetToEdit, createSnippetMutation, editSnippetMutation, addToast, logout, closeEditSnippetModal]);

  const openShareMenu = useCallback((snippet: Snippet) => {
    setSnippetToShare(snippet);
    setIsShareMenuOpen(true);
  }, []);

  const closeShareMenu = useCallback(() => {
    setSnippetToShare(null);
    setIsShareMenuOpen(false);
  }, []);

  const handleSettingsOpen = useCallback(() => setIsSettingsModalOpen(true), []);
  const handleNewSnippet = useCallback(() => openEditSnippetModal(null), [openEditSnippetModal]);

  return (
    <>
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text flex">
        <SidebarNav
          metadata={metadata}
          snippets={allSnippets}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          isDragging={isDragging}
          onDrop={handleDrop}
        />
        
        <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? "" : "ml-0"}`}>
          <div className="p-8">
            <div className="flex items-start justify-between mb-4">
              <StorageHeader isPublicView={false} />
              <UserDropdown />
            </div>

            <SearchAndFilter
              metadata={metadata}
              onSearchChange={handleSearchChange}
              onLanguageChange={handleLanguageChange}
              onCategoryToggle={handleCategoryToggle}
              onSortChange={handleSortChange}
              viewMode={viewMode}
              setViewMode={setViewMode}
              openSettingsModal={handleSettingsOpen}
              openNewSnippetModal={handleNewSnippet}
              showFavorites={showFavorites}
              handleShowFavorites={handleShowFavorites}
              hideNewSnippet={false}
              hideRecycleBin={false}
              isPublicView={false}
            />

            <SnippetContentArea
              includeCodeInSearch={includeCodeInSearch}
              showFavorites={showFavorites}
              viewMode={viewMode}
              compactView={compactView}
              showCodePreview={showCodePreview}
              previewLines={previewLines}
              showCategories={showCategories}
              expandCategories={expandCategories}
              showLineNumbers={showLineNumbers}
              isAuthenticated={isAuthenticated}
              onCategoryClick={handleCategoryToggle}
              onSnippetSelect={() => {}}
              onEdit={openEditSnippetModal}
              onShare={openShareMenu}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          </div>
        </div>
      </div>

      <EditSnippetModal
        isOpen={isEditSnippetModalOpen}
        onClose={closeEditSnippetModal}
        onSubmit={handleSnippetSubmit}
        snippetToEdit={snippetToEdit}
        showLineNumbers={showLineNumbers}
        allCategories={metadata.categories}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={{
          compactView,
          showCodePreview,
          previewLines,
          includeCodeInSearch,
          showCategories,
          expandCategories,
          showLineNumbers,
          theme,
          locale,
        }}
        onSettingsChange={updateSettings}
        isPublicView={false}
      />

      {snippetToShare && (
        <ShareMenu
          snippet={snippetToShare}
          isOpen={isShareMenuOpen}
          onClose={closeShareMenu}
        />
      )}
    </>
  );
};

export default BaseSnippetStorage;
