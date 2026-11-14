<?php
declare(strict_types=1);

/** The public studio identity shown against replies (never the login email). */
const ADMIN_PUBLIC_NAME = 'admin@zencmart';

/**
 * Storefront social features.
 *
 * Product ratings/reviews are public to read and require a signed-in customer
 * to write. Favourites and the notification inbox are private to the signed-in
 * customer. Admin replies are attributed to the public studio identity
 * (admin@zencmart) and pushed into the customer's inbox (and WhatsApp when
 * configured).
 */

/** Migration 0017 may not have run yet; never break the storefront for that. */
function social_table_exists(string $table): bool
{
    static $cache = [];
    if (array_key_exists($table, $cache)) return $cache[$table];
    if (!in_array($table, ['product_reviews', 'product_favorites', 'customer_notifications'], true)) return false;
    try {
        // The table name is chosen from the whitelist above, never from input.
        $cache[$table] = one("SHOW TABLES LIKE '$table'") !== null;
    } catch (Throwable $error) {
        error_log('[interserver-api] Could not inspect social tables: ' . $error->getMessage());
        $cache[$table] = false;
    }
    return $cache[$table];
}

function social_tables_ready(): bool
{
    return social_table_exists('product_reviews')
        && social_table_exists('product_favorites')
        && social_table_exists('customer_notifications');
}

function social_migration_hint(): never
{
    fail(503, 'Ratings and notifications are not enabled yet. Run migrations/0017_reviews_favorites_notifications.sql on the database.');
}

/** Reviews are public to read; only a signed-in customer may create one. */
function review_out(array $row): array
{
    return [
        'id' => $row['id'],
        'productId' => $row['product_id'],
        'productName' => $row['product_name'] ?? '',
        'productSlug' => $row['product_slug'] ?? '',
        'customerCode' => $row['customer_code'] ?? null,
        'authorName' => $row['author_name'],
        'isAdmin' => (bool)$row['is_admin'],
        'rating' => $row['rating'] === null ? null : (float)$row['rating'],
        'title' => $row['title'] ?? '',
        'body' => $row['body'],
        'adminReply' => $row['admin_reply'] ?? null,
        'adminReplyBy' => ($row['admin_reply'] ?? null) !== null ? ADMIN_PUBLIC_NAME : null,
        'adminRepliedAt' => utc_iso($row['admin_replied_at'] ?? null),
        'status' => $row['status'] ?? 'published',
        'adminSeen' => ($row['admin_seen_at'] ?? null) !== null,
        'createdAt' => utc_iso($row['created_at'] ?? null),
    ];
}

const REVIEW_SELECT = 'SELECT r.*, p.name AS product_name, p.slug AS product_slug, c.customer_code AS customer_code '
    . 'FROM product_reviews r JOIN products p ON p.id=r.product_id LEFT JOIN customers c ON c.id=r.customer_id';

function review_summary(string $productId): array
{
    $summary = ['average' => 0.0, 'count' => 0, 'distribution' => ['1' => 0, '2' => 0, '3' => 0, '4' => 0, '5' => 0]];
    if (!social_table_exists('product_reviews')) return $summary;
    $rows = all(
        'SELECT rating, COUNT(*) AS total FROM product_reviews '
        . 'WHERE product_id=? AND status="published" AND rating IS NOT NULL GROUP BY rating',
        [$productId],
    );
    $total = 0;
    $sum = 0;
    foreach ($rows as $row) {
        // Half stars roll up into the nearest whole-star bucket for the histogram.
        $value = (float)$row['rating'];
        $star = max(1, min(5, (int)ceil($value)));
        $count = (int)$row['total'];
        $summary['distribution'][(string)$star] = $count;
        $total += $count;
        $sum += $value * $count;
    }
    $summary['count'] = $total;
    $summary['average'] = $total > 0 ? round($sum / $total, 2) : 0.0;
    return $summary;
}

/** Keep the catalogue card rating in sync with real published reviews. */
function refresh_product_rating(string $productId): void
{
    if (!social_table_exists('product_reviews')) return;
    try {
        $summary = review_summary($productId);
        if ($summary['count'] > 0) {
            run('UPDATE products SET rating=?, reviews=? WHERE id=?', [
                $summary['average'], $summary['count'], $productId,
            ]);
        }
    } catch (Throwable $error) {
        error_log('[interserver-api] Could not refresh product rating: ' . $error->getMessage());
    }
}

