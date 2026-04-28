import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Clock, PanelLeftClose, PanelLeftOpen, Search, ListFilter, Check, History, RotateCcw, Eye, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import MarkdownRenderer from "../../common/markdown/MarkdownRenderer";
import { useTranslation } from "react-i18next";
import { Snippet, SnippetVersion } from "../../../types/snippets";
import CategoryList from "../../categories/CategoryList";
import {
  getLanguageLabel,
  getUniqueLanguages,
  getFullFileName,
  getFileIcon,
} from "../../../utils/language/languageUtils";
import { FullCodeBlock } from "../../editor/FullCodeBlock";
import DownloadButton from "../../common/buttons/DownloadButton";
import DownloadArchiveButton from "../../common/buttons/DownloadArchiveButton";
import { IconButton } from "../../common/buttons/IconButton";
import VersionHistoryDrawer from "../version/VersionHistoryDrawer";
import VersionDiffModal from "../version/VersionDiffModal";
import { getSnippetVersions, getSnippetVersionById, rollbackToVersion } from "../../../utils/api/snippets";
import { useToast } from "../../../hooks/useToast";
import { ConfirmationModal } from "../../common/modals/ConfirmationModal";
import { useAuth } from "../../../hooks/useAuth";
import { EVENTS } from "../../../constants/events";

interface FullCodeViewProps {
  showTitle?: boolean;
  snippet: Snippet;
  onCategoryClick?: (category: string) => void;
  showLineNumbers?: boolean;
  className?: string;
  isModal?: boolean;
  isPublicView?: boolean;
  onSnippetUpdate?: (snippet: Snippet) => void;
}

