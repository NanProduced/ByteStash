import type { Snippet } from './snippets';

export enum SearchResultType {
  SNIPPET = 'snippet',
  ACTION = 'action',
  CATEGORY = 'category',
  LANGUAGE = 'language',
}

export interface SearchResultBase {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export interface SearchResultSnippet extends SearchResultBase {
  type: SearchResultType.SNIPPET;
  snippet: Snippet;
}

export interface SearchResultAction extends SearchResultBase {
  type: SearchResultType.ACTION;
  actionId: string;
}

export interface SearchResultCategory extends SearchResultBase {
  type: SearchResultType.CATEGORY;
  category: string;
}

export interface SearchResultLanguage extends SearchResultBase {
  type: SearchResultType.LANGUAGE;
  language: string;
}

export type SearchResult = SearchResultSnippet | SearchResultAction | SearchResultCategory | SearchResultLanguage;

export interface SnippetAction {
  id: string;
  title: string;
  icon: React.ReactNode;
  keywords?: string[];
  execute: (snippet: Snippet) => void | Promise<void>;
}

export interface GlobalAction {
  id: string;
  title: string;
  icon: React.ReactNode;
  keywords?: string[];
  section?: string;
  execute: () => void | Promise<void>;
}

export interface SearchMatch {
  start: number;
  end: number;
}

export interface HighlightedText {
  text: string;
  matches: SearchMatch[];
}
