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
    $query = whatsapp_enquiry_query($message);
    return $query !== null && (
        whatsapp_query_matches_catalogue($query)
        || preg_match('/\?|\b(help|enquir|question|need|want|looking|interested|quote|request|please|tell me|show me|send me|share|what|how|where|when|who|can i|can you|could you|do you|is there|are there)\b/i', $query) === 1
    );
}

function whatsapp_enquiry_query(string $message): ?string
{
    $matched = preg_match(
        '~(?<![\p{L}\p{N}])(?:[@/]\s*)?3\s*d\s*print\s*co(?:mpany)?\.?(?![\p{L}\p{N}])'
        . '\s*(?:[,:\-]\s*)?(.+)$~isu',
        $message,
        $match,
    );
    if ($matched !== 1) return null;
    $query = trim((string)$match[1], " \t\n\r\0\x0B,.:;!?-–—");
    return mb_strlen($query) >= 2 ? $query : null;
}

function whatsapp_query_matches_catalogue(string $query): bool
{
    return preg_match(
        '/\b(product|price|cost|catalog(?:ue)?|print(?:ing)?|custom|order|model|item|delivery|shipping|available|buy|purchase|how much|design)\b/i',
        $query,
    ) === 1;
}

function whatsapp_phone_from_message(string $message): ?string
{
    if (!preg_match('/(?<!\d)(?:\+?91[\s.-]?)?0?[6-9]\d{9}(?!\d)/', $message, $match)) return null;
    $digits = preg_replace('/\D/', '', $match[0]);
    if (strlen((string)$digits) === 11 && str_starts_with((string)$digits, '0')) $digits = substr((string)$digits, 1);
    if (strlen((string)$digits) === 10) $digits = '91' . $digits;
    return preg_match('/^91[6-9]\d{9}$/', (string)$digits) ? (string)$digits : null;
}

