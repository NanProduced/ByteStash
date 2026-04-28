export interface CodeFragment {
  id?: string;
  file_name: string;
  code: string;
  language: string;
  position: number;
}

export interface Snippet {
  id: string;
  title: string;
  description: string;
  updated_at: string;
  expiry_date?: string;
  categories: string[];
  fragments: CodeFragment[];
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

export interface SnippetVersion {
  id: string;
  snippet_id: string;
  version_number: number;
  title: string;
  description: string;
  categories: string[];
  fragments: CodeFragment[];
  created_at: string;
  user_id: string | null;
}
