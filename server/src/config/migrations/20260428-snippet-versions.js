import Logger from '../../logger.js';

function needsMigration(db) {
  try {
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='snippet_versions'"
    ).get();
    
    if (tableCheck) {
      return false;
    }
    
    return true;
  } catch (error) {
    Logger.error('v1.10.0-snippet-versions - Error checking migration status:', error);
    throw error;
  }
}

export function up_v1_10_0_snippet_versions(db) {
  if (!needsMigration(db)) {
    Logger.debug('v1.10.0-snippet-versions - Migration not needed');
    return;
  }

  Logger.debug('v1.10.0-snippet-versions - Starting migration...');

  try {
    db.exec(`
      BEGIN TRANSACTION;

      CREATE TABLE snippet_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snippet_id INTEGER NOT NULL,
        version_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        categories TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        FOREIGN KEY (snippet_id) REFERENCES snippets (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
        UNIQUE(snippet_id, version_number)
      );

      CREATE TABLE snippet_version_fragments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        code TEXT NOT NULL,
        language TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (version_id) REFERENCES snippet_versions (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_snippet_versions_snippet_id ON snippet_versions (snippet_id);
      CREATE INDEX IF NOT EXISTS idx_snippet_versions_created_at ON snippet_versions (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_snippet_version_fragments_version_id ON snippet_version_fragments (version_id);

      COMMIT;
    `);

    Logger.debug('v1.10.0-snippet-versions - Migration completed successfully');
  } catch (error) {
    Logger.error('v1.10.0-snippet-versions - Migration failed:', error);
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
      Logger.error('v1.10.0-snippet-versions - Rollback failed:', rollbackError);
    }
    throw error;
  }
}
