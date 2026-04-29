import Logger from '../../logger.js';

function needsMigration(db) {
  try {
    const tableInfo = db.prepare('PRAGMA table_info(fragments)').all();
    const hasKind = tableInfo.some(col => col.name === 'kind');

    return !hasKind;
  } catch (error) {
    Logger.error('v1.10.0-fragment-kinds - Error checking migration status:', error);
    throw error;
  }
}

export function up_v1_10_0_fragment_kinds(db) {
  if (!needsMigration(db)) {
    Logger.debug('v1.10.0-fragment-kinds - Migration not needed');
    return;
  }

  Logger.debug('v1.10.0-fragment-kinds - Starting migration...');

  try {
    db.exec(`
      BEGIN TRANSACTION;
      
      -- Add kind column to fragments table (code, markdown, embed)
      ALTER TABLE fragments ADD COLUMN kind TEXT NOT NULL DEFAULT 'code';
      
      -- Add embed-related columns
      ALTER TABLE fragments ADD COLUMN target_snippet_id INTEGER;
      ALTER TABLE fragments ADD COLUMN target_fragment_id INTEGER;
      
      COMMIT;
    `);

    Logger.debug('v1.10.0-fragment-kinds - Migration completed successfully');
  } catch (error) {
    Logger.error('v1.10.0-fragment-kinds - Migration failed:', error);
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackError) {
      Logger.error('v1.10.0-fragment-kinds - Rollback failed:', rollbackError);
    }
    throw error;
  }
}
