ALTER TABLE products
  ADD COLUMN promotion_price INT UNSIGNED NULL AFTER mrp,
  ADD COLUMN promotion_start_at DATETIME NULL AFTER promotion_price,
  ADD COLUMN promotion_end_at DATETIME NULL AFTER promotion_start_at;

ALTER TABLE customers
  MODIFY customer_code VARCHAR(18) NOT NULL;

ALTER TABLE orders
  MODIFY order_number VARCHAR(23) NOT NULL,
  ADD COLUMN whatsapp_invoice_sent_at DATETIME NULL AFTER invoice_sent_at;

CREATE TABLE customer_otp_challenges (
  customer_id CHAR(36) NOT NULL PRIMARY KEY,
  otp_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  request_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
  window_started_at DATETIME NOT NULL,
  last_sent_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  CONSTRAINT fk_customer_otp_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
