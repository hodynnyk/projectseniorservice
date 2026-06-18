-- Optional D1 starter schema for future projectseniorservice expansion.
-- v2 runtime is KV-first and does not require this migration to run.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT,
  telegram_id TEXT,
  private_mode_default INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  owner TEXT NOT NULL,
  visibility TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  due_at TEXT,
  priority TEXT,
  status TEXT,
  tags_json TEXT,
  source TEXT,
  linked_items_json TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_due ON items(due_at);
CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  source TEXT,
  module TEXT,
  action TEXT,
  object_id TEXT,
  message TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT,
  encrypted INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);
