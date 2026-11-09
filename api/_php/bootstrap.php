<?php
declare(strict_types=1);

$configPath = __DIR__ . '/../config.php';
if (!is_file($configPath)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'InterServer API is not configured. Create api/config.php from config.example.php.']);
    exit;
}
$config = require $configPath;

ini_set('display_errors', '0');
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(int $status, string $message): never
{
    respond($status, ['error' => $message]);
}

function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) fail(400, 'Invalid JSON payload.');
    return $data;
}

function db(): PDO
{
    static $pdo = null;
    global $config;
    if ($pdo instanceof PDO) return $pdo;
    try {
        $pdo = new PDO(
            'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'] . ';charset=utf8mb4',
            $config['db_user'],
            $config['db_password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    } catch (Throwable $e) {
        error_log('[interserver-api] database connection failed: ' . $e->getMessage());
        fail(503, 'Database is unavailable. Check the InterServer API configuration.');
    }
    return $pdo;
}

function run(string $sql, array $values = []): PDOStatement
{
    $statement = db()->prepare($sql);
    $statement->execute($values);
    return $statement;
}

function one(string $sql, array $values = []): ?array
{
    $row = run($sql, $values)->fetch();
    return $row === false ? null : $row;
}

function all(string $sql, array $values = []): array
{
    return run($sql, $values)->fetchAll();
}

function new_id(): string
{
    $hex = bin2hex(random_bytes(16));
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3)
        . '-a' . substr($hex, 17, 3) . '-' . substr($hex, 20, 12);
}

function text_value(mixed $value, int $max = 500): string
{
    return is_string($value) ? mb_substr(trim($value), 0, $max) : '';
}

