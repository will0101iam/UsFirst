-- Additive: old clients/API keep working. Versions and row changes commit with the write.
ALTER TABLE pairs ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE requests ADD COLUMN change_version INTEGER NOT NULL DEFAULT 0;
CREATE INDEX requests_pair_change ON requests(pair_id, change_version);
CREATE INDEX requests_pair_order ON requests(pair_id, created_at DESC, id DESC);
CREATE INDEX requests_pair_status_order ON requests(pair_id, status, created_at DESC, id DESC);
CREATE TABLE request_tombstones (pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE, request_id TEXT NOT NULL, change_version INTEGER NOT NULL, PRIMARY KEY(pair_id, request_id));
CREATE INDEX tombstones_pair_change ON request_tombstones(pair_id, change_version);
CREATE TRIGGER request_sync_insert AFTER INSERT ON requests BEGIN
  DELETE FROM request_tombstones WHERE pair_id=NEW.pair_id AND request_id=NEW.id;
  UPDATE pairs SET sync_version=sync_version+1 WHERE id=NEW.pair_id;
  UPDATE requests SET change_version=(SELECT sync_version FROM pairs WHERE id=NEW.pair_id) WHERE id=NEW.id;
END;
CREATE TRIGGER request_sync_update AFTER UPDATE OF status,title,amount_cents,category,reason,decided_at,decision_note,purchased_at ON requests
WHEN NEW.status IS NOT OLD.status OR NEW.title IS NOT OLD.title OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.category IS NOT OLD.category OR NEW.reason IS NOT OLD.reason OR NEW.decided_at IS NOT OLD.decided_at OR NEW.decision_note IS NOT OLD.decision_note OR NEW.purchased_at IS NOT OLD.purchased_at
BEGIN
  UPDATE pairs SET sync_version=sync_version+1 WHERE id=NEW.pair_id;
  UPDATE requests SET change_version=(SELECT sync_version FROM pairs WHERE id=NEW.pair_id) WHERE id=NEW.id;
END;
CREATE TRIGGER request_sync_delete AFTER DELETE ON requests BEGIN
  UPDATE pairs SET sync_version=sync_version+1 WHERE id=OLD.pair_id;
  INSERT INTO request_tombstones(pair_id,request_id,change_version) VALUES(OLD.pair_id,OLD.id,(SELECT sync_version FROM pairs WHERE id=OLD.pair_id)) ON CONFLICT(pair_id,request_id) DO UPDATE SET change_version=excluded.change_version;
END;
CREATE TRIGGER photo_sync_insert AFTER INSERT ON photos BEGIN
  UPDATE pairs SET sync_version=sync_version+1 WHERE id=(SELECT pair_id FROM requests WHERE id=NEW.request_id);
  UPDATE requests SET change_version=(SELECT sync_version FROM pairs WHERE id=requests.pair_id) WHERE id=NEW.request_id;
END;
CREATE TRIGGER photo_sync_delete AFTER DELETE ON photos BEGIN
  UPDATE pairs SET sync_version=sync_version+1 WHERE id=(SELECT pair_id FROM requests WHERE id=OLD.request_id);
  UPDATE requests SET change_version=(SELECT sync_version FROM pairs WHERE id=requests.pair_id) WHERE id=OLD.request_id;
END;
