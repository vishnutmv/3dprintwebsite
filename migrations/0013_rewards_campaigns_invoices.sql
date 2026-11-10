ALTER TABLE orders
  ADD COLUMN invoice_sent_at DATETIME NULL AFTER razorpay_payment_id;

ALTER TABLE customer_prizes
  ADD COLUMN reveal_token CHAR(64) NULL AFTER notes,
  ADD COLUMN revealed_at DATETIME NULL AFTER reveal_token;

UPDATE customer_prizes
SET reveal_token = LOWER(REPLACE(UUID(), '-', ''))
WHERE reveal_token IS NULL;

ALTER TABLE customer_prizes
  MODIFY reveal_token CHAR(64) NOT NULL,
  ADD UNIQUE KEY uq_customer_prizes_reveal_token (reveal_token);

CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id CHAR(36) NOT NULL PRIMARY KEY,
  message TEXT NOT NULL,
  created_by VARCHAR(254) NOT NULL,
  recipient_count INT UNSIGNED NOT NULL DEFAULT 0,
  sent_count INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count INT UNSIGNED NOT NULL DEFAULT 0,
  skipped_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_campaign_recipients (
  id CHAR(36) NOT NULL PRIMARY KEY,
  campaign_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  status ENUM('pending','sending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
  error_message VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_whatsapp_campaign_recipients_campaign (campaign_id, status),
  CONSTRAINT fk_whatsapp_campaign_recipients_campaign
    FOREIGN KEY (campaign_id) REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_whatsapp_campaign_recipients_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
