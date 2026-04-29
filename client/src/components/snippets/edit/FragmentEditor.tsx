import React, { useState } from "react";
import {
  Trash2,
  Code,
  FileText,
  Link2,
  Eye,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Fragment, FragmentKind } from "../../../types/snippets";
import { getLanguageLabel, getFullFileName } from "../../../utils/language/languageUtils";
import { IconButton } from "../../common/buttons/IconButton";
import { CodeEditor } from "../../editor/CodeEditor";
import MarkdownRenderer from "../../common/markdown/MarkdownRenderer";

interface FragmentEditorProps {
  fragment: Fragment;
  onUpdate: (fragment: Fragment) => void;
  onDelete: () => void;
  showLineNumbers: boolean;
}

const KIND_OPTIONS: { value: FragmentKind; label: string; icon: React.ReactNode }[] = [
  { value: "code", label: "Code", icon: <Code size={14} /> },
  { value: "markdown", label: "Markdown", icon: <FileText size={14} /> },
  { value: "embed", label: "Embed", icon: <Link2 size={14} /> },
];

export const FragmentEditor: React.FC<FragmentEditorProps> = ({
  fragment,
  onUpdate,
  onDelete,
  showLineNumbers,
}) => {
  const { t: translate } = useTranslation('components/snippets/edit');
  const [showKindDropdown, setShowKindDropdown] = useState(false);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [targetSnippetId, setTargetSnippetId] = useState(
    (fragment as any).target_snippet_id || ""
  );
  const [targetFragmentId, setTargetFragmentId] = useState(
    (fragment as any).target_fragment_id || ""
  );

  const currentKind = fragment.kind || "code";
  const currentKindOption = KIND_OPTIONS.find(k => k.value === currentKind) || KIND_OPTIONS[0];

  const handleCodeChange = (newCode: string | undefined) => {
    onUpdate({
      ...fragment,
      code: newCode || "",
    } as Fragment);
  };

  const handleKindChange = (newKind: FragmentKind) => {
    if (newKind === currentKind) {
      setShowKindDropdown(false);
      return;
    }

    let updatedFragment: Fragment;
    
    switch (newKind) {
      case "code":
        updatedFragment = {
          ...fragment,
          kind: "code",
          code: (fragment as any).code || "",
          language: (fragment as any).language || "plaintext",
        } as Fragment;
        break;
      case "markdown":
        updatedFragment = {
          ...fragment,
          kind: "markdown",
          code: (fragment as any).code || "",
          language: "markdown",
        } as Fragment;
        break;
      case "embed":
        updatedFragment = {
          ...fragment,
          kind: "embed",
          code: "",
          language: "",
          target_snippet_id: targetSnippetId,
          target_fragment_id: targetFragmentId || undefined,
        } as Fragment;
        break;
      default:
        setShowKindDropdown(false);
        return;
    }

    onUpdate(updatedFragment);
    setShowKindDropdown(false);
  };

  const handleTargetSnippetChange = (value: string) => {
    setTargetSnippetId(value);
    if (fragment.kind === "embed") {
      onUpdate({
        ...fragment,
        target_snippet_id: value,
        target_fragment_id: targetFragmentId || undefined,
      } as Fragment);
    }
  };

  const handleTargetFragmentChange = (value: string) => {
    setTargetFragmentId(value);
    if (fragment.kind === "embed") {
      onUpdate({
        ...fragment,
        target_snippet_id: targetSnippetId,
        target_fragment_id: value || undefined,
      } as Fragment);
    }
  };

  const renderEditorContent = () => {
    switch (currentKind) {
      case "code":
        return (
          <div className="h-full overflow-y-auto pr-1">
            <CodeEditor
              code={(fragment as any).code || ""}
              language={(fragment as any).language || "plaintext"}
              onValueChange={handleCodeChange}
              showLineNumbers={showLineNumbers}
            />
          </div>
        );

      case "markdown":
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 p-2 bg-light-hover/50 dark:bg-dark-hover/50 border-b border-light-border dark:border-dark-border shrink-0">
              <button
                type="button"
                onClick={() => setShowMarkdownPreview(false)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  !showMarkdownPreview
                    ? "bg-light-primary dark:bg-dark-primary text-white"
                    : "text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover dark:hover:bg-dark-hover"
                }`}
              >
                {translate('fragmentEditor.form.markdown.edit') || 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => setShowMarkdownPreview(true)}
                className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                  showMarkdownPreview
                    ? "bg-light-primary dark:bg-dark-primary text-white"
                    : "text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover dark:hover:bg-dark-hover"
                }`}
              >
                <Eye size={12} />
                {translate('fragmentEditor.form.markdown.preview') || 'Preview'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {showMarkdownPreview ? (
                <div className="rounded-lg p-4 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
                  <MarkdownRenderer className="markdown prose dark:prose-invert max-w-none">
                    {(fragment as any).code || ""}
                  </MarkdownRenderer>
                </div>
              ) : (
                <CodeEditor
                  code={(fragment as any).code || ""}
                  language="markdown"
                  onValueChange={handleCodeChange}
                  showLineNumbers={showLineNumbers}
                />
              )}
            </div>
          </div>
        );

      case "embed":
        return (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-lg mx-auto space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-light-primary/10 dark:bg-dark-primary/10 mb-4">
                  <Link2 size={32} className="text-light-primary dark:text-dark-primary" />
                </div>
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">
                  {translate('fragmentEditor.form.embed.title') || 'Embed Another Snippet'}
                </h3>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  {translate('fragmentEditor.form.embed.description') || 'Link to an existing snippet or fragment to embed its content'}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                    {translate('fragmentEditor.form.embed.targetSnippetId') || 'Target Snippet ID'}
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={targetSnippetId}
                    onChange={(e) => handleTargetSnippetChange(e.target.value)}
                    placeholder={translate('fragmentEditor.form.embed.targetSnippetId.placeholder') || 'Enter snippet ID'}
                    className="w-full p-3 text-sm border rounded-md bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text border-light-border dark:border-dark-border focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary focus:border-light-primary dark:focus:border-dark-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                    {translate('fragmentEditor.form.embed.targetFragmentId') || 'Target Fragment ID'}
                    <span className="text-light-text-secondary dark:text-dark-text-secondary ml-1">
                      ({translate('fragmentEditor.form.embed.optional') || 'optional'})
                    </span>
                  </label>
                  <input
                    type="text"
                    value={targetFragmentId}
                    onChange={(e) => handleTargetFragmentChange(e.target.value)}
                    placeholder={translate('fragmentEditor.form.embed.targetFragmentId.placeholder') || 'Leave empty to embed entire snippet'}
                    className="w-full p-3 text-sm border rounded-md bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text border-light-border dark:border-dark-border focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary focus:border-light-primary dark:focus:border-dark-primary outline-none"
                  />
                  <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {translate('fragmentEditor.form.embed.targetFragmentId.help') || 'If specified, only this fragment will be embedded. Otherwise, all fragments from the target snippet will be included.'}
                  </p>
                </div>
              </div>

              {targetSnippetId && (
                <div className="flex items-center justify-center gap-2 p-3 bg-light-hover/30 dark:bg-dark-hover/30 rounded-lg">
                  <ExternalLink size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
                  <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {translate('fragmentEditor.form.embed.previewHint') || 'Preview will be shown when viewing the snippet'}
                  </span>
                </div>
              )}

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  {translate('fragmentEditor.form.embed.notes.title') || 'Important Notes'}
                </h4>
                <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li>• {translate('fragmentEditor.form.embed.notes.permissions') || 'The target snippet must be accessible to you (either owned by you or public)'}</li>
                  <li>• {translate('fragmentEditor.form.embed.notes.depth') || 'Embeds can be nested up to 5 levels deep'}</li>
                  <li>• {translate('fragmentEditor.form.embed.notes.cycles') || 'Circular references are not allowed'}</li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center gap-2 p-3 bg-light-hover dark:bg-dark-hover border-b border-light-border dark:border-dark-border shrink-0">
        <div className="flex items-center gap-0.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowKindDropdown(!showKindDropdown)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text hover:bg-light-hover dark:hover:bg-dark-hover transition-colors"
            >
              {currentKindOption.icon}
              <span>{currentKindOption.label}</span>
              <ChevronDown size={12} className={`transition-transform ${showKindDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showKindDropdown && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg shadow-xl z-50 py-1">
                {KIND_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleKindChange(option.value)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      currentKind === option.value
                        ? "bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary"
                        : "text-light-text dark:text-dark-text hover:bg-light-hover dark:hover:bg-dark-hover"
                    }`}
                  >
                    {option.icon}
                    <span>{option.label}</span>
                    {currentKind === option.value && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-light-primary dark:bg-dark-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center flex-1 min-w-0 pr-4 pl-1">
          <span className="truncate font-medium text-sm text-light-text dark:text-dark-text mr-4">
            {getFullFileName(fragment.file_name, (fragment as any).language) || translate('fragmentEditor.form.fileName.placeholder')}
          </span>
          {(fragment as any).language && currentKind !== "embed" && (
            <span className="bg-light-primary/10 dark:bg-dark-primary/10 text-light-primary dark:text-dark-primary text-xs font-semibold px-2 py-0.5 rounded ml-auto tracking-wide uppercase">
              {getLanguageLabel((fragment as any).language)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            icon={<Trash2 size={16} className="hover:text-red-500" />}
            onClick={onDelete}
            variant="custom"
            size="sm"
            className="w-9 h-9 bg-light-hover dark:bg-dark-hover hover:bg-light-surface dark:hover:bg-dark-surface"
            label={translate('fragmentEditor.action.delete')}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-light-surface dark:bg-dark-surface">
        {renderEditorContent()}
      </div>
    </div>
  );
};
