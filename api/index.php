<?php
declare(strict_types=1);

require __DIR__ . '/_php/bootstrap.php';
require __DIR__ . '/_php/tracking.php';
require __DIR__ . '/_php/commerce.php';
require __DIR__ . '/_php/social.php';
require __DIR__ . '/_php/admin.php';
require __DIR__ . '/_php/whatsapp.php';

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) return false;
    throw new ErrorException($message, 0, $severity, $file, $line);
});

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('3dp-admin-session');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_set_cookie_params([
        'lifetime' => 28800,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

$route = trim((string)($_GET['route'] ?? ''), '/');
$segments = $route === '' ? [] : array_map('rawurldecode', explode('/', $route));
$path = implode('/', $segments);

try {
    if (handle_social($path, $segments)) exit;
    if (handle_admin($path, $segments)) exit;
    if (handle_whatsapp($path)) exit;
    if (handle_commerce($path, $segments)) exit;
    fail(404, 'API endpoint not found.');
} catch (Throwable $error) {
    error_log('[interserver-api] ' . get_class($error) . ': ' . $error->getMessage());
    if ($error instanceof PDOException && (string)$error->getCode() === '23000') {
        fail(409, 'This conflicts with an existing record.');
    }
    fail(500, 'The server could not complete this request. Please try again.');
}