export const FullCodeView: React.FC<FullCodeViewProps> = ({
  showTitle = true,
  snippet,
  onCategoryClick,
  showLineNumbers = true,
  className = "",
  isModal = false,
  isPublicView = false,
  onSnippetUpdate,
}) => {
  const { t } = useTranslation();
  const { t: translate } = useTranslation('components/snippets/view/all');
  const { isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [activeFragmentIndex, setActiveFragmentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenExtensions, setHiddenExtensions] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<SnippetVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [diffOldVersion, setDiffOldVersion] = useState<SnippetVersion | null>(null);
  const [diffNewVersion, setDiffNewVersion] = useState<SnippetVersion | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<SnippetVersion | null>(null);
  const [isRollbackConfirmOpen, setIsRollbackConfirmOpen] = useState(false);
  const [versionToRollback, setVersionToRollback] = useState<SnippetVersion | null>(null);

  const loadVersions = useCallback(async () => {
    if (!isAuthenticated || isPublicView) return;
    
    setIsLoadingVersions(true);
    try {
      const result = await getSnippetVersions(snippet.id);
      setVersions(result);
    } catch (error) {
      console.error("Error loading versions:", error);
      setVersions([]);
    } finally {
      setIsLoadingVersions(false);
    }
  }, [snippet.id, isAuthenticated, isPublicView]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleSnippetUpdated = () => {
      if (isVersionHistoryOpen) {
        loadVersions();
      }
    };
    window.addEventListener(EVENTS.SNIPPET_UPDATED, handleSnippetUpdated);
    return () => window.removeEventListener(EVENTS.SNIPPET_UPDATED, handleSnippetUpdated);
  }, [isVersionHistoryOpen, loadVersions]);

  const handleOpenVersionHistory = useCallback(() => {
    loadVersions();
    setIsVersionHistoryOpen(true);
  }, [loadVersions]);

  const handleCompareVersions = useCallback(async (versionId1: string, versionId2: string) => {
    try {
      const [v1, v2] = await Promise.all([
        getSnippetVersionById(snippet.id, versionId1),
        getSnippetVersionById(snippet.id, versionId2),
      ]);
      setDiffOldVersion(v1);
      setDiffNewVersion(v2);
      setIsDiffModalOpen(true);
      setIsVersionHistoryOpen(false);
    } catch (error) {
      console.error("Error loading versions for compare:", error);
      addToast(translate('versionView.rollbackError'), "error");
    }
  }, [snippet.id, addToast, translate]);

  const handleViewVersion = useCallback((version: SnippetVersion) => {
    setViewingVersion(version);
    setIsVersionHistoryOpen(false);
  }, []);

  const handleCloseViewVersion = useCallback(() => {
    setViewingVersion(null);
  }, []);

  const handleRollbackClick = useCallback((version: SnippetVersion) => {
    setVersionToRollback(version);
    setIsRollbackConfirmOpen(true);
    setIsVersionHistoryOpen(false);
  }, []);

  const handleConfirmRollback = useCallback(async () => {
    if (!versionToRollback) return;

    try {
      const updatedSnippet = await rollbackToVersion(snippet.id, versionToRollback.id);
      addToast(translate('versionView.rollbackSuccess'), "success");
      setIsRollbackConfirmOpen(false);
      setVersionToRollback(null);
      setViewingVersion(null);
      if (onSnippetUpdate) {
        onSnippetUpdate(updatedSnippet);
      }
    } catch (error) {
      console.error("Error rolling back version:", error);
      addToast(translate('versionView.rollbackError'), "error");
    }
  }, [versionToRollback, snippet.id, addToast, translate, onSnippetUpdate]);

  const extensionStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let noExtCount = 0;
    const fragments = viewingVersion ? viewingVersion.fragments : snippet.fragments;
    fragments.forEach((f) => {
      const fullName = getFullFileName(f.file_name, f.language);
      if (fullName.includes('.')) {
        const ext = '.' + fullName.split('.').pop()?.toLowerCase();
        counts[ext] = (counts[ext] || 0) + 1;
      } else {
        noExtCount++;
      }
    });
    const result = Object.entries(counts).map(([ext, count]) => ({ ext, count })).sort((a, b) => a.ext.localeCompare(b.ext));
    if (noExtCount > 0) {
      result.push({ ext: '__no_ext__', count: noExtCount });
    }
    return result;
  }, [snippet.fragments, viewingVersion]);

  const toggleExtension = (ext: string) => {
    setHiddenExtensions(prev => {
      const next = new Set(prev);
      if (next.has(ext)) {
        next.delete(ext);
      } else {
        next.add(ext);
      }
      return next;
    });
  };

  const filteredFragments = useMemo(() => {
    const fragments = viewingVersion ? viewingVersion.fragments : snippet.fragments;
    return fragments.filter((f) => {
      const fullName = getFullFileName(f.file_name, f.language).toLowerCase();
      const matchesSearch = !searchQuery.trim() || fullName.includes(searchQuery.toLowerCase());
      
      let ext = '__no_ext__';
      if (fullName.includes('.')) {
        ext = '.' + fullName.split('.').pop()?.toLowerCase();
      }
      const matchesExt = !hiddenExtensions.has(ext);
      return matchesSearch && matchesExt;
    });
  }, [snippet.fragments, viewingVersion, searchQuery, hiddenExtensions]);

  const handleCategoryClick = (e: React.MouseEvent, category: string) => {
    e.preventDefault();
    onCategoryClick?.(category);
  };

  const getRelativeUpdateTime = (updatedAt: string): string => {
    const defaultUpdateTime = translate('defaultUpdateTime');

    try {
      if (!updatedAt) {
        return defaultUpdateTime;
      }
      const updateDate = new Date(updatedAt);
      if (isNaN(updateDate.getTime())) {
        return defaultUpdateTime;
      }
      return formatDistanceToNow(updateDate);
    } catch (error) {
      console.error("Error formatting update date:", error);
      return defaultUpdateTime;
    }
  };

  const containerClasses = isModal
    ? `overflow-hidden ${className}`
    : `bg-light-surface dark:bg-dark-surface rounded-lg overflow-hidden ${className}`;

  const displaySnippet = viewingVersion || snippet;

  return (
    <div className={containerClasses}>
      {!isModal && snippet.updated_at && (
        <div className="bg-light-hover/50 dark:bg-dark-hover/50 px-3 py-1.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1 text-light-text-secondary dark:text-dark-text-secondary">
            {viewingVersion && (
              <div className="flex items-center gap-1 mr-3 px-2 py-0.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">
                <Eye size={12} />
                <span>{translate('versionView.subTitle', { versionNumber: viewingVersion.version_number, title: viewingVersion.title })}</span>
              </div>
            )}
            <Clock size={12} />
            <span>{translate('fullCodeView.dateTimeAgo', { dateTime: getRelativeUpdateTime(viewingVersion ? viewingVersion.created_at : snippet.updated_at) })}</span>
          </div>
          <div className="flex items-center gap-2">
            {viewingVersion && (
              <>
                <IconButton
                  icon={<RotateCcw size={14} />}
                  onClick={() => {
                    setVersionToRollback(viewingVersion);
                    setIsRollbackConfirmOpen(true);
                  }}
                  variant="secondary"
                  size="sm"
                  label={translate('versionHistory.rollback')}
                />
                <IconButton
                  icon={<X size={14} />}
                  onClick={handleCloseViewVersion}
                  variant="secondary"
                  size="sm"
                  label={t('action.close')}
                />
              </>
            )}
            {!isPublicView && isAuthenticated && !viewingVersion && (
              <IconButton
                icon={<History size={14} />}
                onClick={handleOpenVersionHistory}
                variant="secondary"
                size="sm"
                label={translate('versionHistory.title')}
              />
            )}
          </div>
        </div>
      )}

      <div className={isModal ? "p-2 pt-0" : "p-4 pt-0"}>
        <div>
          {showTitle && (
            <h1
              className={`text-xl md:text-2xl font-bold text-light-text dark:text-dark-text ${
                isModal ? "" : "mt-2"
              }`}
            >
              {displaySnippet.title}
            </h1>
          )}

          {getUniqueLanguages(displaySnippet.fragments) && (
            <div
              className={`flex items-center gap-1 text-sm text-light-text-secondary dark:text-dark-text-secondary mt-${
                showTitle ? "2" : "0"
              }`}
            >
              <div className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                {getFileIcon(displaySnippet.fragments[0]?.file_name || "", displaySnippet.fragments[0]?.language, "w-full h-full text-light-text-secondary dark:text-dark-text-secondary")}
              </div>
              <span>{getUniqueLanguages(displaySnippet.fragments)}</span>
            </div>
          )}

          <div className="mt-3 text-sm text-light-text dark:text-dark-text">
            <MarkdownRenderer className={`markdown prose dark:prose-invert max-w-none`}>
              {displaySnippet.description || translate('fullCodeView.defaultDescription')}
            </MarkdownRenderer>
          </div>

          <div className="mt-3">
            <CategoryList
              categories={displaySnippet.categories}
              onCategoryClick={handleCategoryClick}
              variant="clickable"
              showAll={true}
            />
          </div>
        </div>

        {displaySnippet.fragments.length > 1 && (
          <div className="flex justify-end mt-4">
            <DownloadArchiveButton
              snippetTitle={displaySnippet.title}
              fragments={displaySnippet.fragments}
              variant="secondary"
              size="sm"
            />
          </div>
        )}

        <div className="mt-4">
          {displaySnippet.fragments.length > 1 ? (
            <div className="flex flex-col md:flex-row border border-light-border dark:border-dark-border rounded-lg overflow-hidden bg-light-surface dark:bg-dark-surface shadow-sm">
              {isSidebarOpen && (
                <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-light-border dark:border-dark-border flex flex-col bg-light-bg/50 dark:bg-dark-bg/50 transition-all duration-300">
                  <div className="px-3 py-2 border-b border-light-border dark:border-dark-border flex flex-col gap-2 bg-light-hover/30 dark:bg-dark-hover/30">
                    <div className="flex items-center justify-between text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                      <span>{displaySnippet.fragments.length} {translate('files')}</span>
                      <button 
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1 hover:bg-light-hover dark:hover:bg-dark-hover rounded transition-colors"
                        title={translate('collapseSidebar')}
                      >
                        <PanelLeftClose size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
                        <input 
                          type="text" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={translate('searchFiles')}
                          className="w-full pl-6 pr-2 py-1 text-xs bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded focus:outline-none focus:border-light-primary dark:focus:border-dark-primary text-light-text dark:text-dark-text placeholder-light-text-secondary/50 dark:placeholder-dark-text-secondary/50"
                        />
                      </div>
                      {extensionStats.length > 0 && (
                        <div className="relative shrink-0" ref={filterRef}>
                          <button
                            type="button"
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`p-1 rounded border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover transition-colors flex items-center justify-center h-[26px] w-[26px] ${isFilterOpen ? 'bg-light-hover dark:bg-dark-hover' : 'bg-light-surface dark:bg-dark-surface'}`}
                            title={translate('filterFiles')}
                          >
                            <ListFilter size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
                          </button>

                          {isFilterOpen && (
                            <div className="absolute left-0 left-auto md:left-full md:ml-1 md:-mt-8 right-0 md:right-auto top-full mt-1 w-56 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg shadow-xl z-50 py-2 flex flex-col">
                              <div className="px-3 pb-2 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary border-b border-light-border dark:border-dark-border mb-1">
                                {translate('fileExtensions')}
                              </div>
                              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                {extensionStats.map(({ ext, count }) => {
                                  const checked = !hiddenExtensions.has(ext);
                                  return (
                                    <button
                                      type="button"
                                      key={ext}
                                      onClick={() => toggleExtension(ext)}
                                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-light-hover dark:hover:bg-dark-hover text-sm text-light-text dark:text-dark-text transition-colors group"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                          <Check size={14} className={`transition-opacity ${checked ? 'opacity-100 text-light-primary dark:text-dark-primary' : 'opacity-0'}`} />
                                        </div>
                                        <span className="truncate max-w-[130px] text-left">{ext === '__no_ext__' ? translate('noExtension') : ext}</span>
                                      </div>
                                      <span className="text-xs bg-light-bg dark:bg-dark-bg px-1.5 py-0.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary group-hover:bg-light-surface dark:group-hover:bg-dark-surface">
                                        {count}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-[500px]">
                    {filteredFragments.map((fragment) => {
                      const originalIndex = displaySnippet.fragments.findIndex(f => f.id === fragment.id);
                      const displayIndex = originalIndex >= 0 ? originalIndex : displaySnippet.fragments.indexOf(fragment);
                      return (
                        <button
                          key={fragment.id || displayIndex}
                          onClick={() => setActiveFragmentIndex(displayIndex)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                            activeFragmentIndex === displayIndex
                              ? "bg-light-hover dark:bg-dark-hover text-light-text dark:text-dark-text border-l-2 border-light-primary dark:border-dark-primary"
                              : "text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover/50 dark:hover:bg-dark-hover/50 border-l-2 border-transparent"
                          }`}
                        >
                          <div className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                            {getFileIcon(fragment.file_name, fragment.language, "w-full h-full text-light-text-secondary dark:text-dark-text-secondary")}
                          </div>
                          <span className="truncate">{getFullFileName(fragment.file_name, fragment.language)}</span>
                        </button>
                      );
                    })}
                    {filteredFragments.length === 0 && (
                      <div className="px-3 py-4 text-xs text-center text-light-text-secondary dark:text-dark-text-secondary">
                        {translate('noFilesFound')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 min-w-0 bg-light-bg dark:bg-dark-bg">
                {(() => {
                  const fragment = displaySnippet.fragments[activeFragmentIndex] || displaySnippet.fragments[0];
                  return (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between px-3 h-10 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shrink-0">
                        <div className="flex items-center flex-1 min-w-0 gap-2">
                          {!isSidebarOpen && (
                            <button
                              onClick={() => setIsSidebarOpen(true)}
                              className="p-1.5 -ml-1.5 mr-1 hover:bg-light-hover dark:hover:bg-dark-hover rounded transition-colors text-light-text-secondary dark:text-dark-text-secondary flex items-center justify-center"
                              title={translate('expandSidebar')}
                            >
                              <PanelLeftOpen size={16} />
                            </button>
                          )}
                          <div className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                            {getFileIcon(fragment.file_name, fragment.language, "w-full h-full text-light-text-secondary dark:text-dark-text-secondary")}
                          </div>
                          <span className="truncate font-medium text-sm text-light-text dark:text-dark-text">
                            {getFullFileName(fragment.file_name, fragment.language)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {getLanguageLabel(fragment.language)}
                          </span>
                          <DownloadButton
                            code={fragment.code}
                            fileName={fragment.file_name}
                            language={fragment.language}
                            className="scale-90"
                          />
                        </div>
                      </div>

                      <div className="p-0 border-t-0 flex-1 overflow-auto">
                        <FullCodeBlock
                          code={fragment.code}
                          language={fragment.language}
                          showLineNumbers={showLineNumbers}
                          isPublicView={isPublicView}
                          snippetId={snippet.id}
                          fragmentId={fragment.id}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {displaySnippet.fragments.map((fragment, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between px-3 mb-1 text-xs rounded text-light-text-secondary dark:text-dark-text-secondary bg-light-hover/50 dark:bg-dark-hover/50 h-7">
                    <div className="flex items-center flex-1 min-w-0 gap-1">
                      <div className="shrink-0 w-3 h-3 flex items-center justify-center">
                        {getFileIcon(fragment.file_name, fragment.language, "w-full h-full text-light-text-secondary dark:text-dark-text-secondary")}
                      </div>
                      <span className="truncate">{getFullFileName(fragment.file_name, fragment.language)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-light-text-secondary dark:text-dark-text-secondary">
                        {getLanguageLabel(fragment.language)}
                      </span>
                      <DownloadButton
                        code={fragment.code}
                        fileName={fragment.file_name}
                        language={fragment.language}
                        className="scale-75"
                      />
                    </div>
                  </div>

                  <FullCodeBlock
                    code={fragment.code}
                    language={fragment.language}
                    showLineNumbers={showLineNumbers}
                    isPublicView={isPublicView}
                    snippetId={snippet.id}
                    fragmentId={fragment.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isPublicView && isAuthenticated && (
        <>
          <VersionHistoryDrawer
            isOpen={isVersionHistoryOpen}
            onClose={() => setIsVersionHistoryOpen(false)}
            versions={versions}
            onCompare={handleCompareVersions}
            onView={handleViewVersion}
            onRollback={handleRollbackClick}
            isLoading={isLoadingVersions}
          />

          <VersionDiffModal
            isOpen={isDiffModalOpen}
            onClose={() => {
              setIsDiffModalOpen(false);
              setDiffOldVersion(null);
              setDiffNewVersion(null);
            }}
            oldVersion={diffOldVersion}
            newVersion={diffNewVersion}
          />

          <ConfirmationModal
            isOpen={isRollbackConfirmOpen}
            onClose={() => {
              setIsRollbackConfirmOpen(false);
              setVersionToRollback(null);
            }}
            onConfirm={handleConfirmRollback}
            title={translate('versionView.rollback')}
            message={translate('versionView.rollbackConfirm')}
            confirmLabel={translate('versionView.rollback')}
            variant="info"
          />
        </>
      )}
    </div>
  );
};

export default FullCodeView;
