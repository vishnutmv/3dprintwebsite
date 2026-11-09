<?php
declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (preg_match('#^/api(?:/(.*))?$#', $uri, $match)) {
    $_GET['route'] = trim($match[1] ?? '', '/');
    require __DIR__ . '/index.php';
    return true;
}

return false;
