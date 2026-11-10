-- Add WaAPI chat IDs, including privacy-preserving WhatsApp LIDs, to existing leads.
ALTER TABLE whatsapp_leads
  MODIFY phone_e164 VARCHAR(24) NULL,
  ADD COLUMN chat_id VARCHAR(120) NULL AFTER id;

UPDATE whatsapp_leads
SET chat_id = CONCAT(phone_e164, '@c.us')
WHERE chat_id IS NULL AND phone_e164 IS NOT NULL;

ALTER TABLE whatsapp_leads
  MODIFY chat_id VARCHAR(120) NOT NULL,
  ADD UNIQUE KEY uq_whatsapp_leads_chat_id (chat_id);
