<?php
declare(strict_types=1);

function handle_whatsapp(string $path): bool
{
    if (preg_match('#^whatsapp/waapi-followups/([A-Za-z0-9_-]{32,128})$#', $path, $match)) {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            header('Allow: POST');
            fail(405, 'Method not allowed.');
        }
        global $config;
        $cronSecret = (string)($config['waapi_cron_secret'] ?? '');
        if (strlen($cronSecret) < 32 || !hash_equals($cronSecret, $match[1])) {
            fail(404, 'Webhook not found.');
        }
        respond(200, ['processed' => send_due_whatsapp_followups()]);
    }

    if (!preg_match('#^whatsapp/waapi/([A-Za-z0-9_-]{32,128})$#', $path, $match)) return false;
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        header('Allow: POST');
        fail(405, 'Method not allowed.');
    }

    global $config;
    $webhookSecret = (string)($config['waapi_webhook_secret'] ?? '');
    $instanceId = (string)($config['waapi_instance_id'] ?? '');
    if (strlen($webhookSecret) < 32 || !hash_equals($webhookSecret, $match[1])) {
        fail(404, 'Webhook not found.');
    }

    $raw = file_get_contents('php://input');
    if (!is_string($raw) || $raw === '') fail(400, 'Webhook body is empty.');
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        error_log('[interserver-api] Invalid WaAPI webhook JSON.');
        respond(200, ['received' => true, 'ignored' => true]);
    }
    if ($instanceId === '' || (string)($payload['instanceId'] ?? '') !== $instanceId) {
        error_log('[interserver-api] WaAPI webhook instance id did not match configuration.');
        respond(200, ['received' => true, 'ignored' => true]);
    }
    if (($payload['event'] ?? '') !== 'message') {
        respond(200, ['received' => true, 'ignored' => true]);
    }

    $message = $payload['data']['message'] ?? null;
    if (!is_array($message)) respond(200, ['received' => true, 'ignored' => true]);
    if (!empty($message['isStatus']) || !empty($message['broadcast'])) {
        respond(200, ['received' => true, 'ignored' => true]);
    }

    $isOutbound = !empty($message['fromMe']);
    $chatId = text_value($isOutbound ? ($message['to'] ?? $message['from'] ?? '') : ($message['from'] ?? ''), 120);
    if (!preg_match('/^(?:\d{6,20}@c\.us|[A-Za-z0-9_-]{1,100}@lid)$/', $chatId)) {
        respond(200, ['received' => true, 'ignored' => true]);
    }

    $messageKey = is_array($message['id'] ?? null) ? $message['id'] : [];
    $dataKey = is_array($message['_data']['id'] ?? null) ? $message['_data']['id'] : [];
    $messageId = text_value($messageKey['_serialized'] ?? $dataKey['_serialized'] ?? '', 128);
    if ($messageId === '') respond(200, ['received' => true, 'ignored' => true]);
    $type = text_value($message['type'] ?? 'chat', 30);
    $body = $type === 'chat' ? text_value($message['body'] ?? '', 2000) : '[' . $type . ' enquiry]';
    $timestamp = is_numeric($message['timestamp'] ?? null)
        ? gmdate('Y-m-d H:i:s', (int)$message['timestamp'])
        : gmdate('Y-m-d H:i:s');

    if ($isOutbound) {
        process_whatsapp_outbound_message(
            $chatId,
            whatsapp_phone_from_chat_id($chatId),
            '',
            $messageId,
            $type,
            $body,
            $timestamp,
        );
        respond(200, ['received' => true]);
    }

    $isBusinessEnquiry = is_whatsapp_business_enquiry($body);
    process_whatsapp_lead(
        $chatId,
        str_ends_with($chatId, '@c.us') ? substr($chatId, 0, -5) : null,
        text_value($message['notifyName'] ?? '', 120),
        $messageId,
        $type,
        $body,
        $timestamp,
        $isBusinessEnquiry,
    );
    respond(200, ['received' => true]);
}

function is_whatsapp_business_enquiry(string $message): bool
{
    return preg_match(
        '~(?<![A-Za-z0-9])(?:@|/)?3dprintco(?![A-Za-z0-9])\s*[:,\-]?\s*.{2,}~isu',
        $message,
    ) === 1;
}

