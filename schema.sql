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
-- catalog links visitors gave for libraries in the directory, so the next person from that library skips the paste (key "Name|ST")
CREATE TABLE IF NOT EXISTS catalogs (key TEXT PRIMARY KEY, url TEXT NOT NULL, system TEXT, n INTEGER NOT NULL DEFAULT 1, updated INTEGER NOT NULL);
-- emails people chose to give: kind 'library' = tell me when my library's shelves are ready (with that library's catalog link),
-- kind 'updates' = new libraries and features (maybe a newsletter later). token = their one-click unsubscribe.
CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY, email TEXT NOT NULL, kind TEXT NOT NULL, lib_host TEXT NOT NULL DEFAULT '', lib_name TEXT, lib_url TEXT, system TEXT, token TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE (email, kind, lib_host));
-- feedback people send from the Feedback button (Chris 11.1.26). Read with tools/feedback.sh. ip_day = hash of address + day, only for the daily cap.
CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY, created INTEGER NOT NULL, message TEXT NOT NULL, email TEXT, lib TEXT, page TEXT, device TEXT, uid TEXT, ip_day TEXT, status TEXT NOT NULL DEFAULT 'new', note TEXT);
CREATE INDEX IF NOT EXISTS feedback_ip_day ON feedback (ip_day);
