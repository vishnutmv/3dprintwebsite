<?php
declare(strict_types=1);

/**
 * Live courier tracking through TrackCourier.io.
 *
 * The admin stores a courier slug and AWB on the order; the customer profile
 * asks for the current checkpoints. Responses are cached on the order so a page
 * refresh does not spend another lookup, and so a provider outage still shows
 * the last known position instead of an empty timeline.
 */

/** Couriers the store uses, plus the provider's slugs for the admin picker. */
function tracking_couriers(): array
{
    return [
        'delhivery' => 'Delhivery',
        'dtdc' => 'DTDC',
        'bluedart' => 'Blue Dart',
        'speedpost' => 'Speed Post',
        'indiapost' => 'India Post',
        'xpressbees' => 'XpressBees',
        'ekart' => 'Ekart Logistics',
        'shadowfax' => 'Shadowfax',
        'professional' => 'Professional Courier',
        'trackon' => 'Trackon Courier',
        'shreetirupati' => 'Shree Tirupati Courier',
        'stcourier' => 'ST Courier',
        'shreemaruti' => 'Shree Maruti',
        'gati' => 'Gati',
        'shiprocket' => 'Shiprocket',
        'vrl' => 'VRL Logistics',
    ];
}

function tracking_slug(string $value): string
{
    $slug = strtolower(trim($value));
    return preg_match('/^[a-z0-9-]{2,40}$/', $slug) === 1 ? $slug : '';
}

function tracking_reference(string $value): string
{
    $reference = strtoupper((string)preg_replace('/\s+/', '', trim($value)));
    return preg_match('/^[A-Z0-9-]{4,40}$/', $reference) === 1 ? $reference : '';
}

function tracking_courier_name(string $slug): string
{
    return tracking_couriers()[$slug] ?? ucwords(str_replace('-', ' ', $slug));
}

/** Older databases may not have run migration 0016 yet. */
function tracking_columns_ready(): bool
{
    static $ready = null;
    if ($ready !== null) return $ready;
    try {
        $ready = one("SHOW COLUMNS FROM orders LIKE 'tracking_number'") !== null;
    } catch (Throwable $error) {
        error_log('[interserver-api] Could not inspect order tracking columns: ' . $error->getMessage());
        $ready = false;
    }
    return $ready;
}

function trackcourier_api_key(): string
{
    global $config;
    return trim((string)($config['trackcourier_api_key'] ?? ''));
}

/** Map the provider's wording onto the five states the storefront shows. */
function tracking_normalize_state(string $value): string
{
    $text = strtolower($value);
    if ($text === '') return 'unknown';
    if (str_contains($text, 'out for delivery') || str_contains($text, 'out_for_delivery')) return 'out_for_delivery';
    if (str_contains($text, 'delivered')) return 'delivered';
    if (str_contains($text, 'rto') || str_contains($text, 'return') || str_contains($text, 'fail')
        || str_contains($text, 'exception') || str_contains($text, 'refused') || str_contains($text, 'undelivered')) return 'exception';
    if (str_contains($text, 'transit') || str_contains($text, 'ship') || str_contains($text, 'dispatch')
        || str_contains($text, 'picked') || str_contains($text, 'reached') || str_contains($text, 'arrived')) return 'in_transit';
    if (str_contains($text, 'pending') || str_contains($text, 'booked') || str_contains($text, 'manifest')
        || str_contains($text, 'created') || str_contains($text, 'awaited')) return 'pending';
    return 'unknown';
}

function tracking_state_label(string $state): string
{
    return [
        'pending' => 'Waiting for pickup',
        'in_transit' => 'In transit',
        'out_for_delivery' => 'Out for delivery',
        'delivered' => 'Delivered',
        'exception' => 'Delivery issue',
        'unknown' => 'Tracking received',
    ][$state] ?? 'Tracking received';
}