function process_whatsapp_outbound_message(
    string $chatId,
    ?string $phone,
    string $name,
    string $messageId,
    string $type,
    string $message,
    string $sentAt,
): void {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $inserted = run(
            'INSERT IGNORE INTO whatsapp_processed_messages (message_id, received_at) VALUES (?, ?)',
            [$messageId, $sentAt],
        );
        if ($inserted->rowCount() === 0) {
            $pdo->commit();
            return;
        }

        $lead = one('SELECT * FROM whatsapp_leads WHERE chat_id=? FOR UPDATE', [$chatId]);
        if (!$lead) {
            $customer = $phone !== null ? find_customer_by_phone($phone) : null;
            $leadId = new_id();
            run(
                'INSERT INTO whatsapp_leads (id, chat_id, phone_e164, customer_id, contact_name, last_message, last_message_at, status, last_admin_reply_at) '
                    . 'VALUES (?, ?, ?, ?, ?, ?, ?, "active", UTC_TIMESTAMP())',
                [$leadId, $chatId, $phone, $customer['id'] ?? null, $name !== '' ? $name : ($customer['full_name'] ?? ''), $message, $sentAt],
            );
            $lead = one('SELECT * FROM whatsapp_leads WHERE id=? FOR UPDATE', [$leadId]);
        }
        if (!$lead) throw new RuntimeException('WhatsApp conversation could not be loaded after an admin reply.');

        $recentEcho = one(
            'SELECT id FROM whatsapp_messages WHERE lead_id=? AND direction="outbound" AND body=? '
                . 'AND created_at>=UTC_TIMESTAMP() - INTERVAL 30 SECOND LIMIT 1',
            [$lead['id'], $message],
        );
        if ($recentEcho) {
                $pdo->commit();
                return;
        }
        run(
                'UPDATE whatsapp_leads SET phone_e164=COALESCE(?, phone_e164), '
                    . 'contact_name=IF(?<>"", ?, contact_name), last_message=IF(? >= last_message_at, ?, last_message), '
                    . 'last_message_at=GREATEST(last_message_at, ?), last_admin_reply_at=UTC_TIMESTAMP(), '
                    . 'auto_followup_due_at=NULL, status="active", updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [$phone, $name, $name, $sentAt, $message, $sentAt, $lead['id']],
        );
        run(
                'INSERT INTO whatsapp_messages (id, lead_id, provider_message_id, direction, message_type, body, created_at) '
                    . 'VALUES (?, ?, ?, "outbound", ?, ?, ?)',
                [new_id(), $lead['id'], $messageId, $type, $message, $sentAt],
        );
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function process_whatsapp_lead(
    string $chatId,
    ?string $phone,
    string $name,
    string $messageId,
    string $type,
    string $message,
    string $receivedAt,
    bool $isBusinessEnquiry,
): void {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        if (
            $phone !== null
            && preg_match('/^\s*(?:stop|unsubscribe|opt\s*out|remove\s*me)[.! ]*$/i', $message) === 1
        ) {
            $customer = find_customer_by_phone($phone);
            if ($customer) run('UPDATE customers SET marketing_opt_in=0 WHERE id=?', [$customer['id']]);
        }
        run('DELETE FROM whatsapp_processed_messages WHERE received_at < UTC_TIMESTAMP() - INTERVAL 30 DAY');
        $inserted = run(
            'INSERT IGNORE INTO whatsapp_processed_messages (message_id, received_at) VALUES (?, ?)',
            [$messageId, $receivedAt],
        );
        if ($inserted->rowCount() === 0) {
            $pdo->commit();
            return;
        }

        $created = run(
            'INSERT IGNORE INTO whatsapp_leads (id, chat_id, phone_e164, contact_name, last_message, last_message_at, status, is_business_enquiry, business_enquiry_at) '
                . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(?, ?, NULL))',
            [
                new_id(), $chatId, $phone, $name, $message, $receivedAt,
                $isBusinessEnquiry ? 'new' : 'active',
                $isBusinessEnquiry ? 1 : 0,
                $isBusinessEnquiry ? 1 : 0,
                $receivedAt,
            ],
        )->rowCount() === 1;
        $existing = one('SELECT * FROM whatsapp_leads WHERE chat_id=? FOR UPDATE', [$chatId]);
        if (!$existing) throw new RuntimeException('WhatsApp lead could not be loaded after saving.');
        $wasBusinessEnquiry = !$created && (bool)$existing['is_business_enquiry'];
        $isNewBusinessEnquiry = $isBusinessEnquiry && ($created || !$wasBusinessEnquiry);
        $status = $existing['status'];
        if ($isBusinessEnquiry && !$wasBusinessEnquiry && empty($existing['last_admin_reply_at'])) $status = 'new';
        if ($isBusinessEnquiry && $existing['status'] === 'closed') $status = 'new';
        if (!$created) {
            run(
                'UPDATE whatsapp_leads SET phone_e164=COALESCE(?, phone_e164), contact_name=IF(?<>"", ?, contact_name), '
                    . 'last_message=IF(? >= last_message_at, ?, last_message), '
                    . 'last_message_at=GREATEST(last_message_at, ?), status=?, '
                    . 'is_business_enquiry=GREATEST(is_business_enquiry, ?), '
                    . 'business_enquiry_at=IF(?=1, COALESCE(business_enquiry_at, ?), business_enquiry_at), '
                    . 'updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [
                    $phone, $name, $name, $receivedAt, $message, $receivedAt, $status,
                    $isBusinessEnquiry ? 1 : 0, $isBusinessEnquiry ? 1 : 0, $receivedAt, $existing['id'],
                ],
            );
        }
        if ($isBusinessEnquiry) {
            run(
                'UPDATE whatsapp_leads SET auto_followup_due_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE), '
                    . 'auto_followup_sent_at=NULL WHERE chat_id=?',
                [$chatId],
            );
        } else {
            run('UPDATE whatsapp_leads SET auto_followup_due_at=NULL WHERE chat_id=?', [$chatId]);
        }
        $lead = one('SELECT * FROM whatsapp_leads WHERE chat_id=?', [$chatId]);
        run(
            'INSERT INTO whatsapp_messages (id, lead_id, provider_message_id, direction, message_type, body, created_at) '
                . 'VALUES (?, ?, ?, "inbound", ?, ?, ?)',
            [new_id(), $lead['id'], $messageId, $type, $message, $receivedAt],
        );
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }

    if (!$lead) throw new RuntimeException('WhatsApp lead was not available after saving.');

    if ($isNewBusinessEnquiry) {
        $chatUrl = whatsapp_chat_url($phone);
        $displayPhone = $phone !== null ? '+' . $phone : $chatId;
        $alertStatus = notify_event(
            admin_email(),
            'whatsapp.lead',
            'New WhatsApp enquiry' . ($name !== '' ? " from $name" : ''),
            "A new WhatsApp enquiry has arrived.\n\n"
                . 'Name: ' . ($name !== '' ? $name : 'Not provided') . "\n"
                . "WhatsApp contact: $displayPhone\n"
                . "Message: $message\n\n"
                . ($chatUrl !== '' ? "Open chat: $chatUrl\n" : '')
                . "Review it in the admin panel under WhatsApp Leads.\n",
            ['leadId' => $lead['id'], 'chatId' => $chatId, 'phone' => $phone, 'message' => $message, 'chatUrl' => $chatUrl],
        );
        if ($alertStatus !== 'sent') {
            error_log('[interserver-api] WhatsApp lead email alert status: ' . $alertStatus);
        }
    }

    if ($isBusinessEnquiry && $lead['status'] === 'new' && claim_whatsapp_auto_reply((string)$lead['id'])) {
        if (send_whatsapp_product_reply($chatId, $name)) {
            run(
                'UPDATE whatsapp_leads SET last_auto_reply_at=UTC_TIMESTAMP(), auto_reply_attempted_at=NULL WHERE id=?',
                [$lead['id']],
            );
        } else {
            error_log('[interserver-api] WhatsApp automatic product reply failed.');
        }
    }
}