function whatsapp_name_from_message(string $message): ?string
{
    if (!preg_match(
        '/(?:my name is|name\s*[:=-])\s*([\p{L}][\p{L} .\'-]{1,60}?)(?=\s+(?:and|i need|i want|looking|for|phone|mobile|my number)\b|[,;.!]|$)/iu',
        $message,
        $match,
    )) return null;
    $name = trim((string)$match[1]);
    return mb_strlen($name) >= 2 ? $name : null;
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
    $message = whatsapp_safe_message($message);
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
    if ($name === '') $name = whatsapp_name_from_message($message) ?? '';
    if ($phone === null) $phone = whatsapp_phone_from_message($message);
    $knownCustomer = $phone !== null ? find_customer_by_phone($phone) : null;
    if ($knownCustomer === null) {
        $knownCustomer = one(
            'SELECT c.id, c.full_name, c.phone FROM whatsapp_leads l JOIN customers c ON c.id=l.customer_id WHERE l.chat_id=?',
            [$chatId],
        );
    }
    if (
        $knownCustomer !== null
        && $type === 'chat'
        && trim($message) !== ''
        && preg_match('/^\s*(?:stop|unsubscribe|opt\s*out|remove\s*me)[.! ]*$/i', $message) !== 1
    ) $isBusinessEnquiry = true;
    $storedMessage = whatsapp_safe_message($message);
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
            'INSERT IGNORE INTO whatsapp_leads (id, chat_id, phone_e164, customer_id, contact_name, last_message, last_message_at, status, is_business_enquiry, is_existing_customer, business_enquiry_at, enquiry_interest) '
                . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(?, ?, NULL), ?)',
            [
                new_id(), $chatId, $phone, $knownCustomer['id'] ?? null, $name !== '' ? $name : ($knownCustomer['full_name'] ?? ''), $storedMessage, $receivedAt,
                $isBusinessEnquiry ? 'new' : 'active',
                $isBusinessEnquiry ? 1 : 0,
                $knownCustomer ? 1 : 0,
                $isBusinessEnquiry ? 1 : 0,
                $receivedAt,
                $isBusinessEnquiry ? whatsapp_enquiry_query($message) : null,
            ],
        )->rowCount() === 1;
        $existing = one('SELECT * FROM whatsapp_leads WHERE chat_id=? FOR UPDATE', [$chatId]);
        if (!$existing) throw new RuntimeException('WhatsApp lead could not be loaded after saving.');
        $wasBusinessEnquiry = !$created && (bool)$existing['is_business_enquiry'];
        $isNewBusinessEnquiry = $isBusinessEnquiry && ($created || !$wasBusinessEnquiry);
        $status = $existing['status'];
        if ($isBusinessEnquiry && !$wasBusinessEnquiry) $status = 'new';
        if ($isBusinessEnquiry && $existing['status'] === 'closed') $status = 'new';
        if (!$created) {
            run(
                'UPDATE whatsapp_leads SET phone_e164=COALESCE(?, phone_e164), customer_id=COALESCE(customer_id, ?), '
                    . 'is_existing_customer=GREATEST(is_existing_customer, ?), '
                    . 'contact_name=IF(?<>"", ?, contact_name), '
                    . 'last_message=IF(? >= last_message_at, ?, last_message), '
                    . 'last_message_at=GREATEST(last_message_at, ?), status=?, '
                    . 'is_business_enquiry=GREATEST(is_business_enquiry, ?), '
                    . 'business_enquiry_at=IF(?=1, COALESCE(business_enquiry_at, ?), business_enquiry_at), '
                    . 'enquiry_interest=IF(?<>"", ?, enquiry_interest), '
                    . 'updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [
                    $phone, $knownCustomer['id'] ?? null, $knownCustomer ? 1 : 0,
                    $name !== '' ? $name : ($knownCustomer['full_name'] ?? ''),
                    $name !== '' ? $name : ($knownCustomer['full_name'] ?? ''),
                    $receivedAt, $storedMessage, $receivedAt, $status,
                    $isBusinessEnquiry ? 1 : 0, $isBusinessEnquiry ? 1 : 0, $receivedAt,
                    $isBusinessEnquiry ? (whatsapp_enquiry_query($message) ?? '') : '',
                    $isBusinessEnquiry ? (whatsapp_enquiry_query($message) ?? '') : '',
                    $existing['id'],
                ],
            );
        } elseif ($knownCustomer && empty($existing['customer_id'])) {
            run(
                'UPDATE whatsapp_leads SET customer_id=?, is_existing_customer=1, '
                    . 'contact_name=IF(contact_name="", ?, contact_name) WHERE id=?',
                [$knownCustomer['id'], $knownCustomer['full_name'], $existing['id']],
            );
        }
        if ($isBusinessEnquiry && $existing['details_requested_at'] === null) {
            run(
                'UPDATE whatsapp_leads SET details_requested_at=COALESCE(details_requested_at, UTC_TIMESTAMP()) WHERE id=?',
                [$existing['id']],
            );
        } elseif (
            !$isBusinessEnquiry
            && (bool)$existing['is_business_enquiry']
            && !preg_match('/^\s*(?:stop|unsubscribe|opt\s*out|remove\s*me)[.! ]*$/i', $message)
        ) {
            $detail = mb_substr(trim($storedMessage), 0, 1000);
            $interest = trim((string)($existing['enquiry_interest'] ?? ''));
            $interest = mb_substr($interest === '' ? $detail : $interest . "\n---\n" . $detail, -2500);
            run(
                'UPDATE whatsapp_leads SET enquiry_interest=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [$interest, $existing['id']],
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
            [new_id(), $lead['id'], $messageId, $type, $storedMessage, $receivedAt],
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
        $replyName = $name !== '' ? $name : (string)($knownCustomer['full_name'] ?? '');
        if (send_whatsapp_product_reply($chatId, $replyName, (string)(whatsapp_enquiry_query($message) ?? ''), $phone)) {
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
            . 'AND (last_auto_reply_at IS NULL OR last_auto_reply_at < UTC_TIMESTAMP() - INTERVAL 5 MINUTE) '
            . 'AND (auto_reply_attempted_at IS NULL OR auto_reply_attempted_at < UTC_TIMESTAMP() - INTERVAL 10 MINUTE)',
        [$leadId],
    );
    return $result->rowCount() === 1;
}

function whatsapp_safe_message(string $message): string
{
    $safe = preg_replace(
        '/\b(?:otp|(?:sign[\s-]?in|verification|login|one[- ]time)?\s*code)\b\D{0,30}\d{6}\b/i',
        '[one-time code redacted]',
        $message,
    );
    return is_string($safe) ? $safe : '[message redacted]';
}

function send_whatsapp_product_reply(string $chatId, string $name, string $query, ?string $phone): bool
{
    global $config;
    $token = (string)($config['waapi_api_token'] ?? '');
    $instanceId = (string)($config['waapi_instance_id'] ?? '');
    if ($token === '' || !preg_match('/^\d+$/', $instanceId)) {
        error_log('[interserver-api] WaAPI API token or instance id is not configured.');
        return false;
    }

    $products = all(
        'SELECT * FROM products WHERE is_active=1 AND stock_quantity>0 ORDER BY created_at DESC LIMIT 3',
    );
    $lines = [];
    foreach ($products as $product) {
        $lines[] = '• ' . text_value($product['name'], 90) . ' — ₹' . number_format(active_product_price($product) / 100, 2);
    }
    $shopBase = trim((string)($config['storefront_url'] ?? ''));
    if (!short_url($shopBase) || strtolower((string)parse_url($shopBase, PHP_URL_SCHEME)) !== 'https') {
        error_log('[interserver-api] A valid HTTPS storefront_url is required for the WhatsApp product reply.');
        return false;
    }
    $shopUrl = rtrim($shopBase, '/') . '/shop';
    $greeting = $name !== '' ? 'Hi ' . $name . ",\n\n" : "Hello,\n\n";
    if (whatsapp_query_matches_catalogue($query)) {
        $body = $greeting . "Thanks for contacting 3D Print Co. Here are a few available products:\n\n";
        $body .= $lines ? implode("\n", $lines) : "Our catalogue is being updated.\n";
        $body .= "\nBrowse the full catalogue and current prices:\n" . $shopUrl;
    } else {
        $body = $greeting . "Thanks for contacting 3D Print Co. I couldn't match that request to our catalogue automatically.\n\n";
        $body .= "Please check our products and prices here:\n" . $shopUrl;
    }
    $body .= "\n\nTo help us follow up:";
    if ($name === '') $body .= "\n- Your name";
    $body .= "\n- The product or service you need";
    if ($phone !== null) {
        $body .= "\nWe received your WhatsApp number ending in " . substr($phone, -4) . '.';
    } else {
        $body .= "\n- A mobile number where we can reach you";
    }
    $body .= "\n\nA team member will review your enquiry.";

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
        $storedBody = whatsapp_safe_message($body);
        $lead = one('SELECT id FROM whatsapp_leads WHERE chat_id=?', [$chatId]);
        if ($lead) {
            run(
                'UPDATE whatsapp_leads SET last_message=?, last_message_at=UTC_TIMESTAMP(), updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [$storedBody, $lead['id']],
            );
            run(
                'INSERT INTO whatsapp_messages (id, lead_id, direction, message_type, body, created_at) '
                    . 'VALUES (?, ?, "outbound", "chat", ?, UTC_TIMESTAMP())',
                [new_id(), $lead['id'], $storedBody],
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

/**
 * A business enquiry is overdue when its latest customer message has not been
 * answered by a human within five minutes. Automated replies also update
 * last_message_at, so the inbound message time is used as the clock.
 */
function whatsapp_overdue_sql(string $alias = 'l'): string
{
    $inbound = '(SELECT MAX(m.created_at) FROM whatsapp_messages m WHERE m.lead_id=' . $alias . '.id AND m.direction="inbound")';
    return '(' . $alias . '.is_business_enquiry=1 AND ' . $alias . '.status<>"closed"'
        . ' AND COALESCE(' . $inbound . ',' . $alias . '.last_message_at)<=UTC_TIMESTAMP()-INTERVAL 5 MINUTE'
        . ' AND (' . $alias . '.last_admin_reply_at IS NULL OR '
        . $alias . '.last_admin_reply_at<COALESCE(' . $inbound . ',' . $alias . '.last_message_at)))';
}

function whatsapp_awaiting_admin_since(array $lead, ?string $lastInboundAt = null): ?string
{
    if (!(bool)($lead['is_business_enquiry'] ?? false) || ($lead['status'] ?? '') === 'closed') return null;
    $lastInbound = $lastInboundAt ?? ($lead['last_message_at'] ?? null);
    if ($lastInbound === null || $lastInbound === '') return null;
    $reply = $lead['last_admin_reply_at'] ?? null;
    if ($reply !== null && $reply !== '' && strtotime((string)$reply) >= strtotime((string)$lastInbound)) return null;
    return (string)$lastInbound;
}

function send_whatsapp_media(string $chatId, string $mediaBase64, string $mediaName, string $caption): bool
{
    return send_whatsapp_media_payload($chatId, [
        'mediaBase64' => $mediaBase64,
        'mediaName' => $mediaName,
    ], $caption);
}

function send_whatsapp_media_url(string $chatId, string $mediaUrl, string $caption): bool
{
    if (!short_url($mediaUrl) || strtolower((string)parse_url($mediaUrl, PHP_URL_SCHEME)) !== 'https') return false;
    return send_whatsapp_media_payload($chatId, ['mediaUrl' => $mediaUrl], $caption);
}

function send_whatsapp_media_payload(string $chatId, array $media, string $caption): bool
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
        'content' => json_encode(
            array_merge(['chatId' => $chatId, 'caption' => $caption], $media),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        ),
        'timeout' => 15,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents(
        'https://waapi.app/api/v1/instances/' . rawurlencode($instanceId) . '/client/action/send-media',
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
    error_log('[interserver-api] WaAPI send-media failed with HTTP status ' . $status);
    return false;
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
    $body = whatsapp_safe_message($body);
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
        $message = "Thanks for your message. Your query will be answered shortly by our team.\n"
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
    $candidates = whatsapp_phone_candidates((string)$digits);
    $rows = all(
        "SELECT id, full_name, phone FROM customers "
        . "WHERE RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,'+',''),' ',''),'-',''),'(',''),')',''),'.',''),10)=? "
        . 'ORDER BY updated_at DESC',
        [substr((string)$digits, -10)],
    );
    foreach ($rows as $customer) {
        if (array_intersect($candidates, whatsapp_phone_candidates((string)preg_replace('/\D/', '', (string)$customer['phone'])))) return $customer;
    }
    return null;
}

function whatsapp_phone_candidates(string $digits): array
{
    $candidates = [$digits];
    if (strlen($digits) === 10) $candidates[] = '91' . $digits;
    if (strlen($digits) === 11 && $digits[0] === '0') $candidates[] = '91' . substr($digits, 1);
    if (strlen($digits) === 12 && str_starts_with($digits, '91')) $candidates[] = substr($digits, 2);
    return array_values(array_unique($candidates));
}

function link_whatsapp_leads_to_customer(string $customerId, string $phone, string $name, ?string $orderId = null): void
{
    $digits = preg_replace('/\D/', '', $phone);
    if (!preg_match('/^\d{6,20}$/', (string)$digits)) return;
    $candidates = whatsapp_phone_candidates((string)$digits);
    $placeholders = implode(',', array_fill(0, count($candidates), '?'));
    $leads = all(
        "SELECT id,converted_at FROM whatsapp_leads WHERE phone_e164 IN ($placeholders) AND is_business_enquiry=1 AND is_existing_customer=0 "
        . 'ORDER BY (converted_at IS NOT NULL) DESC,business_enquiry_at ASC,created_at ASC',
        $candidates,
    );
    $conversionLeadId = null;
    foreach ($leads as $lead) {
        if ($lead['converted_at'] !== null) {
            $conversionLeadId = $lead['id'];
            break;
        }
    }
    if ($conversionLeadId === null && $orderId !== null && $leads) $conversionLeadId = $leads[0]['id'];
    foreach ($leads as $lead) {
        if ($lead['id'] === $conversionLeadId) {
            run(
                'UPDATE whatsapp_leads SET customer_id=?, contact_name=IF(contact_name="", ?, contact_name), '
                    . 'converted_at=COALESCE(converted_at, UTC_TIMESTAMP()), conversion_order_id=COALESCE(conversion_order_id, ?), '
                    . 'updated_at=CURRENT_TIMESTAMP WHERE id=? AND is_existing_customer=0',
                [$customerId, $name, $orderId, $lead['id']],
            );
        } else {
            run(
                'UPDATE whatsapp_leads SET customer_id=?, contact_name=IF(contact_name="", ?, contact_name), '
                    . 'is_existing_customer=1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND is_existing_customer=0',
                [$customerId, $name, $lead['id']],
            );
        }
    }
}