/**
 * One provider lookup. Returns ['ok' => true, 'data' => [...]] or
 * ['ok' => false, 'reason' => 'not_configured'|'unavailable'|'config'].
 */
function trackcourier_lookup(string $courier, string $number): array
{
    $key = trackcourier_api_key();
    if ($key === '') return ['ok' => false, 'reason' => 'not_configured'];
    $query = http_build_query(['courier' => $courier, 'tracking_number' => $number]);
    $context = stream_context_create(['http' => [
        'method' => 'GET',
        'header' => "X-API-Key: " . $key . "\r\nAccept: application/json\r\n",
        'timeout' => 20,
        'ignore_errors' => true,
    ]]);
    $raw = @file_get_contents('https://api.trackcourier.io/v1/track?' . $query, false, $context);
    $status = 0;
    foreach (($http_response_header ?? []) as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) $status = (int)$match[1];
    }
    $decoded = is_string($raw) ? json_decode($raw, true) : null;

    // 202 means an async courier is still being queried; the next refresh fills it in.
    if ($status === 202) {
        return ['ok' => true, 'data' => [
            'state' => 'pending', 'mostRecentStatus' => 'The courier is preparing this shipment.',
            'estimatedDelivery' => null, 'originCity' => null, 'destinationCity' => null,
            'checkpoints' => [],
        ]];
    }
    if (!is_array($decoded)) {
        error_log('[interserver-api] TrackCourier returned an unreadable response (' . $status . ').');
        return ['ok' => false, 'reason' => 'unavailable'];
    }
    if ($status < 200 || $status >= 300 || empty($decoded['success'])) {
        $code = (string)($decoded['error']['code'] ?? 'UNKNOWN');
        error_log('[interserver-api] TrackCourier error ' . $code . ' (' . $status . ').');
        $reason = in_array($code, ['INVALID_API_KEY', 'QUOTA_EXCEEDED', 'NO_SHIPMENTS_LEFT', 'ACCOUNT_NEEDS_ATTENTION'], true)
            ? 'config'
            : 'unavailable';
        return ['ok' => false, 'reason' => $reason];
    }

    $data = is_array($decoded['data'] ?? null) ? $decoded['data'] : [];
    $checkpoints = [];
    foreach ((array)($data['checkpoints'] ?? []) as $checkpoint) {
        if (!is_array($checkpoint)) continue;
        $checkpoints[] = [
            'at' => utc_iso((string)($checkpoint['timestamp'] ?? '')) ?? (string)($checkpoint['timestamp'] ?? ''),
            'location' => text_value($checkpoint['location'] ?? '', 120),
            'status' => text_value($checkpoint['status'] ?? '', 240),
            'rawStatus' => text_value($checkpoint['raw_status'] ?? '', 40),
        ];
    }
    usort($checkpoints, static fn(array $a, array $b): int => strcmp($a['at'], $b['at']));
    $state = tracking_normalize_state((string)($data['status'] ?? $data['ShipmentState'] ?? ''));
    if ($state === 'unknown' && $checkpoints !== []) {
        $state = tracking_normalize_state((string)end($checkpoints)['status']);
    }
    $mostRecent = text_value($data['MostRecentStatus'] ?? $data['status'] ?? '', 240);
    if ($mostRecent === '' && $checkpoints !== []) $mostRecent = (string)end($checkpoints)['status'];
    return ['ok' => true, 'data' => [
        'state' => $state,
        'mostRecentStatus' => $mostRecent,
        'estimatedDelivery' => text_value($data['estimated_delivery'] ?? '', 40) ?: null,
        'originCity' => text_value($data['origin_city'] ?? '', 80) ?: null,
        'destinationCity' => text_value($data['destination_city'] ?? '', 80) ?: null,
        'checkpoints' => $checkpoints,
    ]];
}

