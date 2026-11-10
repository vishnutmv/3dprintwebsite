ALTER TABLE prizes
  ADD COLUMN quantity INT UNSIGNED NOT NULL DEFAULT 1 AFTER status;

ALTER TABLE whatsapp_leads
  DROP INDEX phone_e164,
  ADD INDEX idx_whatsapp_leads_phone (phone_e164),
  ADD COLUMN is_existing_customer TINYINT(1) NOT NULL DEFAULT 0 AFTER is_business_enquiry,
  ADD COLUMN enquiry_interest TEXT NULL AFTER business_enquiry_at,
  ADD COLUMN details_requested_at DATETIME NULL AFTER enquiry_interest;

UPDATE whatsapp_leads
SET is_existing_customer=1
WHERE customer_id IS NOT NULL AND converted_at IS NULL;

CREATE TABLE IF NOT EXISTS collaborators (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  contact_name VARCHAR(120) NOT NULL DEFAULT '',
  email VARCHAR(254) NULL,
  phone VARCHAR(24) NOT NULL DEFAULT '',
  notes VARCHAR(1000) NOT NULL DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_collaborators_active_name (is_active,name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collaborator_offers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  collaborator_id CHAR(36) NOT NULL,
  prize_id CHAR(36) NOT NULL UNIQUE,
  reward_name VARCHAR(160) NOT NULL,
  reward_type ENUM('cashback','percentage_discount','fixed_discount','product','other') NOT NULL,
  reward_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  terms VARCHAR(1000) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_collaborator_offers_collaborator (collaborator_id,created_at),
  CONSTRAINT fk_collaborator_offers_collaborator FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE RESTRICT,
  CONSTRAINT fk_collaborator_offers_prize FOREIGN KEY (prize_id) REFERENCES prizes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
