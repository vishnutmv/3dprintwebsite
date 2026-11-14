-- Half-star support: customers can rate in 0.5 increments (1, 1.5, … 5).
-- Safe to run after 0017; fresh installs already get DECIMAL(2,1) from 0017.
ALTER TABLE product_reviews
  MODIFY COLUMN rating DECIMAL(2,1) NULL;
