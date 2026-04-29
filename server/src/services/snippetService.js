import Logger from "../logger.js";
import snippetRepository from "../repositories/snippetRepository.js";

const MAX_EMBED_DEPTH = 5;

class EmbedValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmbedValidationError";
  }
}

class SnippetService {
  async getAllSnippets(userId) {
    try {
      Logger.debug("Service: Getting all snippets for user:", userId);
      const result = await snippetRepository.findAll(userId);
      Logger.debug(`Service: Retrieved ${result.length} snippets`);
      return result;
    } catch (error) {
      Logger.error("Service Error - getAllSnippets:", error);
      throw error;
    }
  }

  async getAllPublicSnippets() {
    try {
      Logger.debug("Service: Getting all public snippets");
      const result = await snippetRepository.findAllPublic();
      Logger.debug(`Service: Retrieved ${result.length} public snippets`);
      return result;
    } catch (error) {
      Logger.error("Service Error - getAllPublicSnippets:", error);
      throw error;
    }
  }

  async validateEmbedFragments(fragments, currentUserId, currentSnippetId = null) {
    const embedFragments = fragments.filter(f => f.kind === "embed");
    
    if (embedFragments.length === 0) {
      return;
    }

    for (const fragment of embedFragments) {
      if (!fragment.target_snippet_id) {
        throw new EmbedValidationError("Embed fragment must have a target snippet ID");
      }

      const targetSnippetId = fragment.target_snippet_id;
      
      const targetSnippet = await snippetRepository.findById(targetSnippetId, currentUserId);
      if (!targetSnippet) {
        throw new EmbedValidationError(
          `Target snippet ${targetSnippetId} not found or you don't have permission to access it`
        );
      }

      await this.checkEmbedCycle(
        targetSnippetId,
        fragment.target_fragment_id,
        currentUserId,
        currentSnippetId
      );
    }
  }

  async checkEmbedCycle(
    startSnippetId,
    startFragmentId,
    currentUserId,
    currentSnippetId = null
  ) {
    const visited = new Set();
    const queue = [
      { 
        snippetId: startSnippetId, 
        fragmentId: startFragmentId, 
        depth: 1 
      }
    ];

    while (queue.length > 0) {
      const { snippetId, fragmentId, depth } = queue.shift();
      
      if (depth > MAX_EMBED_DEPTH) {
        throw new EmbedValidationError(
          `Embed depth exceeds maximum limit of ${MAX_EMBED_DEPTH} levels`
        );
      }

      const visitKey = currentSnippetId 
        ? `${currentSnippetId}-${snippetId}-${fragmentId || 'all'}` 
        : `-${snippetId}-${fragmentId || 'all'}`;
      
      if (visited.has(visitKey)) {
        throw new EmbedValidationError(
          "Circular embed reference detected"
        );
      }
      visited.add(visitKey);

      if (currentSnippetId && String(snippetId) === String(currentSnippetId)) {
        throw new EmbedValidationError(
          "Cannot embed a snippet into itself"
        );
      }

      const targetSnippet = await snippetRepository.findById(snippetId, currentUserId);
      if (!targetSnippet) {
        continue;
      }

      if (fragmentId) {
        const specificFragment = targetSnippet.fragments.find(
          f => String(f.id) === String(fragmentId)
        );
        
        if (specificFragment && specificFragment.kind === "embed" && specificFragment.target_snippet_id) {
          queue.push({
            snippetId: specificFragment.target_snippet_id,
            fragmentId: specificFragment.target_fragment_id,
            depth: depth + 1
          });
        }
      } else {
        for (const fragment of targetSnippet.fragments) {
          if (fragment.kind === "embed" && fragment.target_snippet_id) {
            queue.push({
              snippetId: fragment.target_snippet_id,
              fragmentId: fragment.target_fragment_id,
              depth: depth + 1
            });
          }
        }
      }
    }
  }

  async createSnippet(snippetData, userId) {
    try {
      Logger.debug("Service: Creating new snippet for user:", userId);
      
      if (snippetData.fragments && snippetData.fragments.length > 0) {
        await this.validateEmbedFragments(snippetData.fragments, userId);
      }

      const result = await snippetRepository.create({
        ...snippetData,
        userId,
        isPublic: snippetData.is_public || 0,
      });
      Logger.debug("Service: Created snippet with ID:", result.id);
      return result;
    } catch (error) {
      if (error instanceof EmbedValidationError) {
        throw error;
      }
      Logger.error("Service Error - createSnippet:", error);
      throw error;
    }
  }

  async moveToRecycle(id, userId) {
    try {
      Logger.debug(
        "Service: Moving snippet to recycle bin:",
        id,
        "for user:",
        userId
      );
      const result = await snippetRepository.moveToRecycle(id, userId);
      if (!result) {
        Logger.debug(
          "Service: Snippet not found or already moved to recycle bin"
        );
        return null;
      }
      Logger.debug("Service: Snippet moved to recycle bin successfully");
      return { id: result.id };
    } catch (error) {
      Logger.error("Service Error - moveToRecycle:", error);
      throw error;
    }
  }

