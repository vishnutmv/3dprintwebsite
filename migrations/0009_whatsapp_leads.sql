-- Apply once to an existing MariaDB database before enabling WhatsApp webhooks.
CREATE TABLE IF NOT EXISTS whatsapp_leads (
  id CHAR(36) NOT NULL PRIMARY KEY,
  phone_e164 VARCHAR(24) NOT NULL UNIQUE,
  contact_name VARCHAR(120) NOT NULL DEFAULT '',
  last_message TEXT NOT NULL,
  last_message_at DATETIME NOT NULL,
  status ENUM('new','active','closed') NOT NULL DEFAULT 'new',
  last_auto_reply_at DATETIME NULL,
  auto_reply_attempted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_whatsapp_leads_status_updated (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (
  message_id VARCHAR(128) NOT NULL PRIMARY KEY,
  received_at DATETIME NOT NULL,
  INDEX idx_whatsapp_processed_received (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
