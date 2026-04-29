export type FragmentKind = 'code' | 'markdown' | 'embed';

export interface BaseFragment {
  id?: string;
  file_name: string;
  position: number;
  kind?: FragmentKind;
}

export interface CodeFragment extends BaseFragment {
  kind: 'code';
  code: string;
  language: string;
}

export interface MarkdownFragment extends BaseFragment {
  kind: 'markdown';
  code: string;
  language: 'markdown';
}

export interface EmbedFragment extends BaseFragment {
  kind: 'embed';
  code: '';
  language: '';
  target_snippet_id: string;
  target_fragment_id?: string;
}

export type Fragment = CodeFragment | MarkdownFragment | EmbedFragment;

export interface Snippet {
  id: string;
  title: string;
  description: string;
  updated_at: string;
  expiry_date?: string;
  categories: string[];
  fragments: Fragment[];
  share_count?: number;
  is_public: number;
  is_pinned: number;
  is_favorite: number;
  username?: string;
}

export interface ShareSettings {
  requiresAuth: boolean;
  expiresIn?: number;
}

export interface Share {
  id: string;
  snippet_id: number;
  requires_auth: number;
  view_limit: number | null;
  view_count: number;
  expires_at: string;
  created_at: string;
  expired: number;
}
