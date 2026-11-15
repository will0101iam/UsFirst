PRAGMA foreign_keys = ON;
-- Endpoint is a capability: never return it or the encryption keys in API reads.
-- A subscription belongs to one authenticated device session; logout cascades it.
CREATE TABLE push_subscriptions (
  endpoint_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX push_user ON push_subscriptions(user_id);
CREATE INDEX push_session ON push_subscriptions(session_hash);