function json_array(?string $value, array $fallback = []): array
{
    if (!$value) return $fallback;
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function product_out(array $row): array
{
    $images = is_array($row['images'] ?? null) ? $row['images'] : json_array($row['images'] ?? null);
    $specs = is_array($row['specifications'] ?? null) ? $row['specifications'] : json_array($row['specifications'] ?? null);
    $result = [
        'id' => $row['id'], 'slug' => $row['slug'], 'name' => $row['name'],
        'category' => $row['category'], 'price' => (int)$row['price'],
        'description' => $row['description'], 'material' => $row['material'],
        'dimensions' => $row['dimensions'], 'printTime' => $row['print_time'],
        'stock' => (int)$row['stock_quantity'], 'variant' => $row['variant'],
        'accent' => $row['accent'], 'imageUrl' => $images[0] ?? null,
        'images' => $images, 'specifications' => $specs,
        'rating' => (float)$row['rating'], 'reviews' => (int)$row['reviews'],
    ];
    foreach (['mrp' => 'mrp', 'badge' => 'badge', 'video_url' => 'videoUrl', 'model_url' => 'modelUrl'] as $key => $output) {
        if ($row[$key] !== null && $row[$key] !== '') {
            $result[$output] = $key === 'mrp' ? (int)$row[$key] : $row[$key];
        }
    }
    if (array_key_exists('is_active', $row)) {
        $result['active'] = (bool)$row['is_active'];
        $result['createdAt'] = $row['created_at'] ?? null;
        $result['updatedAt'] = $row['updated_at'] ?? null;
    }
    return $result;
}

function prize_out(array $row, bool $public = false): array
{
    $media = is_array($row['media_urls'] ?? null) ? $row['media_urls'] : json_array($row['media_urls'] ?? null);
    $result = [
        'id' => $row['id'], 'title' => $row['title'], 'description' => $row['description'],
        'prizeType' => $row['prize_type'], 'worth' => (int)$row['worth'],
        'sponsor' => $row['sponsor'], 'cycle' => $row['cycle'], 'status' => $row['status'],
        'mediaUrls' => $media,
    ];
    if (!$public) {
        $result['tier'] = $row['prize_type'];
        if ($row['voucher_code']) $result['voucherCode'] = $row['voucher_code'];
        $result['active'] = (bool)$row['is_active'];
        $result['createdAt'] = $row['created_at'];
        $result['updatedAt'] = $row['updated_at'];
    }
    return $result;
}

function customer_out(array $row): array
{
    return [
        'id' => $row['customer_code'], 'customerCode' => $row['customer_code'],
        'name' => $row['full_name'], 'customerName' => $row['full_name'],
        'fullName' => $row['full_name'], 'email' => $row['email'] ?? '',
        'phone' => $row['phone'], 'address' => $row['delivery_address'] ?? '',
        'city' => $row['city'] ?? '', 'state' => $row['state'] ?? '',
        'postalCode' => $row['postal_code'] ?? '', 'pin' => $row['postal_code'] ?? '',
        'joinedAt' => $row['created_at'],
    ];
}

function order_out(array $order, array $customer, array $items): array
{
    return [
        'id' => $order['order_number'], 'orderNumber' => $order['order_number'],
        'customerId' => $customer['customer_code'] ?? '', 'customerCode' => $customer['customer_code'] ?? '',
        'customerName' => $customer['full_name'] ?? '', 'phone' => $customer['phone'] ?? '',
        'email' => $customer['email'] ?? '', 'address' => $customer['delivery_address'] ?? '',
        'city' => $customer['city'] ?? '', 'state' => $customer['state'] ?? '',
        'pin' => $customer['postal_code'] ?? '', 'postalCode' => $customer['postal_code'] ?? '',
        'subtotal' => (int)$order['subtotal'], 'shipping' => (int)$order['shipping_charge'],
        'total' => (int)$order['total_amount'], 'status' => $order['order_status'],
        'orderStatus' => $order['order_status'], 'paymentStatus' => $order['payment_status'],
        'paymentId' => $order['razorpay_payment_id'], 'razorpayOrderId' => $order['razorpay_order_id'],
        'paymentMode' => 'razorpay', 'notes' => $order['notes'] ?? '',
        'createdAt' => $order['created_at'], 'updatedAt' => $order['updated_at'],
        'items' => array_map(static fn(array $item): array => [
            'productId' => $item['product_id'] ?? '', 'name' => $item['product_name'],
            'qty' => (int)$item['quantity'], 'price' => (int)$item['unit_price'],
            'lineTotal' => (int)$item['total_price'], 'imageUrl' => $item['image_url'],
            'modelUrl' => $item['model_url'],
        ], $items),
    ];
}

function store_settings(): array
{
    $defaults = [
        'storeName' => '3D Print Co.', 'supportEmail' => 'orders@3dprintco.in',
        'supportPhone' => '+91 98400 00000', 'city' => 'Chennai', 'gstin' => '',
        'freeShippingOver' => '149900', 'shippingFlat' => '4900', 'notifyEmail' => '',
    ];
    foreach (all('SELECT setting_key, setting_value FROM settings') as $row) {
        $defaults[$row['setting_key']] = $row['setting_value'];
    }
    $defaults['freeShippingOver'] = (int)$defaults['freeShippingOver'];
    $defaults['shippingFlat'] = (int)$defaults['shippingFlat'];
    return $defaults;
}

function admin_email(): string
{
    global $config;
    return strtolower((string)($config['admin_email'] ?? ''));
}

function admin_auth_ready(): bool
{
    global $config;
    $email = admin_email();
    $password = (string)($config['admin_password'] ?? '');
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false
        && !in_array($email, ['admin@example.com', 'change-me@example.com'], true)
        && strlen($password) >= 12
        && !in_array($password, ['CHANGE_ME', 'password', 'admin'], true);
}

function same_origin(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $originParts = parse_url($origin);
    if ($origin !== '' && is_array($originParts) && in_array(strtolower(rtrim($origin, '/')), array_map(
        static fn($allowed): string => strtolower(rtrim((string)$allowed, '/')),
        (array)($GLOBALS['config']['allowed_origins'] ?? [])
    ), true)) {
        return in_array(strtolower((string)($originParts['scheme'] ?? '')), ['http', 'https'], true)
            && !empty($originParts['host'])
            && !isset($originParts['user'])
            && !isset($originParts['pass']);
    }
    if ($origin === '' || $host === '') return false;
    $requestParts = parse_url('//' . $host);
    if (!is_array($originParts) || !is_array($requestParts) || empty($originParts['host']) || empty($requestParts['host'])) return false;
    $scheme = strtolower((string)($originParts['scheme'] ?? ''));
    if (!in_array($scheme, ['http', 'https'], true)) return false;
    $originPort = (int)($originParts['port'] ?? ($scheme === 'https' ? 443 : 80));
    $forwardedProto = strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    $requestSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || $forwardedProto === 'https';
    $defaultRequestPort = $requestSecure ? 443 : (($forwardedProto === 'http') ? 80 : (int)($_SERVER['SERVER_PORT'] ?? 0));
    $requestPort = (int)($requestParts['port'] ?? $defaultRequestPort);
    return strtolower(rtrim($originParts['host'], '.')) === strtolower(rtrim($requestParts['host'], '.'))
        && $originPort === $requestPort;
}

function admin_required(): array
{
    if (empty($_SESSION['admin_email']) || empty($_SESSION['admin_until']) || $_SESSION['admin_until'] < time()) {
        session_unset();
        fail(401, 'Admin session is invalid or has expired. Sign in again.');
    }
    return ['email' => (string)$_SESSION['admin_email'], 'exp' => (int)$_SESSION['admin_until']];
}

function guard_admin_write(): void
{
    if (!same_origin()) fail(403, 'A same-origin admin request is required.');
}

function settings_public(array $settings): array
{
    global $config;
    $key = (string)($config['razorpay_key_id'] ?? '');
    $test = str_starts_with($key, 'rzp_test_') && !empty($config['razorpay_key_secret']);
    return [
        'storeName' => $settings['storeName'], 'supportEmail' => $settings['supportEmail'],
        'supportPhone' => $settings['supportPhone'], 'city' => $settings['city'],
        'gstin' => $settings['gstin'], 'freeShippingOver' => $settings['freeShippingOver'],
        'shippingFlat' => $settings['shippingFlat'], 'razorpayKeyId' => $test ? $key : '',
        'paymentsReady' => $test,
        'notifications' => notification_capabilities(),
    ];
}

function require_method(string ...$methods): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        fail(405, 'Method not allowed.');
    }
}

