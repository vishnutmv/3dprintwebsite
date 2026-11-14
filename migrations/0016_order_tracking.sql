-- Per-order courier tracking (TrackCourier.io).
-- Apply once to a populated database. Fresh installs already have these
-- columns in database/interserver.sql.
ALTER TABLE orders
  ADD COLUMN tracking_number VARCHAR(64) NULL AFTER whatsapp_invoice_sent_at,
  ADD COLUMN courier_slug VARCHAR(40) NULL AFTER tracking_number,
  ADD COLUMN tracking_synced_at DATETIME NULL AFTER courier_slug,
  ADD COLUMN tracking_payload JSON NULL AFTER tracking_synced_at;