/** Cache a successful lookup on the order. Missing columns must never break the page. */
function trackcourier_remember(array $order, array $snapshot): void
{
    if (!tracking_columns_ready()) return;
    try {
        run(
            'UPDATE orders SET tracking_synced_at=UTC_TIMESTAMP(), tracking_payload=? WHERE id=?',
            [json_encode($snapshot, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE), $order['id']],
        );
    } catch (Throwable $error) {
        error_log('[interserver-api] Could not cache courier tracking: ' . $error->getMessage());
    }
}

function tracking_snapshot(array $order, bool $force = false): array
{
    $number = tracking_reference((string)($order['tracking_number'] ?? ''));
    $courier = tracking_slug((string)($order['courier_slug'] ?? ''));
    $apiReady = trackcourier_api_key() !== '';
    $snapshot = [
        'configured' => $number !== '' && $courier !== '',
        'apiReady' => $apiReady,
        'courier' => $courier,
        'courierName' => $courier !== '' ? tracking_courier_name($courier) : '',
        'trackingNumber' => $number,
        'state' => 'unknown',
        'statusLabel' => 'Not shipped yet',
        'mostRecentStatus' => '',
        'estimatedDelivery' => null,
        'originCity' => null,
        'destinationCity' => null,
        'checkpoints' => [],
        'syncedAt' => null,
        'stale' => false,
        'message' => '',
    ];
    if (!$snapshot['configured']) {
        $snapshot['message'] = 'The courier and tracking number are added once your parcel is handed over.';
        return $snapshot;
    }

    $cached = null;
    $payload = $order['tracking_payload'] ?? null;
    if (is_array($payload)) $cached = $payload;
    elseif (is_string($payload) && $payload !== '') {
        $decoded = json_decode($payload, true);
        if (is_array($decoded)) $cached = $decoded;
    }
    $syncedAt = $order['tracking_synced_at'] ?? null;
    $fresh = is_array($cached)
        && is_string($syncedAt) && $syncedAt !== ''
        && (time() - (int)strtotime($syncedAt . ' UTC')) < 300
        && ($cached['state'] ?? '') !== 'delivered';
    if (is_array($cached)) {
        $snapshot = array_merge($snapshot, array_intersect_key($cached, $snapshot));
        $snapshot['syncedAt'] = $syncedAt ? utc_iso($syncedAt) : null;
    }
    if ($fresh && !$force) {
        $snapshot['statusLabel'] = tracking_state_label($snapshot['state']);
        return $snapshot;
    }
    if (!$apiReady) {
        $snapshot['stale'] = is_array($cached);
        $snapshot['statusLabel'] = is_array($cached) ? tracking_state_label($snapshot['state']) : 'Tracking not configured';
        $snapshot['message'] = 'Live courier updates are not enabled on the server yet.';
        return $snapshot;
    }

    $result = trackcourier_lookup($courier, $number);
    if (!$result['ok']) {
        $snapshot['stale'] = is_array($cached);
        $snapshot['statusLabel'] = is_array($cached) ? tracking_state_label($snapshot['state']) : 'Tracking unavailable';
        $snapshot['message'] = $result['reason'] === 'config'
            ? 'The tracking service needs attention. Please contact the store.'
            : 'The courier has not answered yet. This updates automatically; try again in a minute.';
        return $snapshot;
    }

    $snapshot = array_merge($snapshot, $result['data']);
    $snapshot['statusLabel'] = tracking_state_label($snapshot['state']);
    $snapshot['syncedAt'] = gmdate('Y-m-d\TH:i:s\Z');
    $snapshot['stale'] = false;
    $snapshot['message'] = '';
    trackcourier_remember($order, [
        'state' => $snapshot['state'],
        'mostRecentStatus' => $snapshot['mostRecentStatus'],
        'estimatedDelivery' => $snapshot['estimatedDelivery'],
        'originCity' => $snapshot['originCity'],
        'destinationCity' => $snapshot['destinationCity'],
        'checkpoints' => $snapshot['checkpoints'],
    ]);
    return $snapshot;
}
