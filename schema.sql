CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created INTEGER NOT NULL,
  updated INTEGER,
  data TEXT NOT NULL DEFAULT '{}',
  recovery_hash TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS creds (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  pk TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  label TEXT,
  created INTEGER NOT NULL,
  used INTEGER
);
CREATE INDEX IF NOT EXISTS creds_uid ON creds(uid);
