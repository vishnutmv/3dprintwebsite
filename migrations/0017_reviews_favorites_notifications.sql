-- Storefront social features: product ratings/reviews, favourites and
-- customer notification inbox. Safe to run once; each CREATE is guarded.
CREATE TABLE IF NOT EXISTS product_reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NULL,
  author_name VARCHAR(120) NOT NULL,
  author_email VARCHAR(254) NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  rating DECIMAL(2,1) NULL,
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
