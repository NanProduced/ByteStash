import React from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { APP_VERSION } from '../../../constants/settings';
import { useSearch } from '../../../contexts/SearchContext';
import { useTranslation } from 'react-i18next';

interface AppHeaderProps {
  subtitle?: string;
  children?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ subtitle, children }) => {
  const { openSearch } = useSearch();
  const { t } = useTranslation('components/search');

  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
  const shortcut = isMac ? '⌘K' : 'Ctrl+K';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold text-light-text dark:text-dark-text flex items-baseline gap-2">
            <Link to="/" className="hover:opacity-80 transition-opacity cursor-pointer">
              ByteStash
            </Link>
            <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">v{APP_VERSION}</span>
          </h1>

          {subtitle && (
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {subtitle}
            </p>
          )}
        </div>

        <button
          onClick={openSearch}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface hover:bg-light-surface-hover dark:hover:bg-dark-surface-hover transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary min-w-[280px] max-w-[400px]"
        >
          <Search className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-left flex-1">
            {t('commandPalette.placeholder')}
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md">
            {shortcut}
          </kbd>
        </button>
      </div>

      {children}
    </div>
  );
};
