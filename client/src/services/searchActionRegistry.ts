import type { GlobalAction, SnippetAction } from '../types/search';

class SearchActionRegistry {
  private globalActions: Map<string, GlobalAction> = new Map();
  private snippetActions: Map<string, SnippetAction> = new Map();

  registerGlobalAction(action: GlobalAction): () => void {
    this.globalActions.set(action.id, action);
    return () => this.globalActions.delete(action.id);
  }

  registerSnippetAction(action: SnippetAction): () => void {
    this.snippetActions.set(action.id, action);
    return () => this.snippetActions.delete(action.id);
  }

  getGlobalActions(): GlobalAction[] {
    return Array.from(this.globalActions.values());
  }

  getSnippetActions(): SnippetAction[] {
    return Array.from(this.snippetActions.values());
  }

  getSnippetAction(id: string): SnippetAction | undefined {
    return this.snippetActions.get(id);
  }

  getGlobalAction(id: string): GlobalAction | undefined {
    return this.globalActions.get(id);
  }

  searchGlobalActions(query: string): GlobalAction[] {
    const lowerQuery = query.toLowerCase();
    return this.getGlobalActions().filter(action => {
      if (action.title.toLowerCase().includes(lowerQuery)) return true;
      if (action.keywords?.some(k => k.toLowerCase().includes(lowerQuery))) return true;
      return false;
    });
  }
}

export const searchActionRegistry = new SearchActionRegistry();