function claim_whatsapp_auto_reply(string $leadId): bool
{
    $result = run(
        'UPDATE whatsapp_leads SET auto_reply_attempted_at=UTC_TIMESTAMP() '
            . 'WHERE id=? AND status="new" '
            . 'AND (last_auto_reply_at IS NULL OR last_auto_reply_at < UTC_TIMESTAMP() - INTERVAL 24 HOUR) '
            . 'AND (auto_reply_attempted_at IS NULL OR auto_reply_attempted_at < UTC_TIMESTAMP() - INTERVAL 10 MINUTE)',
        [$leadId],
    );
    return $result->rowCount() === 1;
}

function send_whatsapp_product_reply(string $chatId, string $name): bool
{
    global $config;
    $token = (string)($config['waapi_api_token'] ?? '');
    $instanceId = (string)($config['waapi_instance_id'] ?? '');
    if ($token === '' || !preg_match('/^\d+$/', $instanceId)) {
        error_log('[interserver-api] WaAPI API token or instance id is not configured.');
        return false;
    }

    $products = all(
        'SELECT name, price FROM products WHERE is_active=1 AND stock_quantity>0 ORDER BY created_at DESC LIMIT 3',
    );
    $lines = [];
    foreach ($products as $product) {
        $lines[] = '• ' . text_value($product['name'], 90) . ' — ₹' . number_format((int)$product['price'] / 100, 2);
    }
    $shopBase = trim((string)($config['storefront_url'] ?? ''));
    if (!short_url($shopBase) || strtolower((string)parse_url($shopBase, PHP_URL_SCHEME)) !== 'https') {
        error_log('[interserver-api] A valid HTTPS storefront_url is required for the WhatsApp product reply.');
        return false;
    }
    $shopUrl = rtrim($shopBase, '/') . '/shop';
    $greeting = $name !== '' ? 'Hi ' . $name . "!\n\n" : "Hi!\n\n";
    $body = $greeting . "Thanks for enquiring with 3D Print Co. Here are a few available products:\n";
    $body .= $lines ? implode("\n", $lines) : "Our catalogue is being updated—please browse the shop for availability.\n";
    $body .= "\n\nSee the full catalogue and current prices: " . $shopUrl;

    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Authorization: Bearer $token\r\nAccept: application/json\r\nContent-Type: application/json\r\n",
        'content' => json_encode([
            'chatId' => $chatId,
            'message' => $body,
            'previewLink' => false,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'timeout' => 15,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents(
        'https://waapi.app/api/v1/instances/' . rawurlencode($instanceId) . '/client/action/send-message',
        false,
        $context,
    );
    $status = 0;
    foreach (($http_response_header ?? []) as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) $status = (int)$match[1];
    }
    $result = is_string($response) ? json_decode($response, true) : null;
    if (
        $status >= 200 && $status < 300
        && is_array($result)
        && ($result['status'] ?? '') === 'success'
        && ($result['data']['status'] ?? '') === 'success'
    ) {
        $lead = one('SELECT id FROM whatsapp_leads WHERE chat_id=?', [$chatId]);
        if ($lead) {
            run(
                'UPDATE whatsapp_leads SET last_message=?, last_message_at=UTC_TIMESTAMP(), updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [$body, $lead['id']],
            );
            run(
                'INSERT INTO whatsapp_messages (id, lead_id, direction, message_type, body, created_at) '
                    . 'VALUES (?, ?, "outbound", "chat", ?, UTC_TIMESTAMP())',
                [new_id(), $lead['id'], $body],
            );
        }
        return true;
    }
    error_log('[interserver-api] WaAPI send-message failed with HTTP status ' . $status);
    return false;
}

function whatsapp_chat_url(?string $phone): string
{
    return $phone !== null && preg_match('/^\d{6,20}$/', $phone) ? 'https://wa.me/' . $phone : '';
}

function send_whatsapp_text(string $chatId, string $body): bool
{
    global $config;
    $token = (string)($config['waapi_api_token'] ?? '');
    $instanceId = (string)($config['waapi_instance_id'] ?? '');
    if ($token === '' || !preg_match('/^\d+$/', $instanceId)) {
        error_log('[interserver-api] WaAPI API token or instance id is not configured.');
        return false;
    }

    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => 'Authorization: Bearer ' . $token . "\r\nContent-Type: application/json\r\n",
        'content' => json_encode([
            'chatId' => $chatId,
            'message' => $body,
            'previewLink' => false,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'timeout' => 8,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents(
        'https://waapi.app/api/v1/instances/' . rawurlencode($instanceId) . '/client/action/send-message',
        false,
        $context,
    );
    $status = 0;
    foreach (($http_response_header ?? []) as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) $status = (int)$match[1];
    }
    $result = is_string($response) ? json_decode($response, true) : null;
    if (
        $status >= 200 && $status < 300
        && is_array($result)
        && ($result['status'] ?? '') === 'success'
        && ($result['data']['status'] ?? '') === 'success'
    ) return true;
    error_log('[interserver-api] WaAPI send-message failed with HTTP status ' . $status);
    return false;
}

function send_whatsapp_admin_message(string $chatId, string $name, ?string $phone, string $body): void
{
    $phone = whatsapp_phone_from_chat_id($chatId) ?? $phone;
    if (!send_whatsapp_text($chatId, $body)) {
        fail(502, 'WhatsApp could not send the message. Check the WaAPI connection and try again.');
    }

    record_whatsapp_outbound_message($chatId, $name, $phone, $body);
}

function send_whatsapp_notification(string $phone, string $name, string $body): bool
{
    $digits = preg_replace('/\D/', '', $phone);
    if (!preg_match('/^\d{6,20}$/', (string)$digits)) {
        error_log('[interserver-api] WhatsApp notification skipped for an invalid customer phone number.');
        return false;
    }
    $chatId = whatsapp_chat_id_from_phone($phone);
    if (!send_whatsapp_text($chatId, $body)) return false;
    record_whatsapp_outbound_message($chatId, $name, $phone, $body);
    return true;
}

function record_whatsapp_outbound_message(string $chatId, string $name, ?string $phone, string $body): void
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $lead = one('SELECT * FROM whatsapp_leads WHERE chat_id=? FOR UPDATE', [$chatId]);
        if (!$lead) {
            $leadPhone = $phone ?? whatsapp_phone_from_chat_id($chatId);
            $customer = $leadPhone !== null ? find_customer_by_phone($leadPhone) : null;
            $leadId = new_id();
            run(
                'INSERT INTO whatsapp_leads (id, chat_id, phone_e164, customer_id, contact_name, last_message, last_message_at, status, last_admin_reply_at) '
                    . 'VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), "active", UTC_TIMESTAMP())',
                [$leadId, $chatId, $leadPhone, $customer['id'] ?? null, $name !== '' ? $name : ($customer['full_name'] ?? ''), $body],
            );
            $lead = one('SELECT * FROM whatsapp_leads WHERE id=? FOR UPDATE', [$leadId]);
        } else {
            run(
                'UPDATE whatsapp_leads SET phone_e164=COALESCE(?, phone_e164), '
                    . 'contact_name=IF(?<>"", ?, contact_name), last_message=?, last_message_at=UTC_TIMESTAMP(), '
                    . 'last_admin_reply_at=UTC_TIMESTAMP(), auto_followup_due_at=NULL, status="active", updated_at=CURRENT_TIMESTAMP '
                    . 'WHERE id=?',
                [$phone, $name, $name, $body, $lead['id']],
            );
            $lead = one('SELECT * FROM whatsapp_leads WHERE id=?', [$lead['id']]);
        }
        if (!$lead) throw new RuntimeException('WhatsApp conversation could not be loaded after sending.');
        run(
            'INSERT INTO whatsapp_messages (id, lead_id, direction, message_type, body, created_at) '
                . 'VALUES (?, ?, "outbound", "chat", ?, UTC_TIMESTAMP())',
            [new_id(), $lead['id'], $body],
        );
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function send_due_whatsapp_followups(): int
{
    global $config;
    $leads = all(
        'SELECT id, chat_id FROM whatsapp_leads WHERE is_business_enquiry=1 AND auto_followup_due_at<=UTC_TIMESTAMP() '
            . 'AND auto_followup_sent_at IS NULL ORDER BY auto_followup_due_at LIMIT 25',
    );
    $processed = 0;
    foreach ($leads as $lead) {
        $claim = run(
            'UPDATE whatsapp_leads SET auto_followup_due_at=NULL WHERE id=? AND is_business_enquiry=1 '
                . 'AND auto_followup_due_at<=UTC_TIMESTAMP() AND auto_followup_sent_at IS NULL '
                . 'AND (last_admin_reply_at IS NULL OR last_admin_reply_at<last_message_at)',
            [$lead['id']],
        );
        if ($claim->rowCount() !== 1) continue;

        $shopBase = trim((string)($config['storefront_url'] ?? ''));
        if (!short_url($shopBase) || strtolower((string)parse_url($shopBase, PHP_URL_SCHEME)) !== 'https') {
            error_log('[interserver-api] A valid HTTPS storefront_url is required for the WhatsApp follow-up.');
            run('UPDATE whatsapp_leads SET auto_followup_due_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE) WHERE id=?', [$lead['id']]);
            continue;
        }
        $message = "Just checking in — we're here if you need help with your 3D printing enquiry.\n"
            . 'Browse products and prices: ' . rtrim($shopBase, '/') . '/shop';
        if (send_whatsapp_text((string)$lead['chat_id'], $message)) {
            run(
                'UPDATE whatsapp_leads SET auto_followup_sent_at=UTC_TIMESTAMP(), last_auto_reply_at=UTC_TIMESTAMP(), '
                    . 'last_message=?, last_message_at=UTC_TIMESTAMP(), updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [$message, $lead['id']],
            );
            run(
                'INSERT INTO whatsapp_messages (id, lead_id, direction, message_type, body, created_at) '
                    . 'VALUES (?, ?, "outbound", "chat", ?, UTC_TIMESTAMP())',
                [new_id(), $lead['id'], $message],
            );
            $processed++;
        } else {
            run('UPDATE whatsapp_leads SET auto_followup_due_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE) WHERE id=?', [$lead['id']]);
        }
    }
    return $processed;
}

function whatsapp_phone_from_chat_id(string $chatId): ?string
{
    return preg_match('/^(\d{6,20})@c\.us$/', $chatId, $match) ? $match[1] : null;
}

function whatsapp_chat_id_from_phone(string $phone): string
{
    $digits = preg_replace('/\D/', '', $phone);
    if (strlen((string)$digits) === 10) $digits = '91' . $digits;
    if (strlen((string)$digits) === 11 && str_starts_with((string)$digits, '0')) $digits = '91' . substr((string)$digits, 1);
    if (!preg_match('/^\d{6,20}$/', (string)$digits)) fail(400, 'A valid mobile number with country code is required for WhatsApp.');
    return $digits . '@c.us';
}

function find_customer_by_phone(string $phone): ?array
{
    $digits = preg_replace('/\D/', '', $phone);
    if (!preg_match('/^\d{6,20}$/', (string)$digits)) return null;
    $rows = all('SELECT id, full_name, phone FROM customers WHERE phone LIKE ? ORDER BY updated_at DESC LIMIT 50', ['%' . substr((string)$digits, -10) . '%']);
    foreach ($rows as $customer) {
        if (preg_replace('/\D/', '', (string)$customer['phone']) === $digits) return $customer;
    }
    return null;
}

function link_whatsapp_leads_to_customer(string $customerId, string $phone, string $name, ?string $orderId = null): void
{
    $digits = preg_replace('/\D/', '', $phone);
    if (!preg_match('/^\d{6,20}$/', (string)$digits)) return;
    $candidates = [(string)$digits];
    if (strlen((string)$digits) === 10) $candidates[] = '91' . $digits;
    if (strlen((string)$digits) === 12 && str_starts_with((string)$digits, '91')) $candidates[] = substr((string)$digits, 2);
    $placeholders = implode(',', array_fill(0, count($candidates), '?'));
    $leads = all("SELECT id FROM whatsapp_leads WHERE phone_e164 IN ($placeholders)", $candidates);
    foreach ($leads as $lead) {
        run(
            'UPDATE whatsapp_leads SET customer_id=?, contact_name=IF(contact_name="", ?, contact_name), '
                . 'converted_at=IF(? IS NULL, converted_at, COALESCE(converted_at, UTC_TIMESTAMP())), '
                . 'conversion_order_id=COALESCE(conversion_order_id, ?), updated_at=CURRENT_TIMESTAMP WHERE id=?',
            [$customerId, $name, $orderId, $orderId, $lead['id']],
        );
    }
}