function short_url(string $path): bool
{
    return (bool)filter_var($path, FILTER_VALIDATE_URL) && in_array(parse_url($path, PHP_URL_SCHEME), ['http', 'https'], true);
}

function rate_limit(string $scope, int $max, int $window): void
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $file = sys_get_temp_dir() . '/3dp-limit-' . hash('sha256', $scope . '|' . $ip);
    $handle = @fopen($file, 'c+');
    if (!$handle) return;
    try {
        if (!flock($handle, LOCK_EX)) return;
        $raw = stream_get_contents($handle);
        $state = is_string($raw) ? json_decode($raw, true) : null;
        $now = time();
        if (!is_array($state) || !isset($state['start'], $state['count']) || $now - (int)$state['start'] >= $window) {
            $state = ['start' => $now, 'count' => 0];
        }
        $state['count']++;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($state));
        if ($state['count'] > $max) fail(429, 'Too many requests. Please wait and try again.');
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function notification_capabilities(): array
{
    global $config;
    return [
        'email' => !empty($config['resend_api_key']) && !empty($config['notify_from']),
        'webhook' => !empty($config['notify_webhook_url']),
    ];
}

function notify_event(string $to, string $event, string $subject, string $message, array $metadata = []): string
{
    global $config;
    $capabilities = notification_capabilities();
    if (!$capabilities['email'] && !$capabilities['webhook']) return 'not_configured';
    $delivered = false;
    if ($capabilities['email'] && $to !== '') {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Authorization: Bearer " . $config['resend_api_key'] . "\r\nContent-Type: application/json\r\n",
            'content' => json_encode([
                'from' => $config['notify_from'], 'to' => [$to],
                'subject' => $subject, 'text' => $message,
            ]),
            'timeout' => 10, 'ignore_errors' => true,
        ]]);
        $response = @file_get_contents('https://api.resend.com/emails', false, $context);
        $status = 0;
        foreach (($http_response_header ?? []) as $header) if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) $status = (int)$match[1];
        if (is_string($response) && $status >= 200 && $status < 300) $delivered = true;
        else error_log('[interserver-api] email provider returned status ' . $status);
    }
    if ($capabilities['webhook']) {
        $context = stream_context_create(['http' => [
            'method' => 'POST', 'header' => "Content-Type: application/json\r\n",
            'content' => json_encode(['event' => $event, 'to' => $to, 'subject' => $subject, 'text' => $message, 'metadata' => $metadata]),
            'timeout' => 10, 'ignore_errors' => true,
        ]]);
        $response = @file_get_contents((string)$config['notify_webhook_url'], false, $context);
        $status = 0;
        foreach (($http_response_header ?? []) as $header) if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) $status = (int)$match[1];
        if (is_string($response) && $status >= 200 && $status < 300) $delivered = true;
        else error_log('[interserver-api] notification webhook returned status ' . $status);
    }
    return $delivered ? 'sent' : 'failed';
}
