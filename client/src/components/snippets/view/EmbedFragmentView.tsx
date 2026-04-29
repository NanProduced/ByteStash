import React, { useEffect, useState } from "react";
import { Loader2, ExternalLink, AlertCircle, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Snippet, Fragment, FragmentKind } from "../../../types/snippets";
import { ROUTES } from "../../../constants/routes";
import { getSnippetById, getPublicSnippetById } from "../../../utils/api/snippets";
import { useAuth } from "../../../hooks/useAuth";
import { FullCodeBlock } from "../../editor/FullCodeBlock";
import { getFullFileName, getLanguageLabel } from "../../../utils/language/languageUtils";

interface EmbedFragmentViewProps {
  fragment: Fragment & { kind: 'embed' };
  showLineNumbers?: boolean;
  isPublicView?: boolean;
  parentSnippetId?: string;
  depth?: number;
}

const MAX_RENDER_DEPTH = 5;

export const EmbedFragmentView: React.FC<EmbedFragmentViewProps> = ({
  fragment,
  showLineNumbers = true,
  isPublicView = false,
  parentSnippetId,
  depth = 0,
}) => {
  const { t: translate } = useTranslation('components/snippets/view/all');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  void parentSnippetId;
  
  const [targetSnippet, setTargetSnippet] = useState<Snippet | null>(null);
  const [targetFragment, setTargetFragment] = useState<Fragment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'not_found' | 'forbidden' | 'other' | null>(null);

  const targetSnippetId = fragment.target_snippet_id;
  const targetFragmentId = fragment.target_fragment_id;

  useEffect(() => {
    if (!targetSnippetId) {
      setError(translate('embedFragmentView.error.noTargetSnippet') || 'No target snippet specified');
      setLoading(false);
      return;
    }

    if (depth >= MAX_RENDER_DEPTH) {
      setError(translate('embedFragmentView.error.depthLimitExceeded') || 'Embed depth limit exceeded');
      setLoading(false);
      return;
    }

    const fetchTarget = async () => {
      setLoading(true);
      setError(null);
      setErrorType(null);

      try {
        let snippet: Snippet;
        
        if (isPublicView || !isAuthenticated) {
          snippet = await getPublicSnippetById(targetSnippetId);
        } else {
          snippet = await getSnippetById(targetSnippetId);
        }

        setTargetSnippet(snippet);

        if (targetFragmentId) {
          const foundFragment = snippet.fragments.find(
            f => String(f.id) === String(targetFragmentId)
          );
          if (foundFragment) {
            setTargetFragment(foundFragment);
          } else {
            setError(translate('embedFragmentView.error.targetFragmentNotFound') || 'Target fragment not found');
            setErrorType('not_found');
          }
        }
      } catch (err: any) {
        console.error('Error fetching embedded snippet:', err);
        
        if (err?.status === 404) {
          setError(translate('embedFragmentView.error.targetNotFound') || 'Target snippet not found');
          setErrorType('not_found');
        } else if (err?.status === 403 || err?.status === 401) {
          setError(translate('embedFragmentView.error.accessDenied') || 'You do not have permission to view this snippet');
          setErrorType('forbidden');
        } else {
          setError(err?.message || translate('embedFragmentView.error.failedToLoad') || 'Failed to load embedded content');
          setErrorType('other');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTarget();
  }, [targetSnippetId, targetFragmentId, depth, isPublicView, isAuthenticated, translate]);

  const handleNavigateToSource = () => {
    if (targetSnippetId) {
      navigate(ROUTES.SNIPPET.replace(':snippetId', targetSnippetId));
    }
  };

  const renderFragmentContent = (frag: Fragment) => {
    const kind = (frag.kind || 'code') as FragmentKind;

    switch (kind) {
      case 'markdown':
      case 'code':
        return (
          <FullCodeBlock
            code={(frag as any).code || ""}
            language={(frag as any).language || "plaintext"}
            showLineNumbers={showLineNumbers}
            isPublicView={isPublicView}
            snippetId={targetSnippet?.id}
            fragmentId={frag.id}
          />
        );

      case 'embed':
        return (
          <EmbedFragmentView
            fragment={frag as Fragment & { kind: 'embed' }}
            showLineNumbers={showLineNumbers}
            isPublicView={isPublicView}
            parentSnippetId={targetSnippet?.id}
            depth={depth + 1}
          />
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-light-surface dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border">
        <Loader2 className="w-8 h-8 animate-spin text-light-primary dark:text-dark-primary mb-3" />
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
          {translate('embedFragmentView.loading') || 'Loading embedded content...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
        <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
        <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-2">
          {translate('embedFragmentView.error.title') || 'Embedded Content Error'}
        </p>
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        {targetSnippetId && !isPublicView && errorType !== 'forbidden' && (
          <button
            onClick={handleNavigateToSource}
            className="mt-3 flex items-center gap-1 text-xs text-light-primary dark:text-dark-primary hover:underline"
          >
            <ExternalLink size={12} />
            {translate('embedFragmentView.viewSource') || 'View source snippet'}
          </button>
        )}
      </div>
    );
  }

  const fragmentsToRender = targetFragment 
    ? [targetFragment] 
    : (targetSnippet?.fragments || []);

  return (
    <div className="border-2 border-dashed border-light-border dark:border-dark-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-light-hover/50 dark:bg-dark-hover/50 border-b border-light-border dark:border-dark-border">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-light-primary dark:text-dark-primary" />
          <span className="text-sm font-medium text-light-text dark:text-dark-text">
            {targetFragment
              ? `${translate('embedFragmentView.embeddedFragment') || 'Embedded Fragment'}: ${getFullFileName(targetFragment.file_name, (targetFragment as any).language)}`
              : `${translate('embedFragmentView.embeddedSnippet') || 'Embedded Snippet'}: ${targetSnippet?.title}`
            }
          </span>
          {depth > 0 && (
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary bg-light-surface dark:bg-dark-surface px-2 py-0.5 rounded">
              {translate('embedFragmentView.depth', { level: depth + 1 }) || `Level ${depth + 1}`}
            </span>
          )}
        </div>
        {(!isPublicView || (targetSnippet && targetSnippet.is_public === 1)) && targetSnippetId && (
          <button
            onClick={handleNavigateToSource}
            className="flex items-center gap-1 text-xs text-light-primary dark:text-dark-primary hover:underline"
            title={translate('embedFragmentView.goToSource') || 'Go to source snippet'}
          >
            <ExternalLink size={12} />
            {translate('embedFragmentView.source') || 'Source'}
          </button>
        )}
      </div>

      <div className="p-3 bg-light-surface dark:bg-dark-surface">
        {fragmentsToRender.map((frag, index) => {
          return (
            <div key={frag.id || index} className={index > 0 ? "mt-4" : ""}>
              {fragmentsToRender.length > 1 && (
                <div className="flex items-center justify-between px-3 mb-1 text-xs rounded text-light-text-secondary dark:text-dark-text-secondary bg-light-hover/30 dark:bg-dark-hover/30 h-7">
                  <div className="flex items-center flex-1 min-w-0 gap-1">
                    <span className="truncate">
                      {getFullFileName(frag.file_name, (frag as any).language)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{getLanguageLabel((frag as any).language)}</span>
                  </div>
                </div>
              )}
              {renderFragmentContent(frag)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmbedFragmentView;