function resolve_review_product(string $reference): ?array
{
    $column = preg_match('/^[0-9a-f-]{36}$/i', $reference) ? 'id' : 'slug';
    return one("SELECT id, slug, name FROM products WHERE `$column`=?", [$reference]);
}

/** In-app inbox entry. Silent when migration 0017 has not run yet. */
function add_customer_notification(
    string $customerId,
    string $kind,
    string $title,
    string $body = '',
    ?string $link = null,
): void {
    if (!social_table_exists('customer_notifications')) return;
    try {
        run(
            'INSERT INTO customer_notifications (id,customer_id,kind,title,body,link) VALUES (?,?,?,?,?,?)',
            [new_id(), $customerId, substr($kind, 0, 40), mb_substr($title, 0, 160), mb_substr($body, 0, 2000), $link],
        );
    } catch (Throwable $error) {
        error_log('[interserver-api] Could not save a customer notification: ' . $error->getMessage());
    }
}

function notification_out(array $row): array
{
    return [
        'id' => $row['id'],
        'kind' => $row['kind'],
        'title' => $row['title'],
        'body' => $row['body'],
        'link' => $row['link'] ?? null,
        'readAt' => utc_iso($row['read_at'] ?? null),
        'createdAt' => utc_iso($row['created_at'] ?? null),
    ];
}

function customer_notifications_response(array $customer): array
{
    if (!social_table_exists('customer_notifications')) {
        return ['notifications' => [], 'unreadCount' => 0];
    }
    $rows = all(
        'SELECT * FROM customer_notifications WHERE customer_id=? ORDER BY created_at DESC LIMIT 100',
        [$customer['id']],
    );
    $unread = 0;
    foreach ($rows as $row) if ($row['read_at'] === null) $unread++;
    return ['notifications' => array_map('notification_out', $rows), 'unreadCount' => $unread];
}

function customer_favourites_response(array $customer): array
{
    if (!social_table_exists('product_favorites')) {
        return ['productIds' => [], 'products' => []];
    }
    $ids = all(
        'SELECT f.product_id FROM product_favorites f JOIN products p ON p.id=f.product_id '
        . 'WHERE f.customer_id=? AND p.is_active=1 ORDER BY f.created_at DESC',
        [$customer['id']],
    );
    $productIds = array_map(static fn(array $row): string => (string)$row['product_id'], $ids);
    $products = [];
    if ($productIds !== []) {
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        $products = all("SELECT * FROM products WHERE id IN ($placeholders)", $productIds);
    }
    return ['productIds' => $productIds, 'products' => array_map('product_out', $products)];
}

function customer_transactions_response(array $customer): array
{
    $orders = all('SELECT * FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 100', [$customer['id']]);
    $transactions = [];
    $summary = ['orderCount' => count($orders), 'paidOrders' => 0, 'pendingOrders' => 0, 'refundedOrders' => 0, 'totalSpend' => 0, 'lastOrderAt' => null];
    foreach ($orders as $order) {
        $paid = $order['payment_status'] === 'paid';
        if ($paid) {
            $summary['paidOrders']++;
            $summary['totalSpend'] += (int)$order['total_amount'];
        } elseif ($order['payment_status'] === 'refunded') {
            $summary['refundedOrders']++;
        } else {
            $summary['pendingOrders']++;
        }
        if ($summary['lastOrderAt'] === null) $summary['lastOrderAt'] = utc_iso($order['created_at']);
        $transactions[] = [
            'id' => $order['id'],
            'orderNumber' => $order['order_number'],
            'kind' => 'order',
            'paymentStatus' => $order['payment_status'],
            'orderStatus' => $order['order_status'],
            'amount' => (int)$order['total_amount'],
            'paymentId' => $order['razorpay_payment_id'],
            'createdAt' => utc_iso($order['created_at']),
            'updatedAt' => utc_iso($order['updated_at']),
        ];
    }
    return ['summary' => $summary, 'transactions' => $transactions];
}

function admin_display_name(): string
{
    return ADMIN_PUBLIC_NAME;
}

