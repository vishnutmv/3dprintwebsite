<?php
declare(strict_types=1);

function handle_whatsapp(string $path): bool
{
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
    if (!empty($message['fromMe']) || !empty($message['isStatus']) || !empty($message['broadcast'])) {
        respond(200, ['received' => true, 'ignored' => true]);
    }

    $chatId = text_value($message['from'] ?? '', 120);
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

    process_whatsapp_lead(
        $chatId,
        str_ends_with($chatId, '@c.us') ? substr($chatId, 0, -5) : null,
        text_value($message['notifyName'] ?? '', 120),
        $messageId,
        $body,
        $timestamp,
    );
    respond(200, ['received' => true]);
}

function process_whatsapp_lead(
    string $chatId,
    ?string $phone,
    string $name,
    string $messageId,
    string $message,
    string $receivedAt,
): void {
    $pdo = db();
    $pdo->beginTransaction();
    try {
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
            'INSERT IGNORE INTO whatsapp_leads (id, chat_id, phone_e164, contact_name, last_message, last_message_at, status) VALUES (?, ?, ?, ?, ?, ?, "new")',
            [new_id(), $chatId, $phone, $name, $message, $receivedAt],
        )->rowCount() === 1;
        $existing = one('SELECT * FROM whatsapp_leads WHERE chat_id=? FOR UPDATE', [$chatId]);
        if (!$existing) throw new RuntimeException('WhatsApp lead could not be loaded after saving.');
        $isNew = $created || $existing['status'] === 'closed';
        if (!$created) {
            $status = $existing['status'] === 'closed' ? 'new' : $existing['status'];
            run(
                'UPDATE whatsapp_leads SET phone_e164=COALESCE(?, phone_e164), contact_name=IF(?<>"", ?, contact_name), '
                    . 'last_message=IF(? >= last_message_at, ?, last_message), '
                    . 'last_message_at=GREATEST(last_message_at, ?), status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [$phone, $name, $name, $receivedAt, $message, $receivedAt, $status, $existing['id']],
            );
        }
        $lead = one('SELECT * FROM whatsapp_leads WHERE chat_id=?', [$chatId]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }

    if (!$lead) throw new RuntimeException('WhatsApp lead was not available after saving.');

    if ($isNew) {
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

    if ($lead['status'] === 'new' && claim_whatsapp_auto_reply((string)$lead['id'])) {
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
    ) return true;
    error_log('[interserver-api] WaAPI send-message failed with HTTP status ' . $status);
    return false;
}

function whatsapp_chat_url(?string $phone): string
{
    return $phone !== null && preg_match('/^\d{6,20}$/', $phone) ? 'https://wa.me/' . $phone : '';
}
