import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  X, 
  Code, 
  Tag, 
  Globe, 
  ChevronRight,
  FileCode,
  Copy,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Settings
} from 'lucide-react';
import { snippetService } from '../../service/snippetService';
import { searchActionRegistry } from '../../services/searchActionRegistry';
import { 
  SearchResultType, 
  SearchResult, 
  SearchResultSnippet,
  SearchResultAction,
  SearchResultCategory,
  SearchResultLanguage,
  HighlightedText,
  SnippetAction,
  GlobalAction
} from '../../types/search';
import type { Snippet } from '../../types/snippets';
import { useDebounce } from '../../hooks/useDebounce';
import { useSearch } from '../../contexts/SearchContext';
import { useToast } from '../../hooks/useToast';
import { ROUTES } from '../../constants/routes';
import { editSnippet, moveToRecycleBin } from '../../utils/api/snippets';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmationModal } from '../common/modals/ConfirmationModal';

interface GroupedResults {
  snippets: SearchResultSnippet[];
  actions: SearchResultAction[];
  categories: SearchResultCategory[];
  languages: SearchResultLanguage[];
  recentSnippets: SearchResultSnippet[];
}

const highlightMatch = (text: string, query: string): HighlightedText => {
  if (!query || query.trim() === '') {
    return { text, matches: [] };
  }
  
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  const matches: { start: number; end: number }[] = [];
  
  let startIndex = 0;
  while (startIndex < lowerText.length) {
    const foundIndex = lowerText.indexOf(lowerQuery, startIndex);
    if (foundIndex === -1) break;
    matches.push({ start: foundIndex, end: foundIndex + lowerQuery.length });
    startIndex = foundIndex + lowerQuery.length || 1;
  }
  
  return { text, matches };
};

const HighlightedTextComponent: React.FC<{ highlighted: HighlightedText }> = ({ highlighted }) => {
  const { text, matches } = highlighted;
  
  if (matches.length === 0) {
    return <span>{text}</span>;
  }
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (match.start > lastIndex) {
      parts.push(<span key={`text-${i}`}>{text.slice(lastIndex, match.start)}</span>);
    }
    parts.push(
      <span key={`highlight-${i}`} className="bg-yellow-200 dark:bg-yellow-900 rounded px-0.5">
        {text.slice(match.start, match.end)}
      </span>
    );
    lastIndex = match.end;
  }
  
  if (lastIndex < text.length) {
    parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
  }
  
  return <>{parts}</>;
};

const groupResults = (
  snippets: Snippet[],
  recentSnippets: Snippet[],
  categories: string[],
  languages: string[],
  globalActions: GlobalAction[]
): GroupedResults => {
  const snippetToResult = (snippet: Snippet): SearchResultSnippet => ({
    type: SearchResultType.SNIPPET,
    id: `snippet-${snippet.id}`,
    title: snippet.title,
    subtitle: snippet.description,
    snippet,
  });

  const categoryToResult = (category: string): SearchResultCategory => ({
    type: SearchResultType.CATEGORY,
    id: `category-${category}`,
    title: category,
    category,
  });

  const languageToResult = (language: string): SearchResultLanguage => ({
    type: SearchResultType.LANGUAGE,
    id: `language-${language}`,
    title: language,
    language,
  });

  const actionToResult = (action: GlobalAction): SearchResultAction => ({
    type: SearchResultType.ACTION,
    id: `action-${action.id}`,
    title: action.title,
    icon: action.icon,
    actionId: action.id,
  });

  return {
    snippets: snippets.map(s => snippetToResult(s)),
    recentSnippets: recentSnippets.map(s => snippetToResult(s)),
    categories: categories.map(categoryToResult),
    languages: languages.map(languageToResult),
    actions: globalActions.map(actionToResult),
  };
};

