-- MariaDB schema for the InterServer shared-hosting deployment.
-- Money values are integer paise (INR * 100).
CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  price INT UNSIGNED NOT NULL,
  mrp INT UNSIGNED NULL,
  promotion_price INT UNSIGNED NULL,
  promotion_start_at DATETIME NULL,
  promotion_end_at DATETIME NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Uncategorised',
  stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  images JSON NOT NULL,
  video_url VARCHAR(600) NULL,
  specifications JSON NOT NULL,
  material VARCHAR(200) NOT NULL DEFAULT '',
  dimensions VARCHAR(200) NOT NULL DEFAULT '',
  print_time VARCHAR(120) NOT NULL DEFAULT '',
  badge VARCHAR(60) NULL,
  variant VARCHAR(40) NOT NULL DEFAULT 'lattice',
  accent CHAR(7) NOT NULL DEFAULT '#a78bfa',
  model_url VARCHAR(600) NULL,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  reviews INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_active_created (is_active, created_at),
  INDEX idx_products_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  customer_code VARCHAR(18) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(24) NOT NULL,
  delivery_address VARCHAR(500) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  postal_code VARCHAR(10) NULL,
  marketing_opt_in TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customers_email (email),
  UNIQUE KEY uq_customers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_otp_challenges (
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

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_number VARCHAR(23) NOT NULL UNIQUE,
  customer_id CHAR(36) NOT NULL,
  subtotal INT UNSIGNED NOT NULL,
  shipping_charge INT UNSIGNED NOT NULL DEFAULT 0,
  total_amount INT UNSIGNED NOT NULL,
  payment_status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  order_status ENUM('pending','confirmed','processing','packed','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  razorpay_order_id VARCHAR(64) NULL UNIQUE,
  razorpay_payment_id VARCHAR(64) NULL,
  invoice_sent_at DATETIME NULL,
  whatsapp_invoice_sent_at DATETIME NULL,
  tracking_number VARCHAR(64) NULL,
  courier_slug VARCHAR(40) NULL,
  tracking_synced_at DATETIME NULL,
  tracking_payload JSON NULL,
  notes VARCHAR(2000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_customer (customer_id),
  INDEX idx_orders_payment_status (payment_status),
  INDEX idx_orders_order_status (order_status),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NULL,
  product_name VARCHAR(160) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price INT UNSIGNED NOT NULL,
  total_price INT UNSIGNED NOT NULL,
  image_url VARCHAR(600) NULL,
  model_url VARCHAR(600) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_items_order (order_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL UNIQUE,
  gateway VARCHAR(40) NOT NULL DEFAULT 'razorpay',
  gateway_order_id VARCHAR(64) NULL,
  gateway_payment_id VARCHAR(64) NULL UNIQUE,
  amount INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status ENUM('created','pending','paid','failed','refunded') NOT NULL DEFAULT 'created',
  payment_signature_verified TINYINT(1) NOT NULL DEFAULT 0,
  raw_response JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_gateway_order (gateway_order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prizes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  prize_type ENUM('bumper','mega','regular','consolation','voucher') NOT NULL DEFAULT 'regular',
  voucher_code VARCHAR(40) NULL UNIQUE,
  worth INT UNSIGNED NOT NULL DEFAULT 0,
  sponsor VARCHAR(160) NOT NULL DEFAULT '',
  cycle VARCHAR(60) NOT NULL DEFAULT '',
  status ENUM('open','awarded','claimed') NOT NULL DEFAULT 'open',
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  media_urls JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prizes_status (status, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_prizes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  prize_id CHAR(36) NOT NULL,
  assigned_by VARCHAR(254) NOT NULL DEFAULT 'admin',
  notification_status ENUM('pending','sent','failed','not_configured') NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMP NULL,
  active_prize_id CHAR(36) NULL,
  notes VARCHAR(500) NULL,
  reveal_token CHAR(64) NOT NULL UNIQUE,
  revealed_at DATETIME NULL,
  INDEX idx_customer_prizes_active_prize (active_prize_id),
  INDEX idx_customer_prizes_customer (customer_id, assigned_at),
  INDEX idx_customer_prize_history (prize_id, assigned_at),
  CONSTRAINT fk_customer_prizes_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_prizes_prize FOREIGN KEY (prize_id) REFERENCES prizes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS settings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO settings (id, setting_key, setting_value) VALUES
  (UUID(), 'storeName', '3D Print Co.'),
  (UUID(), 'supportEmail', 'orders@3dprintco.in'),
  (UUID(), 'supportPhone', '+91 98400 00000'),
  (UUID(), 'city', 'Chennai'),
  (UUID(), 'gstin', ''),
  (UUID(), 'freeShippingOver', '149900'),
  (UUID(), 'shippingFlat', '4900'),
  (UUID(), 'notifyEmail', '');

CREATE TABLE IF NOT EXISTS whatsapp_leads (
  id CHAR(36) NOT NULL PRIMARY KEY,
  chat_id VARCHAR(120) NOT NULL UNIQUE,
  phone_e164 VARCHAR(24) NULL,
  customer_id CHAR(36) NULL,
  contact_name VARCHAR(120) NOT NULL DEFAULT '',
  last_message TEXT NOT NULL,
  last_message_at DATETIME NOT NULL,
  status ENUM('new','active','closed') NOT NULL DEFAULT 'new',
  is_business_enquiry TINYINT(1) NOT NULL DEFAULT 0,
  is_existing_customer TINYINT(1) NOT NULL DEFAULT 0,
  business_enquiry_at DATETIME NULL,
  enquiry_interest TEXT NULL,
  details_requested_at DATETIME NULL,
  last_auto_reply_at DATETIME NULL,
  auto_reply_attempted_at DATETIME NULL,
  last_admin_reply_at DATETIME NULL,
  auto_followup_due_at DATETIME NULL,
  auto_followup_sent_at DATETIME NULL,
  converted_at DATETIME NULL,
  conversion_order_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_whatsapp_leads_status_updated (status, updated_at),
  INDEX idx_whatsapp_leads_phone (phone_e164),
  INDEX idx_whatsapp_leads_customer (customer_id),
  INDEX idx_whatsapp_leads_followup (auto_followup_due_at, auto_followup_sent_at),
  CONSTRAINT fk_whatsapp_leads_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_whatsapp_leads_conversion_order FOREIGN KEY (conversion_order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  lead_id CHAR(36) NOT NULL,
  provider_message_id VARCHAR(128) NULL UNIQUE,
  direction ENUM('inbound','outbound') NOT NULL,
  message_type VARCHAR(30) NOT NULL DEFAULT 'chat',
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_whatsapp_messages_lead_created (lead_id, created_at),
  CONSTRAINT fk_whatsapp_messages_lead FOREIGN KEY (lead_id) REFERENCES whatsapp_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (
  message_id VARCHAR(128) NOT NULL PRIMARY KEY,
  received_at DATETIME NOT NULL,
  INDEX idx_whatsapp_processed_received (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS product_reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NULL,
  author_name VARCHAR(120) NOT NULL,
  author_email VARCHAR(254) NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  rating TINYINT UNSIGNED NULL,
  title VARCHAR(160) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  admin_reply TEXT NULL,
  admin_reply_by VARCHAR(254) NULL,
  admin_replied_at DATETIME NULL,
  status ENUM('published','hidden') NOT NULL DEFAULT 'published',
  admin_seen_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reviews_product_created (product_id, created_at),
  INDEX idx_reviews_customer (customer_id),
  INDEX idx_reviews_admin_unseen (admin_seen_at),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_favorites (
  customer_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id, product_id),
  INDEX idx_favorites_customer (customer_id, created_at),
  CONSTRAINT fk_favorites_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_favorites_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  kind VARCHAR(40) NOT NULL DEFAULT 'order',
  title VARCHAR(160) NOT NULL,
  body VARCHAR(2000) NOT NULL DEFAULT '',
  link VARCHAR(255) NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_notifications_customer (customer_id, created_at),
  INDEX idx_customer_notifications_unread (customer_id, read_at),
  CONSTRAINT fk_customer_notifications_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
