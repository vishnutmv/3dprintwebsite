-- MariaDB schema for the InterServer shared-hosting deployment.
-- Money values are integer paise (INR * 100).
CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  price INT UNSIGNED NOT NULL,
  mrp INT UNSIGNED NULL,
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
  customer_code VARCHAR(13) NOT NULL UNIQUE,
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

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_number CHAR(12) NOT NULL UNIQUE,
  customer_id CHAR(36) NOT NULL,
  subtotal INT UNSIGNED NOT NULL,
  shipping_charge INT UNSIGNED NOT NULL DEFAULT 0,
  total_amount INT UNSIGNED NOT NULL,
  payment_status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  order_status ENUM('pending','confirmed','processing','packed','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  razorpay_order_id VARCHAR(64) NULL UNIQUE,
  razorpay_payment_id VARCHAR(64) NULL,
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
  UNIQUE KEY uq_customer_prizes_active_prize (active_prize_id),
  INDEX idx_customer_prizes_customer (customer_id, assigned_at),
  INDEX idx_customer_prize_history (prize_id, assigned_at),
  CONSTRAINT fk_customer_prizes_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_prizes_prize FOREIGN KEY (prize_id) REFERENCES prizes(id) ON DELETE CASCADE
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
  phone_e164 VARCHAR(24) NULL UNIQUE,
  customer_id CHAR(36) NULL,
  contact_name VARCHAR(120) NOT NULL DEFAULT '',
  last_message TEXT NOT NULL,
  last_message_at DATETIME NOT NULL,
  status ENUM('new','active','closed') NOT NULL DEFAULT 'new',
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