export const GlobalCommandPalette: React.FC = () => {
  const { isOpen, closeSearch } = useSearch();
  const { t } = useTranslation('components/search');
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [snippetActionIndex, setSnippetActionIndex] = useState(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [snippetToDelete, setSnippetToDelete] = useState<Snippet | null>(null);
  
  const debouncedQuery = useDebounce(query, 200);
  
  const { data: searchData, isLoading } = useQuery({
    queryKey: ['globalSearch', debouncedQuery],
    queryFn: async () => {
      return snippetService.globalSearch({
        query: debouncedQuery,
        limit: 20,
        includeRecent: true,
        includeCategories: true,
        includeLanguages: true,
      });
    },
    enabled: isOpen,
    staleTime: 5000,
  });

  const getDefaultGlobalActions = useCallback((): GlobalAction[] => {
    return [
      {
        id: 'new-snippet',
        title: t('commandPalette.actions.newSnippet'),
        icon: <Plus size={18} />,
        keywords: ['create', 'add', 'new'],
        section: 'actions',
        execute: () => {
          closeSearch();
          navigate(ROUTES.HOME);
          addToast(t('commandPalette.toast.navigateToCreate'), 'info');
        },
      },
      {
        id: 'settings',
        title: t('commandPalette.actions.settings'),
        icon: <Settings size={18} />,
        keywords: ['preferences', 'config'],
        section: 'actions',
        execute: () => {
          closeSearch();
          navigate(ROUTES.HOME);
          addToast(t('commandPalette.toast.navigateToSettings'), 'info');
        },
      },
      {
        id: 'go-home',
        title: t('commandPalette.actions.goHome'),
        icon: <Code size={18} />,
        keywords: ['home', 'main', 'snippets'],
        section: 'actions',
        execute: () => {
          closeSearch();
          navigate(ROUTES.HOME);
        },
      },
      {
        id: 'go-public',
        title: t('commandPalette.actions.goPublic'),
        icon: <Globe size={18} />,
        keywords: ['public', 'shared', 'browse'],
        section: 'actions',
        execute: () => {
          closeSearch();
          navigate(ROUTES.PUBLIC_SNIPPETS);
        },
      },
      {
        id: 'go-recycle',
        title: t('commandPalette.actions.goRecycle'),
        icon: <Trash2 size={18} />,
        keywords: ['recycle', 'bin', 'trash', 'deleted'],
        section: 'actions',
        execute: () => {
          closeSearch();
          navigate(ROUTES.RECYCLE);
        },
      },
    ];
  }, [t, closeSearch, navigate, addToast]);

  const getSnippetActions = useCallback((): SnippetAction[] => {
    if (!selectedSnippet) return [];
    
    return [
      {
        id: 'view',
        title: t('commandPalette.snippetActions.view'),
        icon: <FileCode size={18} />,
        execute: (snippet) => {
          closeSearch();
          navigate(`${ROUTES.SNIPPETS}/${snippet.id}`);
        },
      },
      {
        id: 'copy',
        title: t('commandPalette.snippetActions.copy'),
        icon: <Copy size={18} />,
        execute: async (snippet) => {
          try {
            const allCode = snippet.fragments.map(f => f.code).join('\n\n');
            await navigator.clipboard.writeText(allCode);
            addToast(t('commandPalette.toast.copied'), 'success');
          } catch (error) {
            console.error('Failed to copy snippet:', error);
            addToast(t('commandPalette.toast.copyFailed'), 'error');
          }
        },
      },
      {
        id: 'edit',
        title: t('commandPalette.snippetActions.edit'),
        icon: <Pencil size={18} />,
        execute: (snippet) => {
          closeSearch();
          navigate(ROUTES.HOME);
          addToast(t('commandPalette.toast.navigateToEdit', { title: snippet.title }), 'info');
        },
      },
      {
        id: 'toggle-public',
        title: selectedSnippet.is_public ? t('commandPalette.snippetActions.makePrivate') : t('commandPalette.snippetActions.makePublic'),
        icon: selectedSnippet.is_public ? <EyeOff size={18} /> : <Eye size={18} />,
        execute: async (snippet) => {
          try {
            const updated = await editSnippet(snippet.id, {
              ...snippet,
              is_public: snippet.is_public ? 0 : 1,
            });
            addToast(
              snippet.is_public 
                ? t('commandPalette.toast.madePrivate') 
                : t('commandPalette.toast.madePublic'),
              'success'
            );
            setSelectedSnippet(updated);
          } catch (error) {
            console.error('Failed to toggle public status:', error);
            addToast(t('commandPalette.toast.toggleFailed'), 'error');
          }
        },
      },
      {
        id: 'delete',
        title: t('commandPalette.snippetActions.delete'),
        icon: <Trash2 size={18} />,
        execute: (snippet) => {
          setSnippetToDelete(snippet);
          setIsDeleteModalOpen(true);
        },
      },
    ];
  }, [selectedSnippet, t, closeSearch, navigate, addToast]);

  const groupedResults = React.useMemo(() => {
    if (!searchData) {
      return { snippets: [], recentSnippets: [], categories: [], languages: [], actions: [] };
    }
    
    const globalActions = getDefaultGlobalActions();
    const filteredActions = query 
      ? searchActionRegistry.searchGlobalActions(query)
      : [];
    
    const allGlobalActions = [...globalActions, ...filteredActions.filter(a => !globalActions.find(ga => ga.id === a.id))];
    
    return groupResults(
      searchData.snippets,
      searchData.recentSnippets,
      searchData.categories,
      searchData.languages,
      allGlobalActions
    );
  }, [searchData, query, getDefaultGlobalActions]);

  const flatResults = React.useMemo((): SearchResult[] => {
    if (selectedSnippet) {
      return [];
    }
    
    const results: SearchResult[] = [];
    
    if (!query) {
      results.push(...groupedResults.recentSnippets);
      results.push(...groupedResults.actions);
    } else {
      results.push(...groupedResults.snippets);
      results.push(...groupedResults.actions);
      results.push(...groupedResults.categories);
      results.push(...groupedResults.languages);
    }
    
    return results;
  }, [groupedResults, query, selectedSnippet]);

  const snippetActions = React.useMemo(() => getSnippetActions(), [getSnippetActions]);

  useEffect(() => {
    setSelectedIndex(0);
    setSnippetActionIndex(0);
  }, [flatResults.length, snippetActions.length, selectedSnippet]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSelectedSnippet(null);
      setSnippetActionIndex(0);
    }
  }, [isOpen]);

  const handleNavigateToCategory = useCallback((category: string) => {
    closeSearch();
    navigate(ROUTES.HOME);
    setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const existingCategories = next.get('categories')?.split(',').filter(Boolean) || [];
        if (!existingCategories.includes(category)) {
          existingCategories.push(category);
          next.set('categories', existingCategories.join(','));
        }
        return next;
      });
    }, 100);
  }, [closeSearch, navigate, setSearchParams]);

  const handleNavigateToLanguage = useCallback((language: string) => {
    closeSearch();
    navigate(ROUTES.HOME);
    setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('language', language);
        return next;
      });
    }, 100);
  }, [closeSearch, navigate, setSearchParams]);

  const handleConfirmDelete = useCallback(async () => {
    if (!snippetToDelete) return;
    
    try {
      await moveToRecycleBin(snippetToDelete.id);
      addToast(t('commandPalette.toast.deleted'), 'success');
      closeSearch();
    } catch (error) {
      console.error('Failed to delete snippet:', error);
      addToast(t('commandPalette.toast.deleteFailed'), 'error');
    } finally {
      setIsDeleteModalOpen(false);
      setSnippetToDelete(null);
    }
  }, [snippetToDelete, addToast, closeSearch, t]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (selectedSnippet) {
      const actionCount = snippetActions.length;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSnippetActionIndex(prev => (prev + 1) % actionCount);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSnippetActionIndex(prev => (prev - 1 + actionCount) % actionCount);
          break;
        case 'Enter':
          e.preventDefault();
          if (snippetActions[snippetActionIndex] && selectedSnippet) {
            snippetActions[snippetActionIndex].execute(selectedSnippet);
          }
          break;
        case 'Escape':
        case 'ArrowLeft':
          e.preventDefault();
          setSelectedSnippet(null);
          setSnippetActionIndex(0);
          break;
        case 'Tab':
          e.preventDefault();
          break;
      }
    } else {
      const resultCount = flatResults.length;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % resultCount);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + resultCount) % resultCount);
          break;
        case 'Enter':
          e.preventDefault();
          const selected = flatResults[selectedIndex];
          if (selected) {
            executeResult(selected);
          }
          break;
        case 'Escape':
          e.preventDefault();
          closeSearch();
          break;
        case 'Tab':
          e.preventDefault();
          const tabSelected = flatResults[selectedIndex];
          if (tabSelected && tabSelected.type === SearchResultType.SNIPPET) {
            setSelectedSnippet(tabSelected.snippet);
            setSnippetActionIndex(0);
          }
          break;
      }
    }
  }, [selectedSnippet, snippetActions, snippetActionIndex, flatResults, selectedIndex, closeSearch]);

  const executeResult = (result: SearchResult) => {
    switch (result.type) {
      case SearchResultType.SNIPPET:
        closeSearch();
        navigate(`${ROUTES.SNIPPETS}/${result.snippet.id}`);
        break;
      case SearchResultType.ACTION:
        closeSearch();
        const action = searchActionRegistry.getGlobalAction(result.actionId);
        if (action) {
          action.execute();
        } else {
          const defaultActions = getDefaultGlobalActions();
          const defaultAction = defaultActions.find(a => a.id === result.actionId);
          defaultAction?.execute();
        }
        break;
      case SearchResultType.CATEGORY:
        handleNavigateToCategory(result.category);
        break;
      case SearchResultType.LANGUAGE:
        handleNavigateToLanguage(result.language);
        break;
    }
  };

  const getSectionHeader = (type: SearchResultType, isRecent = false) => {
    if (isRecent) {
      return (
        <div className="px-3 py-2 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
          {t('commandPalette.sections.recent')}
        </div>
      );
    }
    
    switch (type) {
      case SearchResultType.SNIPPET:
        return (
          <div className="px-3 py-2 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
            {t('commandPalette.sections.snippets')}
          </div>
        );
      case SearchResultType.ACTION:
        return (
          <div className="px-3 py-2 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
            {t('commandPalette.sections.actions')}
          </div>
        );
      case SearchResultType.CATEGORY:
        return (
          <div className="px-3 py-2 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
            {t('commandPalette.sections.categories')}
          </div>
        );
      case SearchResultType.LANGUAGE:
        return (
          <div className="px-3 py-2 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
            {t('commandPalette.sections.languages')}
          </div>
        );
      default:
        return null;
    }
  };

  const getItemIcon = (result: SearchResult) => {
    switch (result.type) {
      case SearchResultType.SNIPPET:
        return <Code size={18} className="text-light-primary dark:text-dark-primary" />;
      case SearchResultType.ACTION:
        return result.icon || <Settings size={18} />;
      case SearchResultType.CATEGORY:
        return <Tag size={18} className="text-light-primary dark:text-dark-primary" />;
      case SearchResultType.LANGUAGE:
        return <Globe size={18} className="text-light-primary dark:text-dark-primary" />;
      default:
        return null;
    }
  };

  const renderResultItem = (result: SearchResult, _index: number, isSelected: boolean) => {
    return (
      <div
        key={result.id}
        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md transition-colors
          ${isSelected 
            ? 'bg-light-hover dark:bg-dark-hover' 
            : 'hover:bg-light-surface dark:hover:bg-dark-surface'}`}
        onClick={() => executeResult(result)}
      >
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-light-surface dark:bg-dark-surface">
          {getItemIcon(result)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium text-light-text dark:text-dark-text truncate">
              <HighlightedTextComponent highlighted={highlightMatch(result.title, query)} />
            </div>
          </div>
          {result.subtitle && (
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">
              <HighlightedTextComponent highlighted={highlightMatch(result.subtitle, query)} />
            </div>
          )}
          {result.type === SearchResultType.SNIPPET && result.snippet.categories.length > 0 && (
            <div className="flex gap-1 mt-1">
              {result.snippet.categories.slice(0, 3).map((cat, i) => (
                <span 
                  key={i} 
                  className="inline-block px-1.5 py-0.5 rounded-full text-xs bg-light-primary/20 dark:bg-dark-primary/20 text-light-primary dark:text-dark-primary"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
        {result.type === SearchResultType.SNIPPET && (
          <div className="flex-shrink-0 text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
            <span className="hidden sm:inline">Tab</span>
            <ChevronRight size={14} />
          </div>
        )}
      </div>
    );
  };

  const renderSnippetActionItem = (action: SnippetAction, _index: number, isSelected: boolean) => {
    return (
      <div
        key={action.id}
        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md transition-colors
          ${isSelected 
            ? 'bg-light-hover dark:bg-dark-hover' 
            : 'hover:bg-light-surface dark:hover:bg-dark-surface'}`}
        onClick={() => {
          if (selectedSnippet) {
            action.execute(selectedSnippet);
          }
        }}
      >
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-light-surface dark:bg-dark-surface">
          {action.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-light-text dark:text-dark-text">
            {action.title}
          </div>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (selectedSnippet) {
      return (
        <div className="py-2">
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => {
                  setSelectedSnippet(null);
                  setSnippetActionIndex(0);
                }}
                className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text flex items-center gap-1"
              >
                <ChevronRight size={14} className="rotate-180" />
                {t('commandPalette.back')}
              </button>
            </div>
            <div className="flex items-center gap-3 p-3 bg-light-surface dark:bg-dark-surface rounded-lg mb-2">
              <div className="w-10 h-10 flex items-center justify-center rounded-md bg-light-primary dark:bg-dark-primary">
                <Code size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-light-text dark:text-dark-text truncate">
                  {selectedSnippet.title}
                </div>
                {selectedSnippet.description && (
                  <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">
                    {selectedSnippet.description}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="px-3 py-2 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
            {t('commandPalette.sections.actions')}
          </div>
          {snippetActions.map((action, index) => 
            renderSnippetActionItem(action, index, index === snippetActionIndex)
          )}
        </div>
      );
    }

    if (isLoading && !searchData) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-light-primary dark:border-dark-primary"></div>
        </div>
      );
    }

    if (flatResults.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
          <Search size={32} className="mb-2 opacity-50" />
          <p>{t('commandPalette.noResults')}</p>
        </div>
      );
    }

    const elements: React.ReactNode[] = [];
    let resultIndex = 0;

    if (!query) {
      if (groupedResults.recentSnippets.length > 0) {
        elements.push(
          <React.Fragment key="header-recent">
            {getSectionHeader(SearchResultType.SNIPPET, true)}
          </React.Fragment>
        );
        groupedResults.recentSnippets.forEach((result) => {
          elements.push(
            <React.Fragment key={result.id}>
              {renderResultItem(result, resultIndex++, resultIndex - 1 === selectedIndex)}
            </React.Fragment>
          );
        });
      }
      if (groupedResults.actions.length > 0) {
        elements.push(
          <React.Fragment key="header-actions">
            {getSectionHeader(SearchResultType.ACTION)}
          </React.Fragment>
        );
        groupedResults.actions.forEach((result) => {
          elements.push(
            <React.Fragment key={result.id}>
              {renderResultItem(result, resultIndex++, resultIndex - 1 === selectedIndex)}
            </React.Fragment>
          );
        });
      }
    } else {
      if (groupedResults.snippets.length > 0) {
        elements.push(
          <React.Fragment key="header-snippets">
            {getSectionHeader(SearchResultType.SNIPPET)}
          </React.Fragment>
        );
        groupedResults.snippets.forEach((result) => {
          elements.push(
            <React.Fragment key={result.id}>
              {renderResultItem(result, resultIndex++, resultIndex - 1 === selectedIndex)}
            </React.Fragment>
          );
        });
      }
      if (groupedResults.actions.length > 0) {
        elements.push(
          <React.Fragment key="header-actions">
            {getSectionHeader(SearchResultType.ACTION)}
          </React.Fragment>
        );
        groupedResults.actions.forEach((result) => {
          elements.push(
            <React.Fragment key={result.id}>
              {renderResultItem(result, resultIndex++, resultIndex - 1 === selectedIndex)}
            </React.Fragment>
          );
        });
      }
      if (groupedResults.categories.length > 0) {
        elements.push(
          <React.Fragment key="header-categories">
            {getSectionHeader(SearchResultType.CATEGORY)}
          </React.Fragment>
        );
        groupedResults.categories.forEach((result) => {
          elements.push(
            <React.Fragment key={result.id}>
              {renderResultItem(result, resultIndex++, resultIndex - 1 === selectedIndex)}
            </React.Fragment>
          );
        });
      }
      if (groupedResults.languages.length > 0) {
        elements.push(
          <React.Fragment key="header-languages">
            {getSectionHeader(SearchResultType.LANGUAGE)}
          </React.Fragment>
        );
        groupedResults.languages.forEach((result) => {
          elements.push(
            <React.Fragment key={result.id}>
              {renderResultItem(result, resultIndex++, resultIndex - 1 === selectedIndex)}
            </React.Fragment>
          );
        });
      }
    }

    return <div className="py-2">{elements}</div>;
  };

  if (!isOpen) return (
    <>
      {isDeleteModalOpen && snippetToDelete && (
        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSnippetToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title={t('commandPalette.confirmDelete.title')}
          message={t('commandPalette.confirmDelete.message', { title: snippetToDelete?.title || '' })}
          variant="danger"
        />
      )}
    </>
  );

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24"
          onClick={closeSearch}
        >
          <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-xl mx-4 bg-light-surface dark:bg-dark-surface rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-light-border dark:border-dark-border">
              <Search size={20} className="text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('commandPalette.placeholder')}
                className="flex-1 bg-transparent text-light-text dark:text-dark-text placeholder-light-text-secondary placeholder:dark:placeholder-dark-text-secondary outline-none text-lg"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 rounded hover:bg-light-hover dark:hover:bg-dark-hover"
                >
                  <X size={16} className="text-light-text-secondary dark:text-dark-text-secondary" />
                </button>
              )}
            </div>

            <div
              ref={listRef}
              className="max-h-96 overflow-y-auto"
            >
              {renderResults()}
            </div>

            <div className="px-3 py-2 border-t border-light-border dark:border-dark-border bg-light-surface-secondary dark:bg-dark-surface-secondary">
              <div className="flex items-center gap-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-light-border dark:bg-dark-border rounded text-xs">
                    ↓↑
                  </kbd>
                  <span>{t('commandPalette.hints.navigate')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-light-border dark:bg-dark-border rounded text-xs">
                    Enter
                  </kbd>
                  <span>{t('commandPalette.hints.execute')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-light-border dark:bg-dark-border rounded text-xs">
                    Tab
                  </kbd>
                  <span>{t('commandPalette.hints.snippetMenu')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-light-border dark:bg-dark-border rounded text-xs">
                    Esc
                  </kbd>
                  <span>{t('commandPalette.hints.close')}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      
      {isDeleteModalOpen && snippetToDelete && (
        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSnippetToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title={t('commandPalette.confirmDelete.title')}
          message={t('commandPalette.confirmDelete.message', { title: snippetToDelete?.title || '' })}
          variant="danger"
        />
      )}
    </>
  );
};
