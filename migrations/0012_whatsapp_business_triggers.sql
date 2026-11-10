ALTER TABLE whatsapp_leads
  ADD COLUMN is_business_enquiry TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN business_enquiry_at DATETIME NULL AFTER is_business_enquiry;

UPDATE whatsapp_leads
SET is_business_enquiry = 1,
    business_enquiry_at = COALESCE(business_enquiry_at, created_at);