  async getRecycledSnippets(userId) {
    try {
      // Ensure expired snippets are deleted before fetching recycled snippets
      this.deleteExpiredSnippets();

      Logger.debug("Service: Getting recycled snippets for user:", userId);
      const result = await snippetRepository.findAllDeleted(userId);
      Logger.debug(`Service: Retrieved ${result.length} recycled snippets`);
      return result;
      // return {};
    } catch (error) {
      Logger.error("Service Error - getRecycledSnippets:", error);
      throw error;
    }
  }

  async deleteExpiredSnippets() {
    try {
      Logger.debug("Service: Deleting expired snippets");
      await snippetRepository.deleteExpired();
      Logger.debug(`Service: Deleted expired snippets`);
    } catch (error) {
      Logger.error("Service Error - deleteExpiredSnippets:", error);
      throw error;
    }
  }

  async deleteSnippet(id, userId) {
    try {
      Logger.debug("Service: Deleting snippet:", id, "for user:", userId);
      const result = await snippetRepository.delete(id, userId);
      Logger.debug(
        "Service: Delete operation result:",
        result ? "Success" : "Not Found"
      );
      return result;
    } catch (error) {
      Logger.error("Service Error - deleteSnippet:", error);
      throw error;
    }
  }

  async restoreSnippet(id, userId) {
    try {
      Logger.debug("Service: Restoring snippet:", id, "for user:", userId);
      await snippetRepository.restore(id, userId);
      Logger.debug("Service: Restore operation result:", "Success");
      return { id };
    } catch (error) {
      Logger.error("Service Error - restoreSnippet:", error);
      throw error;
    }
  }

  async updateSnippet(id, snippetData, userId) {
    try {
      Logger.debug("Service: Updating snippet:", id, "for user:", userId);
      
      if (snippetData.fragments && snippetData.fragments.length > 0) {
        await this.validateEmbedFragments(snippetData.fragments, userId, id);
      }

      const result = await snippetRepository.update(
        id,
        {
          ...snippetData,
          isPublic: snippetData.is_public || 0,
        },
        userId
      );
      Logger.debug(
        "Service: Update operation result:",
        result ? "Success" : "Not Found"
      );
      return result;
    } catch (error) {
      if (error instanceof EmbedValidationError) {
        throw error;
      }
      Logger.error("Service Error - updateSnippet:", error);
      throw error;
    }
  }

  async findById(id, userId = null) {
    try {
      Logger.debug(
        "Service: Getting snippet:",
        id,
        userId != null ? `for user: ${userId}` : "(public access)"
      );
      const result = await snippetRepository.findById(id, userId);
      Logger.debug(
        "Service: Find by ID result:",
        result ? "Found" : "Not Found"
      );
      return result;
    } catch (error) {
      Logger.error("Service Error - findById:", error);
      throw error;
    }
  }

  async setPinned(id, value, userId) {
    try {
      Logger.debug(
        "Service: Setting pinned status for snippet:",
        id,
        "to:",
        value,
        "for user:",
        userId
      );
      const result = await snippetRepository.setPinned(id, value, userId);
      Logger.debug(
        "Service: Set pinned operation result:",
        result ? "Success" : "Not Found"
      );
      return result;
    } catch (error) {
      Logger.error("Service Error - setPinned:", error);
      throw error;
    }
  }

  async setFavorite(id, value, userId) {
    try {
      Logger.debug(
        "Service: Setting favorite status for snippet:",
        id,
        "to:",
        value,
        "for user:",
        userId
      );
      const result = await snippetRepository.setFavorite(id, value, userId);
      Logger.debug(
        "Service: Set favorite operation result:",
        result ? "Success" : "Not Found"
      );
      return result;
    } catch (error) {
      Logger.error("Service Error - setFavorite:", error);
      throw error;
    }
  }

  async getSnippetsPaginated({ userId, filters, sort, limit, offset }) {
    try {
      Logger.debug(
        "Service: Getting paginated snippets for user:",
        userId,
        "with filters:",
        filters,
        "sort:",
        sort,
        "limit:",
        limit,
        "offset:",
        offset
      );
      const result = await snippetRepository.findAllPaginated({
        userId,
        filters,
        sort,
        limit,
        offset
      });
      Logger.debug(
        `Service: Retrieved ${result.snippets.length} snippets, total: ${result.total}`
      );
      return result;
    } catch (error) {
      Logger.error("Service Error - getSnippetsPaginated:", error);
      throw error;
    }
  }

  async getMetadata(userId = null) {
    try {
      Logger.debug(
        "Service: Getting metadata for",
        userId !== null ? `user: ${userId}` : "public snippets"
      );
      const result = await snippetRepository.getMetadata(userId);
      Logger.debug(
        `Service: Retrieved ${result.categories.length} categories, ${result.languages.length} languages`
      );
      return result;
    } catch (error) {
      Logger.error("Service Error - getMetadata:", error);
      throw error;
    }
  }
}

export default new SnippetService();
