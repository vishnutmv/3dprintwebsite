ALTER TABLE whatsapp_leads
  ADD COLUMN customer_id CHAR(36) NULL AFTER phone_e164,
  ADD COLUMN last_admin_reply_at DATETIME NULL AFTER last_auto_reply_at,
  ADD COLUMN auto_followup_due_at DATETIME NULL AFTER auto_followup_attempted_at,
  ADD COLUMN auto_followup_sent_at DATETIME NULL AFTER auto_followup_due_at,
  ADD COLUMN converted_at DATETIME NULL AFTER auto_followup_sent_at,
  ADD COLUMN conversion_order_id CHAR(36) NULL AFTER converted_at,
  ADD INDEX idx_whatsapp_leads_customer (customer_id),
  ADD INDEX idx_whatsapp_leads_followup (auto_followup_due_at, auto_followup_sent_at),
  ADD CONSTRAINT fk_whatsapp_leads_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_whatsapp_leads_conversion_order
    FOREIGN KEY (conversion_order_id) REFERENCES orders(id) ON DELETE SET NULL;

CREATE TABLE whatsapp_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  lead_id CHAR(36) NOT NULL,
  provider_message_id VARCHAR(128) NULL,
  direction ENUM('inbound','outbound') NOT NULL,
  message_type VARCHAR(30) NOT NULL DEFAULT 'chat',
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_whatsapp_messages_provider_id (provider_message_id),
  INDEX idx_whatsapp_messages_lead_created (lead_id, created_at),
  CONSTRAINT fk_whatsapp_messages_lead
    FOREIGN KEY (lead_id) REFERENCES whatsapp_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO whatsapp_messages (id, lead_id, direction, message_type, body, created_at)
SELECT UUID(), id, 'inbound', 'chat', last_message, last_message_at
FROM whatsapp_leads
WHERE last_message <> '';
