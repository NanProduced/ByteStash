import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { initializeMonaco } from "../../../../utils/language/languageUtils";
import { useAuth } from "../../../../hooks/useAuth";
import { useSettings } from "../../../../hooks/useSettings";
import { useCreateSnippet, useEditSnippet, snippetKeys } from "../../../../hooks/useSnippetsQuery";
import { useToast } from "../../../../hooks/useToast";
import { useSearch } from "../../../../contexts/SearchContext";
import { SearchAndFilter } from "../../../search/SearchAndFilter";
import { snippetService } from "../../../../service/snippetService";
import { editSnippet, moveToRecycleBin } from "../../../../utils/api/snippets";
import { Snippet } from "../../../../types/snippets";
import SettingsModal from "../../../settings/SettingsModal";
import { UserDropdown } from "../../../auth/UserDropdown";
import EditSnippetModal from "../../edit/EditSnippetModal";
import { ShareMenu } from "../../share/ShareMenu";
import SnippetContentArea from "./SnippetContentArea";
import StorageHeader from "./StorageHeader";
import { ConfirmationModal } from "../../../common/modals/ConfirmationModal";
import { CommandPalette } from "../../../search/CommandPalette";

const BaseSnippetStorage: React.FC = () => {
  const { t: translate } = useTranslation('components/snippets/view/common');
  const { t: searchTranslate } = useTranslation('components/search');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { isAuthenticated, logout } = useAuth();
  const queryClient = useQueryClient();
  const { isOpen, closeSearch } = useSearch();
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

  const [metadata, setMetadata] = useState<{ categories: string[]; languages: string[] }>({
    categories: [],
    languages: []
  });

  const [isEditSnippetModalOpen, setIsEditSnippetModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [snippetToEdit, setSnippetToEdit] = useState<Snippet | null>(null);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [snippetToShare, setSnippetToShare] = useState<Snippet | null>(null);

  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [snippetToDelete, setSnippetToDelete] = useState<Snippet | null>(null);

  const mountedRef = useRef(false);

  const createSnippetMutation = useCreateSnippet();
  const editSnippetMutation = useEditSnippet();

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

  const handleOpenDeleteConfirmation = useCallback((snippet: Snippet) => {
    setSnippetToDelete(snippet);
    setIsDeleteConfirmationOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!snippetToDelete) return;
    
    try {
      await moveToRecycleBin(snippetToDelete.id);
      queryClient.invalidateQueries({ queryKey: snippetKeys.lists() });
      addToast(searchTranslate('commandPalette.toast.deleted'), "success");
    } catch (error) {
      console.error("Failed to delete snippet:", error);
      addToast(searchTranslate('commandPalette.toast.deleteFailed'), "error");
    } finally {
      setIsDeleteConfirmationOpen(false);
      setSnippetToDelete(null);
    }
  }, [snippetToDelete, queryClient, addToast, searchTranslate]);

  const handleNavigateToSnippet = useCallback((snippetId: string) => {
    closeSearch();
    navigate(`/snippets/${snippetId}`);
  }, [navigate, closeSearch]);

  const handleNavigateToCategory = useCallback((category: string) => {
    closeSearch();
    const params = new URLSearchParams(searchParams);
    const existingCategories = params.get('categories')?.split(',').filter(Boolean) || [];
    if (!existingCategories.includes(category)) {
      existingCategories.push(category);
      params.set('categories', existingCategories.join(','));
      setSearchParams(params);
    }
  }, [searchParams, setSearchParams, closeSearch]);

  const handleNavigateToLanguage = useCallback((language: string) => {
    closeSearch();
    const params = new URLSearchParams(searchParams);
    params.set('language', language);
    setSearchParams(params);
  }, [searchParams, setSearchParams, closeSearch]);

  const handleCopySnippet = useCallback(async (snippet: Snippet) => {
    try {
      const allCode = snippet.fragments.map(f => f.code).join('\n\n');
      await navigator.clipboard.writeText(allCode);
      addToast(searchTranslate('commandPalette.toast.copied'), 'success');
    } catch (error) {
      console.error('Failed to copy snippet:', error);
      addToast(searchTranslate('commandPalette.toast.copyFailed'), 'error');
    }
  }, [addToast, searchTranslate]);

  const handleEditSnippet = useCallback((snippet: Snippet) => {
    closeSearch();
    setSnippetToEdit(snippet);
    setIsEditSnippetModalOpen(true);
  }, [closeSearch]);

  const handleTogglePublic = useCallback(async (snippet: Snippet) => {
    try {
      const updated = await editSnippet(snippet.id, {
        ...snippet,
        is_public: snippet.is_public ? 0 : 1,
      });
      queryClient.setQueriesData({ queryKey: snippetKeys.lists() }, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: page.data.map((s: Snippet) => 
              s.id === snippet.id ? updated : s
            ),
          })),
        };
      });
      addToast(
        snippet.is_public 
          ? searchTranslate('commandPalette.toast.madePrivate') 
          : searchTranslate('commandPalette.toast.madePublic'),
        'success'
      );
    } catch (error) {
      console.error('Failed to toggle public status:', error);
      addToast(searchTranslate('commandPalette.toast.toggleFailed'), 'error');
    }
  }, [queryClient, addToast, searchTranslate]);

  const handleDeleteSnippet = useCallback((snippet: Snippet) => {
    handleOpenDeleteConfirmation(snippet);
  }, [handleOpenDeleteConfirmation]);

  return (
    <>
      <div className="min-h-screen p-8 bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
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
        />
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

      <ConfirmationModal
        isOpen={isDeleteConfirmationOpen}
        onClose={() => {
          setIsDeleteConfirmationOpen(false);
          setSnippetToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={searchTranslate('commandPalette.confirmDelete.title')}
        message={searchTranslate('commandPalette.confirmDelete.message', { title: snippetToDelete?.title || '' })}
        variant="danger"
      />

      <CommandPalette
        isOpen={isOpen}
        onClose={closeSearch}
        onNavigateToSnippet={handleNavigateToSnippet}
        onNavigateToCategory={handleNavigateToCategory}
        onNavigateToLanguage={handleNavigateToLanguage}
        onOpenNewSnippet={handleNewSnippet}
        onOpenSettings={handleSettingsOpen}
        onCopySnippet={handleCopySnippet}
        onEditSnippet={handleEditSnippet}
        onTogglePublic={handleTogglePublic}
        onDeleteSnippet={handleDeleteSnippet}
      />
    </>
  );
};

export default BaseSnippetStorage;
