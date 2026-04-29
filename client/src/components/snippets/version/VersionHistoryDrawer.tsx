import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, History, RotateCcw, Eye, Check, FileCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { SnippetVersion } from '../../../types/snippets';

export interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  versions: SnippetVersion[];
  currentVersionId?: string;
  onCompare: (versionId1: string, versionId2: string) => void;
  onView: (version: SnippetVersion) => void;
  onRollback: (version: SnippetVersion) => void;
  isLoading?: boolean;
}

const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  isOpen,
  onClose,
  versions,
  currentVersionId,
  onCompare,
  onView,
  onRollback,
  isLoading = false,
}) => {
  const { t: translate } = useTranslation('components/snippets/view/all');
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set());
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedVersions(new Set());
    }
  }, [isOpen]);

  const toggleVersionSelection = (versionId: string) => {
    setSelectedVersions(prev => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        if (next.size >= 2) {
          const first = next.values().next().value as string;
          if (first) {
            next.delete(first);
          }
        }
        next.add(versionId);
      }
      return next;
    });
  };

  const handleCompare = () => {
    const versionArray = Array.from(selectedVersions);
    if (versionArray.length === 2) {
      const sortedVersions = [...versions].sort((a, b) => a.version_number - b.version_number);
      const v1 = sortedVersions.find(v => v.id === versionArray[0]);
      const v2 = sortedVersions.find(v => v.id === versionArray[1]);
      if (v1 && v2) {
        if (v1.version_number < v2.version_number) {
          onCompare(v1.id, v2.id);
        } else {
          onCompare(v2.id, v1.id);
        }
      }
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return translate('fullCodeView.defaultUpdateTime');
      return formatDistanceToNow(date);
    } catch {
      return translate('fullCodeView.defaultUpdateTime');
    }
  };

  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => b.version_number - a.version_number);
  }, [versions]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        ref={drawerRef}
        className={`fixed right-0 top-0 h-full w-96 max-w-full bg-light-surface dark:bg-dark-surface shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-light-border dark:border-dark-border">
          <div className="flex items-center gap-2">
            <History size={20} className="text-light-primary dark:text-dark-primary" />
            <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
              {translate('versionHistory.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-light-hover dark:hover:bg-dark-hover transition-colors"
          >
            <X size={18} className="text-light-text-secondary dark:text-dark-text-secondary" />
          </button>
        </div>

        {selectedVersions.size === 2 && (
          <div className="px-4 py-2 bg-light-primary/10 dark:bg-dark-primary/10 border-b border-light-border dark:border-dark-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-light-text dark:text-dark-text">
                {translate('versionHistory.selectedForCompare', { count: selectedVersions.size })}
              </span>
              <button
                onClick={handleCompare}
                className="px-3 py-1 text-sm bg-light-primary dark:bg-dark-primary text-white rounded-md hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <Eye size={14} />
                {translate('versionHistory.compare')}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-light-primary dark:border-dark-primary" />
            </div>
          ) : sortedVersions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-light-text-secondary dark:text-dark-text-secondary">
              <Clock size={32} className="mb-2 opacity-50" />
              <span className="text-sm">{translate('versionHistory.noVersions')}</span>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-light-border dark:bg-dark-border" />

              {sortedVersions.map((version) => {
                const isSelected = selectedVersions.has(version.id);
                const isCurrent = currentVersionId ? version.id === currentVersionId : false;

                return (
                  <div key={version.id} className="relative pl-14 pr-4 py-3">
                    <div
                      className={`absolute left-4 top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-light-primary dark:bg-dark-primary border-light-primary dark:border-dark-primary'
                          : isCurrent
                          ? 'bg-green-500 border-green-500'
                          : 'bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border hover:border-light-primary dark:hover:border-dark-primary'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                      {isCurrent && !isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>

                    <div
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-light-primary dark:border-dark-primary bg-light-primary/5 dark:bg-dark-primary/5'
                          : 'border-light-border dark:border-dark-border hover:border-light-primary/50 dark:hover:border-dark-primary/50 hover:bg-light-hover/30 dark:hover:bg-dark-hover/30'
                      }`}
                      onClick={() => toggleVersionSelection(version.id)}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-light-text dark:text-dark-text">
                            {translate('versionHistory.version', { number: version.version_number })}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded">
                              {translate('versionHistory.current')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">
                        <Clock size={12} />
                        <span>{translate('fullCodeView.dateTimeAgo', { dateTime: formatTime(version.created_at) })}</span>
                      </div>

                      <p className="text-sm text-light-text dark:text-dark-text truncate mb-2">
                        {version.title}
                      </p>

                      {version.fragments.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3">
                          <FileCode size={12} />
                          <span>
                            {translate('versionHistory.files', { count: version.fragments.length })}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onView(version);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-light-hover dark:bg-dark-hover text-light-text dark:text-dark-text rounded hover:bg-light-hover/80 dark:hover:bg-dark-hover/80 transition-colors"
                        >
                          <Eye size={12} />
                          {translate('versionHistory.view')}
                        </button>
                        {!isCurrent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRollback(version);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary rounded hover:bg-light-primary/20 dark:hover:bg-dark-primary/20 transition-colors"
                          >
                            <RotateCcw size={12} />
                            {translate('versionHistory.rollback')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}</div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-light-border dark:border-dark-border bg-light-bg/50 dark:bg-dark-bg/50">
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">
            {translate('versionHistory.selectHint')}
          </p>
        </div>
      </div>
    </>,
    document.body
  );
};

export default VersionHistoryDrawer;
