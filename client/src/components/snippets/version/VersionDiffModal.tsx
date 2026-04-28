import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SnippetVersion, CodeFragment } from '../../../types/snippets';
import { getFullFileName, getFileIcon } from '../../../utils/language/languageUtils';
import Modal from '../../common/modals/Modal';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'empty';
  leftLine?: number;
  rightLine?: number;
  content: string;
}

interface FragmentDiffResult {
  fragment: CodeFragment;
  lines: DiffLine[];
  hasChanges: boolean;
}

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({
        type: 'unchanged',
        leftLine: i,
        rightLine: j,
        content: oldLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({
        type: 'added',
        rightLine: j,
        content: newLines[j - 1],
      });
      j--;
    } else if (i > 0) {
      diff.unshift({
        type: 'removed',
        leftLine: i,
        content: oldLines[i - 1],
      });
      i--;
    }
  }

  return diff;
}

function getFragmentByFileName(fragments: CodeFragment[], fileName: string): CodeFragment | undefined {
  return fragments.find(f => f.file_name === fileName);
}

export interface VersionDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldVersion: SnippetVersion | null;
  newVersion: SnippetVersion | null;
}

const VersionDiffModal: React.FC<VersionDiffModalProps> = ({
  isOpen,
  onClose,
  oldVersion,
  newVersion,
}) => {
  const { t: translate } = useTranslation('components/snippets/view/all');
  const [activeFragmentIndex, setActiveFragmentIndex] = useState(0);

  const fragmentDiffs = useMemo(() => {
    if (!oldVersion || !newVersion) return [];

    const oldFileNames = new Set(oldVersion.fragments.map(f => f.file_name));
    const newFileNames = new Set(newVersion.fragments.map(f => f.file_name));
    const allFileNames = new Set([...oldFileNames, ...newFileNames]);

    const results: FragmentDiffResult[] = [];

    for (const fileName of allFileNames) {
      const oldFragment = getFragmentByFileName(oldVersion.fragments, fileName);
      const newFragment = getFragmentByFileName(newVersion.fragments, fileName);

      if (oldFragment && newFragment) {
        const diff = computeLineDiff(oldFragment.code, newFragment.code);
        results.push({
          fragment: newFragment,
          lines: diff,
          hasChanges: diff.some(l => l.type === 'added' || l.type === 'removed'),
        });
      } else if (oldFragment) {
        const diff = oldFragment.code.split('\n').map((content, idx) => ({
          type: 'removed' as const,
          leftLine: idx + 1,
          content,
        }));
        results.push({
          fragment: oldFragment,
          lines: diff,
          hasChanges: true,
        });
      } else if (newFragment) {
        const diff = newFragment.code.split('\n').map((content, idx) => ({
          type: 'added' as const,
          rightLine: idx + 1,
          content,
        }));
        results.push({
          fragment: newFragment,
          lines: diff,
          hasChanges: true,
        });
      }
    }

    return results.sort((a, b) => {
      if (a.hasChanges !== b.hasChanges) {
        return a.hasChanges ? -1 : 1;
      }
      return (a.fragment.position || 0) - (b.fragment.position || 0);
    });
  }, [oldVersion, newVersion]);

  useEffect(() => {
    setActiveFragmentIndex(0);
  }, [oldVersion, newVersion]);

  const activeDiff = fragmentDiffs[activeFragmentIndex];

  const renderDiffLine = (line: DiffLine) => {
    let bgClass = '';
    let gutterBgClass = '';
    
    switch (line.type) {
      case 'added':
        bgClass = 'bg-green-500/20';
        gutterBgClass = 'bg-green-500/30';
        break;
      case 'removed':
        bgClass = 'bg-red-500/20';
        gutterBgClass = 'bg-red-500/30';
        break;
      default:
        bgClass = '';
    }

    return (
      <div key={Math.random()} className={`flex w-full text-sm font-mono ${bgClass}`}>
        <div
          className={`w-12 flex-shrink-0 text-right pr-3 select-none text-xs text-light-text-secondary dark:text-dark-text-secondary border-r border-light-border dark:border-dark-border ${gutterBgClass}`}
        >
          {line.leftLine || ''}
        </div>
        <div
          className={`w-12 flex-shrink-0 text-right pr-3 select-none text-xs text-light-text-secondary dark:text-dark-text-secondary border-r border-light-border dark:border-dark-border ${gutterBgClass}`}
        >
          {line.rightLine || ''}
        </div>
        <pre className="flex-1 px-3 whitespace-pre text-light-text dark:text-dark-text overflow-x-auto">
          {line.content || ' '}
        </pre>
      </div>
    );
  };

  if (!oldVersion || !newVersion) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      expandable={true}
      title={
        <div className="flex items-center gap-3">
          <ArrowLeftRight size={20} className="text-light-primary dark:text-dark-primary" />
          <span className="text-lg font-semibold text-light-text dark:text-dark-text">
            {translate('versionDiff.title')}
          </span>
        </div>
      }
    >
      <div className="flex flex-col h-full max-h-[70vh]">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-2 mb-1">
              <ChevronLeft size={14} className="text-red-500" />
              <span className="text-xs font-semibold text-red-500">
                {translate('versionDiff.oldVersion')}
              </span>
            </div>
            <p className="text-sm font-medium text-light-text dark:text-dark-text">
              {translate('versionHistory.version', { number: oldVersion.version_number })} - {oldVersion.title}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-green-500">
                {translate('versionDiff.newVersion')}
              </span>
              <ChevronRight size={14} className="text-green-500" />
            </div>
            <p className="text-sm font-medium text-light-text dark:text-dark-text">
              {translate('versionHistory.version', { number: newVersion.version_number })} - {newVersion.title}
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row border border-light-border dark:border-dark-border rounded-lg overflow-hidden bg-light-surface dark:bg-dark-surface">
          <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-light-border dark:border-dark-border flex flex-col bg-light-bg/50 dark:bg-dark-bg/50 max-h-60 md:max-h-[500px]">
            <div className="px-3 py-2 border-b border-light-border dark:border-dark-border bg-light-hover/30 dark:bg-dark-hover/30">
              <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                {translate('versionDiff.files', { count: fragmentDiffs.length })}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {fragmentDiffs.map((diff, index) => (
                <button
                  key={index}
                  onClick={() => setActiveFragmentIndex(index)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors border-l-2 ${
                    activeFragmentIndex === index
                      ? 'bg-light-hover dark:bg-dark-hover text-light-text dark:text-dark-text border-light-primary dark:border-dark-primary'
                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover/50 dark:hover:bg-dark-hover/50 border-transparent'
                  }`}
                >
                  <div className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                    {getFileIcon(
                      diff.fragment.file_name,
                      diff.fragment.language,
                      'w-full h-full text-light-text-secondary dark:text-dark-text-secondary'
                    )}
                  </div>
                  <span className="truncate flex-1">
                    {getFullFileName(diff.fragment.file_name, diff.fragment.language)}
                  </span>
                  {diff.hasChanges && (
                    <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">
                      {translate('versionDiff.modified')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col max-h-[400px] md:max-h-[500px]">
            {activeDiff && (
              <>
                <div className="flex items-center justify-between px-3 h-10 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shrink-0">
                  <div className="flex items-center flex-1 min-w-0 gap-2">
                    <div className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                      {getFileIcon(
                        activeDiff.fragment.file_name,
                        activeDiff.fragment.language,
                        'w-full h-full text-light-text-secondary dark:text-dark-text-secondary'
                      )}
                    </div>
                    <span className="truncate font-medium text-sm text-light-text dark:text-dark-text">
                      {getFullFileName(activeDiff.fragment.file_name, activeDiff.fragment.language)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      {activeDiff.lines.filter(l => l.type === 'removed').length}
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      {activeDiff.lines.filter(l => l.type === 'added').length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <div className="min-w-full">
                    <div className="flex bg-light-hover/30 dark:bg-dark-hover/30 border-b border-light-border dark:border-dark-border">
                      <div className="w-12 flex-shrink-0 text-center text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary py-1 border-r border-light-border dark:border-dark-border">
                        {translate('versionDiff.oldLine')}
                      </div>
                      <div className="w-12 flex-shrink-0 text-center text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary py-1 border-r border-light-border dark:border-dark-border">
                        {translate('versionDiff.newLine')}
                      </div>
                      <div className="flex-1 text-center text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary py-1">
                        {translate('versionDiff.content')}
                      </div>
                    </div>
                    <div className="divide-y divide-light-border/50 dark:divide-dark-border/50">
                      {activeDiff.lines.length === 0 ? (
                        <div className="p-8 text-center text-light-text-secondary dark:text-dark-text-secondary">
                          {translate('versionDiff.noChanges')}
                        </div>
                      ) : (
                        activeDiff.lines.map((line) => renderDiffLine(line))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-light-text-secondary dark:text-dark-text-secondary">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" />
            <span>{translate('versionDiff.removed')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500/50" />
            <span>{translate('versionDiff.added')}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default VersionDiffModal;