function admin_review_out(array $row): array
{
    return array_merge(review_out($row), [
        'customerPhone' => $row['customer_phone'] ?? null,
        'customerEmail' => $row['customer_email'] ?? null,
    ]);
}

function handle_social(string $path, array $parts): bool
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 8)));

    /* ----------------------------- public reviews ---------------------------- */
    if (($parts[0] ?? '') === 'products' && count($parts) === 3 && $parts[2] === 'reviews' && $method === 'GET') {
        $product = resolve_review_product(rawurldecode($parts[1]));
        if (!$product) fail(404, 'Product not found.');
        if (!social_table_exists('product_reviews')) {
            respond(200, ['reviews' => [], 'summary' => review_summary($product['id']), 'adminName' => admin_display_name()]);
        }
        $rows = all(
            REVIEW_SELECT . ' WHERE r.product_id=? AND r.status="published" ORDER BY r.created_at DESC LIMIT 100',
            [$product['id']],
        );
        respond(200, [
            'reviews' => array_map('review_out', $rows),
            'summary' => review_summary($product['id']),
            'adminName' => admin_display_name(),
        ]);
    }
    if ($path === 'reviews' && $method === 'GET') {
        if (!social_table_exists('product_reviews')) respond(200, ['reviews' => []]);
        $featured = ($_GET['featured'] ?? '') === '1';
        $rows = all(
            REVIEW_SELECT . ' WHERE r.status="published" AND r.is_admin=0 AND r.body<>"" '
            . ($featured ? 'AND r.rating>=4 ' : '')
            . 'ORDER BY r.created_at DESC LIMIT ' . $limit,
        );
        respond(200, ['reviews' => array_map('review_out', $rows)]);
    }

    /* ---------------------------- customer reviews --------------------------- */
    if (($parts[0] ?? '') === 'products' && count($parts) === 3 && $parts[2] === 'reviews' && $method === 'POST') {
        if (!social_table_exists('product_reviews')) social_migration_hint();
        $customer = customer_session_required();
        rate_limit('review-create', 10, 3600);
        $product = resolve_review_product(rawurldecode($parts[1]));
        if (!$product) fail(404, 'Product not found.');
        $input = body();
        $rating = $input['rating'] ?? null;
        if (!is_numeric($rating)) fail(400, 'Choose a rating from 1 to 5 stars.');
        $rating = round((float)$rating * 2) / 2;
        if ($rating < 1 || $rating > 5) fail(400, 'Choose a rating from 1 to 5 stars.');
        $body = text_value($input['body'] ?? '', 1200);
        if (mb_strlen($body) < 4) fail(400, 'Write a sentence or two about the product.');
        $title = text_value($input['title'] ?? '', 160);
        if (one('SELECT id FROM product_reviews WHERE product_id=? AND customer_id=?', [$product['id'], $customer['id']])) {
            fail(409, 'You have already reviewed this product.');
        }
        $id = new_id();
        run(
            'INSERT INTO product_reviews (id,product_id,customer_id,author_name,author_email,rating,title,body) VALUES (?,?,?,?,?,?,?,?)',
            [$id, $product['id'], $customer['id'], $customer['full_name'], $customer['email'] ?? null, $rating, $title, $body],
        );
        refresh_product_rating($product['id']);
        add_customer_notification(
            (string)$customer['id'],
            'review',
            'Thanks for your review',
            'Your review of ' . $product['name'] . ' is live. The studio is notified and can reply.',
            '/product/' . $product['slug'],
        );
        $row = one(REVIEW_SELECT . ' WHERE r.id=?', [$id]);
        respond(201, ['review' => $row ? review_out($row) : null, 'summary' => review_summary($product['id'])]);
    }

    /* ------------------------------- favourites ------------------------------ */
    if ($path === 'customer/favorites' && $method === 'GET') {
        respond(200, customer_favourites_response(customer_session_required()));
    }
    if ($path === 'customer/favorites' && $method === 'POST') {
        if (!social_table_exists('product_favorites')) social_migration_hint();
        $customer = customer_session_required();
        $input = body();
        $productId = text_value($input['productId'] ?? '', 64);
        $product = preg_match('/^[0-9a-f-]{36}$/i', $productId)
            ? one('SELECT id FROM products WHERE id=? AND is_active=1', [$productId])
            : null;
        if (!$product) fail(404, 'Product not found.');
        run('INSERT IGNORE INTO product_favorites (customer_id,product_id) VALUES (?,?)', [$customer['id'], $productId]);
        respond(201, customer_favourites_response($customer));
    }
    if (($parts[0] ?? '') === 'customer' && ($parts[1] ?? '') === 'favorites' && count($parts) === 3 && $method === 'DELETE') {
        $customer = customer_session_required();
        if (!social_table_exists('product_favorites')) respond(200, ['productIds' => [], 'products' => []]);
        run('DELETE FROM product_favorites WHERE customer_id=? AND product_id=?', [$customer['id'], rawurldecode($parts[2])]);
        respond(200, customer_favourites_response($customer));
    }

    /* ----------------------------- notifications ----------------------------- */
    if ($path === 'customer/notifications' && $method === 'GET') {
        respond(200, customer_notifications_response(customer_session_required()));
    }
    if ($path === 'customer/notifications/read' && $method === 'POST') {
        $customer = customer_session_required();
        if (!social_table_exists('customer_notifications')) respond(200, ['notifications' => [], 'unreadCount' => 0]);
        $input = body();
        $ids = $input['ids'] ?? null;
        if (is_array($ids) && $ids !== []) {
            $ids = array_slice(array_values(array_filter($ids, 'is_string')), 0, 100);
            if ($ids !== []) {
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                run(
                    "UPDATE customer_notifications SET read_at=UTC_TIMESTAMP() WHERE customer_id=? AND read_at IS NULL AND id IN ($placeholders)",
                    array_merge([$customer['id']], $ids),
                );
            }
        } else {
            run('UPDATE customer_notifications SET read_at=UTC_TIMESTAMP() WHERE customer_id=? AND read_at IS NULL', [$customer['id']]);
        }
        respond(200, customer_notifications_response($customer));
    }

    /* ---------------------------- transaction history ------------------------ */
    if ($path === 'customer/transactions' && $method === 'GET') {
        respond(200, customer_transactions_response(customer_session_required()));
    }

    /* -------------------------------- admin ---------------------------------- */
    if (!str_starts_with($path, 'admin/')) return false;
    if (!in_array($path, ['admin/reviews', 'admin/reviews/count'], true)
        && !preg_match('#^admin/reviews/[0-9a-f-]{36}(?:/reply)?$#i', $path)) {
        return false;
    }
    $session = admin_required();
    if (!in_array($method, ['GET', 'HEAD'], true)) guard_admin_write();

    if ($path === 'admin/reviews/count' && $method === 'GET') {
        if (!social_table_exists('product_reviews')) respond(200, ['unreadCount' => 0, 'total' => 0, 'averageRating' => 0]);
        $row = one(
            'SELECT COUNT(*) AS total, SUM(admin_seen_at IS NULL AND is_admin=0) AS unseen, AVG(rating) AS average '
            . 'FROM product_reviews WHERE status="published"'
        ) ?? [];
        respond(200, [
            'unreadCount' => (int)($row['unseen'] ?? 0),
            'total' => (int)($row['total'] ?? 0),
            'averageRating' => round((float)($row['average'] ?? 0), 2),
        ]);
    }
    if ($path === 'admin/reviews' && $method === 'GET') {
        if (!social_table_exists('product_reviews')) respond(200, ['reviews' => [], 'unreadCount' => 0, 'adminName' => admin_display_name()]);
        $rows = all(
            'SELECT r.*, p.name AS product_name, p.slug AS product_slug, c.customer_code AS customer_code, '
            . 'c.phone AS customer_phone, c.email AS customer_email '
            . 'FROM product_reviews r JOIN products p ON p.id=r.product_id LEFT JOIN customers c ON c.id=r.customer_id '
            . 'ORDER BY (r.admin_seen_at IS NULL AND r.is_admin=0) DESC, r.created_at DESC LIMIT 300'
        );
        $unread = 0;
        foreach ($rows as $row) if ($row['admin_seen_at'] === null && !(bool)$row['is_admin']) $unread++;
        if ($unread > 0) {
            run('UPDATE product_reviews SET admin_seen_at=UTC_TIMESTAMP() WHERE admin_seen_at IS NULL AND is_admin=0');
        }
        respond(200, [
            'reviews' => array_map('admin_review_out', $rows),
            'unreadCount' => $unread,
            'adminName' => admin_display_name(),
        ]);
    }
    if (preg_match('#^admin/reviews/([0-9a-f-]{36})/reply$#i', $path, $match) && $method === 'POST') {
        if (!social_table_exists('product_reviews')) social_migration_hint();
        $id = $match[1];
        $review = one(
            'SELECT r.*, p.name AS product_name, p.slug AS product_slug, c.phone AS customer_phone, c.full_name AS customer_name '
            . 'FROM product_reviews r JOIN products p ON p.id=r.product_id LEFT JOIN customers c ON c.id=r.customer_id WHERE r.id=?',
            [$id],
        );
        if (!$review) fail(404, 'Review not found.');
        $reply = text_value(body()['reply'] ?? '', 2000);
        if (mb_strlen($reply) < 2) fail(400, 'Write a reply before sending it.');
        $adminName = admin_display_name();
        run(
            'UPDATE product_reviews SET admin_reply=?, admin_reply_by=?, admin_replied_at=UTC_TIMESTAMP() WHERE id=?',
            [$reply, $adminName, $id],
        );
        $whatsapp = 'not_configured';
        if (!empty($review['customer_id'])) {
            add_customer_notification(
                (string)$review['customer_id'],
                'review_reply',
                'The studio replied to your review',
                mb_substr($reply, 0, 400) . ' — ' . $adminName,
                '/product/' . $review['product_slug'],
            );
            if (!empty($review['customer_phone']) && !empty($GLOBALS['config']['waapi_api_token']) && !empty($GLOBALS['config']['waapi_instance_id'])) {
                $storeUrl = rtrim((string)($GLOBALS['config']['site_url'] ?? ''), '/');
                $message = 'Hi ' . text_value($review['customer_name'] ?? 'there', 80) . ",\n\n"
                    . $adminName . " replied to your review of " . $review['product_name'] . ":\n\n"
                    . '"' . $reply . '"' . "\n\n"
                    . ($storeUrl !== '' ? 'See it on the store: ' . $storeUrl . '/product/' . $review['product_slug'] : 'Open your account to see the reply.')
                    . "\n\n— ZenCMart";
                $whatsapp = send_whatsapp_notification((string)$review['customer_phone'], (string)($review['customer_name'] ?? ''), $message)
                    ? 'sent'
                    : 'failed';
            }
        }
        $updated = one(
            'SELECT r.*, p.name AS product_name, p.slug AS product_slug, c.customer_code AS customer_code, '
            . 'c.phone AS customer_phone, c.email AS customer_email '
            . 'FROM product_reviews r JOIN products p ON p.id=r.product_id LEFT JOIN customers c ON c.id=r.customer_id WHERE r.id=?',
            [$id],
        );
        respond(200, ['review' => $updated ? admin_review_out($updated) : null, 'notifications' => ['whatsapp' => $whatsapp]]);
    }
    if (preg_match('#^admin/reviews/([0-9a-f-]{36})$#i', $path, $match)) {
        if (!social_table_exists('product_reviews')) social_migration_hint();
        $id = $match[1];
        if ($method === 'DELETE') {
            $review = one('SELECT product_id FROM product_reviews WHERE id=?', [$id]);
            if (!$review) fail(404, 'Review not found.');
            run('DELETE FROM product_reviews WHERE id=?', [$id]);
            refresh_product_rating((string)$review['product_id']);
            respond(200, ['ok' => true]);
        }
        if ($method === 'PATCH') {
            $status = text_value(body()['status'] ?? '', 20);
            if (!in_array($status, ['published', 'hidden'], true)) fail(400, 'Choose published or hidden.');
            $review = one('SELECT product_id FROM product_reviews WHERE id=?', [$id]);
            if (!$review) fail(404, 'Review not found.');
            run('UPDATE product_reviews SET status=? WHERE id=?', [$status, $id]);
            refresh_product_rating((string)$review['product_id']);
            respond(200, ['ok' => true]);
        }
    }
    return false;
}
