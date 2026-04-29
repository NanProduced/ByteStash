export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  SNIPPETS: '/api/snippets',
  SNIPPETS_SEARCH: '/api/snippets/search',
  SHARE: '/api/share',
  PUBLIC: '/api/public/snippets'
} as const;

export const API_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE'
} as const;