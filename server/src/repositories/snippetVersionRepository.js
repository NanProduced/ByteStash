import { getDb } from "../config/database.js";
import Logger from "../logger.js";

class SnippetVersionRepository {
  constructor() {
    this.insertVersionStmt = null;
    this.insertVersionFragmentStmt = null;
    this.selectVersionsBySnippetIdStmt = null;
    this.selectVersionByIdStmt = null;
    this.selectVersionFragmentsStmt = null;
    this.getNextVersionNumberStmt = null;
  }

  #initializeStatements() {
    const db = getDb();

    if (!this.insertVersionStmt) {
      this.insertVersionStmt = db.prepare(`
        INSERT INTO snippet_versions (
          snippet_id,
          version_number,
          title,
          description,
          categories,
          user_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'utc'))
      `);

      this.insertVersionFragmentStmt = db.prepare(`
        INSERT INTO snippet_version_fragments (
          version_id,
          file_name,
          code,
          language,
          position
        ) VALUES (?, ?, ?, ?, ?)
      `);

      this.selectVersionsBySnippetIdStmt = db.prepare(`
        SELECT 
          id,
          snippet_id,
          version_number,
          title,
          description,
          categories,
          datetime(created_at) || 'Z' as created_at,
          user_id
        FROM snippet_versions
        WHERE snippet_id = ?
        ORDER BY version_number DESC
      `);

      this.selectVersionByIdStmt = db.prepare(`
        SELECT 
          id,
          snippet_id,
          version_number,
          title,
          description,
          categories,
          datetime(created_at) || 'Z' as created_at,
          user_id
        FROM snippet_versions
        WHERE id = ?
      `);

      this.selectVersionFragmentsStmt = db.prepare(`
        SELECT id, file_name, code, language, position
        FROM snippet_version_fragments
        WHERE version_id = ?
        ORDER BY position
      `);

      this.getNextVersionNumberStmt = db.prepare(`
        SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
        FROM snippet_versions
        WHERE snippet_id = ?
      `);
    }
  }

  #processVersion(version) {
    if (!version) return null;

    const fragments = this.selectVersionFragmentsStmt.all(version.id);

    return {
      ...version,
      categories: version.categories ? version.categories.split(",") : [],
      fragments: fragments.sort((a, b) => a.position - b.position),
    };
  }

  getNextVersionNumber(snippetId) {
    this.#initializeStatements();
    try {
      const result = this.getNextVersionNumberStmt.get(snippetId);
      return result.next_version;
    } catch (error) {
      Logger.error("Error in getNextVersionNumber:", error);
      throw error;
    }
  }

  createVersion({
    snippetId,
    versionNumber,
    title,
    description,
    categories = [],
    fragments = [],
    userId,
  }) {
    this.#initializeStatements();
    try {
      const db = getDb();

      return db.transaction(() => {
        const insertResult = this.insertVersionStmt.run(
          snippetId,
          versionNumber,
          title,
          description,
          categories.length > 0 ? categories.join(",") : null,
          userId
        );
        const versionId = insertResult.lastInsertRowid;

        fragments.forEach((fragment, index) => {
          this.insertVersionFragmentStmt.run(
            versionId,
            fragment.file_name || `file${index + 1}`,
            fragment.code || "",
            fragment.language || "plaintext",
            fragment.position ?? index
          );
        });

        const created = this.selectVersionByIdStmt.get(versionId);
        return this.#processVersion(created);
      })();
    } catch (error) {
      Logger.error("Error in createVersion:", error);
      throw error;
    }
  }

  findBySnippetId(snippetId) {
    this.#initializeStatements();
    try {
      const versions = this.selectVersionsBySnippetIdStmt.all(snippetId);
      return versions.map(this.#processVersion.bind(this));
    } catch (error) {
      Logger.error("Error in findBySnippetId:", error);
      throw error;
    }
  }

  findById(versionId) {
    this.#initializeStatements();
    try {
      const version = this.selectVersionByIdStmt.get(versionId);
      return this.#processVersion(version);
    } catch (error) {
      Logger.error("Error in findById:", error);
      throw error;
    }
  }

  findByIdAndSnippetId(versionId, snippetId) {
    this.#initializeStatements();
    try {
      const db = getDb();
      const stmt = db.prepare(`
        SELECT 
          id,
          snippet_id,
          version_number,
          title,
          description,
          categories,
          datetime(created_at) || 'Z' as created_at,
          user_id
        FROM snippet_versions
        WHERE id = ? AND snippet_id = ?
      `);
      const version = stmt.get(versionId, snippetId);
      return this.#processVersion(version);
    } catch (error) {
      Logger.error("Error in findByIdAndSnippetId:", error);
      throw error;
    }
  }
}

export default new SnippetVersionRepository();
