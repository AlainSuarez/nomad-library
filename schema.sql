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
CREATE TABLE IF NOT EXISTS imdb (k TEXT PRIMARY KEY, d TEXT NOT NULL) WITHOUT ROWID;
-- one row per library: when it was last opened, and where its weekly copy stands
CREATE TABLE IF NOT EXISTS libs (
  slug TEXT PRIMARY KEY, name TEXT,
  last_opened INTEGER NOT NULL DEFAULT 0,
  ver INTEGER NOT NULL DEFAULT 0,        -- the finished copy people load
  total INTEGER NOT NULL DEFAULT 0,
  finished INTEGER NOT NULL DEFAULT 0,
  bver INTEGER NOT NULL DEFAULT 0,       -- the copy being built (0 = idle)
  bfmt INTEGER NOT NULL DEFAULT 0, bpage INTEGER NOT NULL DEFAULT 1, bseq INTEGER NOT NULL DEFAULT 0,
  bcount INTEGER NOT NULL DEFAULT 0, bstarted INTEGER NOT NULL DEFAULT 0, bexpect INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS chunks (slug TEXT NOT NULL, ver INTEGER NOT NULL, seq INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY (slug, ver, seq)) WITHOUT ROWID;
