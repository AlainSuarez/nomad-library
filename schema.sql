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
ALTER TABLE libs ADD COLUMN cover TEXT;
ALTER TABLE libs ADD COLUMN wanted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE libs ADD COLUMN wanted_at INTEGER NOT NULL DEFAULT 0;   -- when a visitor first asked for a copy; the copier works oldest request first
-- one row per day: how many devices opened the site (a count only, no IDs or cookies)
CREATE TABLE IF NOT EXISTS visits (day TEXT PRIMARY KEY, devices INTEGER NOT NULL DEFAULT 0, new_devices INTEGER NOT NULL DEFAULT 0);
-- libraries people asked for that we cannot show yet: a count per library and per catalog system (no IDs)
CREATE TABLE IF NOT EXISTS requests (key TEXT PRIMARY KEY, name TEXT, city TEXT, st TEXT, host TEXT, vendor TEXT, n INTEGER NOT NULL DEFAULT 0, first INTEGER NOT NULL, last INTEGER NOT NULL);
