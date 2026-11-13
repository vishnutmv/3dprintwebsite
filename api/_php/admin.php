<?php
declare(strict_types=1);

function product_values(array $input, bool $partial): array
{
    $values = [];
    $has = static fn(string $key): bool => array_key_exists($key, $input);
    if ($has('name') || !$partial) {
        $name = text_value($input['name'] ?? '', 160);
        if (mb_strlen($name) < 2) fail(400, 'Product name is required.');
        $values['name'] = $name;
    }
    if ($has('promotionPrice') || !$partial) {
        $rawPromotionPrice = $input['promotionPrice'] ?? null;
        if ($rawPromotionPrice === null || $rawPromotionPrice === '') $values['promotion_price'] = null;
        else {
            $promotionPrice = filter_var($rawPromotionPrice, FILTER_VALIDATE_INT);
            if ($promotionPrice === false || $promotionPrice < 1 || $promotionPrice > 100000000) fail(400, 'Promotion price must be a positive whole number in paise.');
            $values['promotion_price'] = $promotionPrice;
        }
    }
    foreach (['promotionStartAt' => 'promotion_start_at', 'promotionEndAt' => 'promotion_end_at'] as $key => $column) {
        if ($has($key) || !$partial) {
            $raw = $input[$key] ?? null;
            if ($raw === null || $raw === '') {
                $values[$column] = null;
            } elseif (!is_string($raw) || !preg_match('/(?:Z|[+-]\d{2}:\d{2})$/', $raw)) {
                fail(400, 'Promotion dates must include an explicit timezone.');
            } else {
                try {
                    $values[$column] = (new DateTimeImmutable($raw))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
                } catch (Throwable) {
                    fail(400, 'Promotion date is invalid.');
                }
            }
        }
    }
    if ($has('slug')) {
        $slug = strtolower(trim((string)$input['slug']));
        $slug = trim(substr((string)preg_replace('/[^a-z0-9]+/', '-', $slug), 0, 80), '-');
        if ($slug === '') fail(400, 'Slug is invalid.');
        $values['slug'] = $slug;
    }
    foreach (['description' => 5000, 'category' => 80, 'material' => 200, 'dimensions' => 200, 'printTime' => 120, 'badge' => 60] as $key => $max) {
        if ($has($key)) {
            $column = $key === 'printTime' ? 'print_time' : $key;
            $values[$column] = text_value($input[$key], $max);
        }
    }
    if (isset($values['category']) && $values['category'] === '') $values['category'] = 'Uncategorised';
    if (array_key_exists('badge', $values) && $values['badge'] === '') $values['badge'] = null;
    if ($has('price') || !$partial) {
        $price = filter_var($input['price'] ?? null, FILTER_VALIDATE_INT);
        if ($price === false || $price < 1 || $price > 100000000) fail(400, 'Price must be a positive whole number in paise.');
        $values['price'] = $price;
    }
    if ($has('mrp')) {
        if ($input['mrp'] === null || $input['mrp'] === '') $values['mrp'] = null;
        else {
            $mrp = filter_var($input['mrp'], FILTER_VALIDATE_INT);
            if ($mrp === false || $mrp < 1 || $mrp > 100000000) fail(400, 'MRP must be a positive whole number in paise.');
            $values['mrp'] = $mrp;
        }
    }
    $stockRaw = $input['stock'] ?? $input['stockQuantity'] ?? $input['stock_quantity'] ?? null;
    if ($stockRaw !== null) {
        $stock = filter_var($stockRaw, FILTER_VALIDATE_INT);
        if ($stock === false || $stock < 0 || $stock > 1000000) fail(400, 'Stock must be a whole number of zero or more.');
        $values['stock_quantity'] = $stock;
    }
    if ($has('images')) {
        if (!is_array($input['images']) || count($input['images']) > 8) fail(400, 'Images must be up to 8 valid http(s) URLs.');
        foreach ($input['images'] as $url) if (!is_string($url) || !short_url($url)) fail(400, 'Images must be up to 8 valid http(s) URLs.');
        $values['images'] = json_encode(array_values($input['images']));
    }
    foreach (['videoUrl' => 'video_url', 'modelUrl' => 'model_url'] as $key => $column) {
        if ($has($key) || $has($column)) {
            $url = text_value($input[$key] ?? $input[$column] ?? '', 600);
            if ($url !== '' && !short_url($url)) fail(400, ucfirst($key) . ' must be a valid http(s) URL.');
            $values[$column] = $url ?: null;
        }
    }
    if ($has('specifications')) {
        if (!is_array($input['specifications']) || array_is_list($input['specifications']) && count($input['specifications']) > 0) fail(400, 'Specifications must be an object of short text values.');
        if (count($input['specifications']) > 30) fail(400, 'Specifications may contain at most 30 entries.');
        $specs = [];
        foreach ($input['specifications'] as $key => $value) {
            if (!is_string($value)) fail(400, 'Specifications must contain text values.');
            $clean = text_value((string)$key, 60);
            if ($clean !== '') $specs[$clean] = text_value($value, 300);
        }
        $values['specifications'] = json_encode($specs);
    }
    if ($has('variant')) {
        $variant = text_value($input['variant'], 40);
        if (!in_array($variant, ['dragon','organiser','gear','planter','knight','spool','lattice'], true)) fail(400, 'Unknown 3D fallback shape.');
        $values['variant'] = $variant;
    }
    if ($has('accent')) {
        $accent = text_value($input['accent'], 20);
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $accent)) fail(400, 'Accent must be a hex colour like #a78bfa.');
        $values['accent'] = $accent;
    }
    if ($has('rating')) {
        if (!is_numeric($input['rating']) || (float)$input['rating'] < 0 || (float)$input['rating'] > 5) fail(400, 'Rating must be between 0 and 5.');
        $values['rating'] = round((float)$input['rating'], 2);
    }
    if ($has('reviews')) {
        $reviews = filter_var($input['reviews'], FILTER_VALIDATE_INT);
        if ($reviews === false || $reviews < 0 || $reviews > 10000000) fail(400, 'Reviews must be zero or more.');
        $values['reviews'] = $reviews;
    }
    if ($has('active') || $has('isActive')) $values['is_active'] = !empty($input['active'] ?? $input['isActive']);
    if ($partial && !$values) fail(400, 'Nothing to update.');
    return $values;
}

function validate_product_promotion(array $values, array $existing = []): void
{
    $price = (int)($values['price'] ?? $existing['price'] ?? 0);
    $mrp = array_key_exists('mrp', $values) ? $values['mrp'] : ($existing['mrp'] ?? null);
    $promotionPrice = array_key_exists('promotion_price', $values) ? $values['promotion_price'] : ($existing['promotion_price'] ?? null);
    $startAt = array_key_exists('promotion_start_at', $values) ? $values['promotion_start_at'] : ($existing['promotion_start_at'] ?? null);
    $endAt = array_key_exists('promotion_end_at', $values) ? $values['promotion_end_at'] : ($existing['promotion_end_at'] ?? null);
    if ($mrp !== null && (int)$mrp < $price) fail(400, 'MRP must be greater than or equal to the selling price.');
    if ($promotionPrice === null) {
        if ($startAt !== null || $endAt !== null) fail(400, 'Set a promotion price before setting its dates.');
        return;
    }
    if ((int)$promotionPrice >= $price || ($mrp !== null && (int)$promotionPrice > (int)$mrp)) {
        fail(400, 'Promotion price must be below the selling price and no greater than MRP.');
    }
    if ($startAt === null || $endAt === null || $startAt >= $endAt) {
        fail(400, 'A promotion needs a valid start and end time.');
    }
}

function collaborator_values(array $input, bool $partial): array
{
    $values = [];
    if (!$partial || array_key_exists('name', $input)) {
        $name = text_value($input['name'] ?? '', 160);
        if (mb_strlen($name) < 2) fail(400, 'Collaborator name must contain at least 2 characters.');
        $values['name'] = $name;
    }
    foreach (['contactName' => ['contact_name', 120], 'phone' => ['phone', 24], 'notes' => ['notes', 1000]] as $key => [$column, $max]) {
        if (!$partial || array_key_exists($key, $input)) $values[$column] = text_value($input[$key] ?? '', $max);
    }
    if (!$partial || array_key_exists('email', $input)) {
        $email = text_value($input['email'] ?? '', 254);
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Enter a valid collaborator email address.');
        $values['email'] = $email ?: null;
    }
    if (array_key_exists('active', $input)) $values['is_active'] = !empty($input['active']) ? 1 : 0;
    if ($partial && !$values) fail(400, 'Nothing to update.');
    return $values;
}

function collaborator_offer_values(array $input, bool $partial): array
{
    $values = [];
    if (!$partial || array_key_exists('rewardName', $input)) {
        $name = text_value($input['rewardName'] ?? '', 160);
        if (mb_strlen($name) < 2) fail(400, 'Reward name must contain at least 2 characters.');
        $values['reward_name'] = $name;
    }
    if (!$partial || array_key_exists('rewardType', $input)) {
        $type = text_value($input['rewardType'] ?? '', 30);
        if (!in_array($type, ['cashback', 'percentage_discount', 'fixed_discount', 'product', 'other'], true)) fail(400, 'Select a valid collaborator reward type.');
        $values['reward_type'] = $type;
    }
    if (!$partial || array_key_exists('rewardValue', $input)) {
        $value = trim((string)($input['rewardValue'] ?? '0'));
        if (!preg_match('/^\d{1,8}(?:\.\d{1,2})?$/', $value) || (float)$value > 99999999) fail(400, 'Reward value must be a non-negative number with up to 2 decimals.');
        if (($values['reward_type'] ?? $input['rewardType'] ?? '') === 'percentage_discount' && (float)$value > 100) {
            fail(400, 'Percentage discount cannot exceed 100%.');
        }
        $values['reward_value'] = number_format((float)$value, 2, '.', '');
    }
    if (!$partial || array_key_exists('quantity', $input)) {
        $quantity = filter_var($input['quantity'] ?? 1, FILTER_VALIDATE_INT);
        if ($quantity === false || $quantity < 1 || $quantity > 100000) fail(400, 'Reward quantity must be between 1 and 100000.');
        $values['quantity'] = $quantity;
    }
    if (!$partial || array_key_exists('terms', $input)) $values['terms'] = text_value($input['terms'] ?? '', 1000);
    if ($partial && !$values) fail(400, 'Nothing to update.');
    return $values;
}

function collaborator_offer_out(array $row): array
{
    return [
        'id' => $row['id'], 'collaboratorId' => $row['collaborator_id'], 'prizeId' => $row['prize_id'],
        'rewardName' => $row['reward_name'], 'rewardType' => $row['reward_type'],
        'rewardValue' => (float)$row['reward_value'], 'quantity' => (int)$row['quantity'],
        'terms' => $row['terms'], 'createdAt' => $row['created_at'],
    ];
}

function save_fields(string $table, string $idColumn, string $id, array $values): void
{
    if (!$values) return;
    $sets = [];
    $params = [];
    foreach ($values as $key => $value) {
        $sets[] = "`$key`=?";
        $params[] = $value;
    }
    $params[] = $id;
    run("UPDATE `$table` SET " . implode(',', $sets) . " WHERE `$idColumn`=?", $params);
}

function prize_values(array $input, bool $partial): array
{
    $values = [];
    if (array_key_exists('title', $input) || !$partial) {
        $title = text_value($input['title'] ?? '', 160);
        if (mb_strlen($title) < 2) fail(400, 'Prize title is required.');
        $values['title'] = $title;
    }
    if (array_key_exists('description', $input)) $values['description'] = text_value($input['description'], 2000);
    $type = $input['prizeType'] ?? $input['prize_type'] ?? null;
    if ($type !== null) {
        if (!in_array($type, ['bumper','mega','regular','consolation','voucher'], true)) fail(400, 'Unknown prize type.');
        $values['prize_type'] = $type;
    }
    if (array_key_exists('voucherCode', $input) || array_key_exists('voucher_code', $input)) {
        $rawCode = array_key_exists('voucherCode', $input) ? $input['voucherCode'] : ($input['voucher_code'] ?? '');
        $code = strtoupper(text_value($rawCode, 40));
        if ($code !== '' && !preg_match('/^[A-Z0-9-]{4,40}$/', $code)) fail(400, 'Voucher code may only contain A–Z, 0–9 and hyphens (4–40 chars).');
        $values['voucher_code'] = $code ?: null;
    }
    if (array_key_exists('worth', $input)) {
        $worth = filter_var($input['worth'], FILTER_VALIDATE_INT);
        if ($worth === false || $worth < 0 || $worth > 100000000) fail(400, 'Prize value must be a whole number in paise.');
        $values['worth'] = $worth;
    }
    foreach (['sponsor' => 160, 'cycle' => 60] as $key => $max) if (array_key_exists($key, $input)) $values[$key] = text_value($input[$key], $max);
    if (array_key_exists('quantity', $input)) {
        $quantity = filter_var($input['quantity'], FILTER_VALIDATE_INT);
        if ($quantity === false || $quantity < 1 || $quantity > 100000) fail(400, 'Reward quantity must be between 1 and 100000.');
        $values['quantity'] = $quantity;
    }
    if (array_key_exists('mediaUrls', $input) || array_key_exists('media_urls', $input)) {
        $urls = $input['mediaUrls'] ?? $input['media_urls'];
        if (!is_array($urls) || count($urls) > 12) fail(400, 'Media must be up to 12 valid http(s) URLs.');
        foreach ($urls as $url) if (!is_string($url) || !short_url($url)) fail(400, 'Media must be up to 12 valid http(s) URLs.');
        $values['media_urls'] = json_encode(array_values($urls));
    }
    if (array_key_exists('active', $input) || array_key_exists('isActive', $input)) $values['is_active'] = !empty($input['active'] ?? $input['isActive']);
    if (array_key_exists('status', $input)) {
        if (!in_array($input['status'], ['open','awarded','claimed'], true)) fail(400, 'Unknown prize status.');
        $values['status'] = $input['status'];
    }
    if ($partial && !$values) fail(400, 'Nothing to update.');
    return $values;
}

function admin_order(string $number): ?array
{
    $details = order_details($number);
    if (!$details) return null;
    $customer = $details['customer'];
    $details['customer']['customer_name'] = $customer['full_name'] ?? '';
    return mapped_details($details);
}

function order_status_whatsapp_text(array $details, string $status): string
{
    $order = $details['order'];
    $customer = $details['customer'];
    $copy = [
        'confirmed' => [
            '✅', 'Order confirmed',
            ($order['payment_status'] ?? '') === 'paid'
                ? 'Your payment is confirmed and your order is in our queue.'
                : 'Your order is confirmed. We will update you when payment is verified.',
        ],
        'processing' => ['🛠️', 'We are printing your order', 'Your 3D print is now being prepared by our team.'],
        'packed' => ['📦', 'Packed and ready', 'Your order has been packed and is getting ready to leave our studio.'],
        'shipped' => ['🚚', 'On the way', 'Your order has been shipped. We will share any tracking details separately.'],
        'delivered' => ['🎉', 'Delivered', 'Your order is marked delivered. We hope you love your 3D print!'],
        'cancelled' => ['⚠️', 'Order cancelled', 'Your order has been cancelled. Please contact us if you need help.'],
        'pending' => ['🕓', 'Order update', 'Your order is pending. We will update you when its status changes.'],
    ];
    [$icon, $title, $message] = $copy[$status] ?? ['ℹ️', 'Order update', 'Your order status has changed.'];
    $name = trim((string)($customer['full_name'] ?? ''));
    return ($name !== '' ? "Hi {$name},\n\n" : '')
        . "{$icon} 3D PRINT CO. - {$title}\n"
        . "Order: {$order['order_number']}\n\n"
        . "{$message}\n\n"
        . 'Order total: INR ' . number_format((int)$order['total_amount'] / 100, 2)
        . "\n\n— 3D Print Co.";
}

function whatsapp_lead_counts(): array
{
    $row = one(
        'SELECT SUM(status="new" AND is_business_enquiry=1) AS new_count, '
            . 'SUM(' . whatsapp_overdue_sql('whatsapp_leads') . ') AS overdue_count, '
            . 'SUM((status="new" AND is_business_enquiry=1) OR ' . whatsapp_overdue_sql('whatsapp_leads') . ') AS attention_count '
            . 'FROM whatsapp_leads',
    ) ?? [];
    return [
        'newCount' => (int)($row['new_count'] ?? 0),
        'overdueCount' => (int)($row['overdue_count'] ?? 0),
        'attentionCount' => (int)($row['attention_count'] ?? 0),
    ];
}

function handle_admin(string $path, array $parts): bool
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    global $config;
    if ($path === 'admin/login' && $method === 'POST') {
        guard_admin_write();
        if (!admin_auth_ready()) fail(503, 'Set a real admin email and a strong password in api/config.php.');
        rate_limit('admin-login', 5, 300);
        $input = body();
        $email = strtolower(text_value($input['email'] ?? '', 254));
        $password = text_value($input['password'] ?? '', 200);
        if ($email === '' || $password === '') fail(400, 'Email and password are required.');
        if (!hash_equals(admin_email(), $email) || !hash_equals((string)($config['admin_password'] ?? ''), $password)) {
            usleep(350000);
            fail(401, 'Invalid admin credentials.');
        }
        session_regenerate_id(true);
        $_SESSION['admin_email'] = $email;
        $_SESSION['admin_until'] = time() + 28800;
        respond(200, ['admin' => ['email' => $email], 'expiresIn' => 28800]);
    }
    if ($path === 'admin/logout' && $method === 'POST') {
        guard_admin_write();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
        }
        session_destroy();
        respond(200, ['ok' => true]);
    }
    if ($path === 'admin/session' && $method === 'GET') {
        $session = admin_required();
        respond(200, ['admin' => ['email' => $session['email'], 'expiresAt' => $session['exp']]]);
    }
    if (!str_starts_with($path, 'admin/')) return false;
    $session = admin_required();
    if (!in_array($method, ['GET', 'HEAD'], true)) guard_admin_write();

    if ($path === 'admin/products' && $method === 'GET') {
        $products = all(
            'SELECT p.*, '
            . '(SELECT COALESCE(SUM(i.quantity),0) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=p.id AND o.payment_status="paid") AS sold_count, '
            . '(SELECT COALESCE(SUM(i.quantity),0) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=p.id AND o.payment_status="paid" AND o.created_at>=UTC_TIMESTAMP()-INTERVAL 30 DAY) AS recent_sold_count '
            . 'FROM products p ORDER BY p.created_at DESC'
        );
        respond(200, ['products' => array_map('product_out', $products)]);
    }
    if ($path === 'admin/products' && $method === 'POST') {
        $input = body();
        $values = product_values($input, false);
        validate_product_promotion($values);
        $base = $values['slug'] ?? strtolower(trim((string)preg_replace('/[^a-z0-9]+/i', '-', $values['name']), '-'));
        $slug = substr($base, 0, 80);
        for ($i = 1; one('SELECT id FROM products WHERE slug=?', [$slug]); $i++) {
            $slug = substr($base, 0, 72) . '-' . ($i + 1);
            if ($i > 40) $slug .= '-' . time();
        }
        $row = array_merge([
            'id' => new_id(), 'slug' => $slug, 'name' => '', 'description' => '',
            'price' => 0, 'mrp' => null, 'category' => 'Uncategorised', 'stock_quantity' => 0,
            'promotion_price' => null, 'promotion_start_at' => null, 'promotion_end_at' => null,
            'images' => '[]', 'video_url' => null, 'specifications' => '{}',
            'material' => '', 'dimensions' => '', 'print_time' => '', 'badge' => null,
            'variant' => 'lattice', 'accent' => '#a78bfa', 'model_url' => null,
            'rating' => 0, 'reviews' => 0, 'is_active' => 1,
        ], $values);
        $columns = array_keys($row);
        run('INSERT INTO products (' . implode(',', array_map(static fn($v) => "`$v`", $columns)) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')', array_values($row));
        respond(201, ['product' => product_out(one('SELECT * FROM products WHERE id=?', [$row['id']]))]);
    }
    if (preg_match('#^admin/products/([^/]+)$#', $path, $match)) {
        $id = rawurldecode($match[1]);
        $existing = one('SELECT * FROM products WHERE id=?', [$id]);
        if (!$existing) fail(404, 'Product not found.');
        if ($method === 'DELETE') {
            run('UPDATE products SET is_active=0 WHERE id=?', [$id]);
            respond(200, ['ok' => true, 'deactivated' => true]);
        }
        if ($method === 'PATCH') {
            $values = product_values(body(), true);
            validate_product_promotion($values, $existing);
            save_fields('products', 'id', $id, $values);
            respond(200, ['product' => product_out(one('SELECT * FROM products WHERE id=?', [$id]))]);
        }
    }

    if ($path === 'admin/customers' && $method === 'GET') {
        $q = text_value($_GET['q'] ?? '', 80);
        $customers = $q === ''
            ? all('SELECT * FROM customers ORDER BY created_at DESC LIMIT 500')
            : all('SELECT * FROM customers WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR customer_code LIKE ? ORDER BY created_at DESC LIMIT 500', array_fill(0, 4, '%' . $q . '%'));
        $result = [];
        foreach ($customers as $customer) {
            $agg = one('SELECT SUM(order_status<>"cancelled") AS orders, SUM(payment_status="paid") AS paid_orders, SUM(IF(payment_status="paid",total_amount,0)) AS spend FROM orders WHERE customer_id=?', [$customer['id']]) ?? [];
            $result[] = array_merge(customer_out($customer), [
                'orders' => (int)($agg['orders'] ?? 0), 'paidOrders' => (int)($agg['paid_orders'] ?? 0),
                'spend' => (int)($agg['spend'] ?? 0),
            ]);
        }
        respond(200, ['customers' => $result]);
    }
    if ($path === 'admin/leads' && $method === 'GET') {
        $leads = all(
            'SELECT l.id, l.chat_id, l.phone_e164, l.contact_name, l.last_message, l.last_message_at, l.status, l.is_business_enquiry, '
                . 'l.is_existing_customer, l.enquiry_interest, l.details_requested_at, l.auto_followup_due_at, '
                . 'l.auto_followup_sent_at, l.last_admin_reply_at, l.created_at, l.updated_at, '
                . '(SELECT MAX(m.created_at) FROM whatsapp_messages m WHERE m.lead_id=l.id AND m.direction="inbound") AS last_inbound_at, '
                . 'c.customer_code AS linked_customer_code, c.full_name AS linked_customer_name, c.email AS linked_customer_email, '
                . 'c.phone AS linked_customer_phone, c.delivery_address AS linked_customer_address, c.city AS linked_customer_city, '
                . 'c.state AS linked_customer_state, c.postal_code AS linked_customer_postal_code, c.marketing_opt_in AS linked_marketing_opt_in '
                . 'FROM whatsapp_leads l LEFT JOIN customers c ON c.id=l.customer_id '
                . 'ORDER BY FIELD(l.status,"new","active","closed"), l.updated_at DESC LIMIT 500',
        );
        $counts = whatsapp_lead_counts();
        respond(200, [
            'leads' => array_map(static fn(array $lead): array => [
                'id' => $lead['id'],
                'chatId' => $lead['chat_id'],
                'phone' => $lead['phone_e164'] ? '+' . $lead['phone_e164'] : $lead['chat_id'],
                'name' => $lead['contact_name'],
                'lastMessage' => $lead['last_message'],
                'lastMessageAt' => $lead['last_message_at'],
                'status' => $lead['status'],
                'isBusinessEnquiry' => (bool)$lead['is_business_enquiry'],
                'isExistingCustomer' => (bool)$lead['is_existing_customer'],
                'enquiryInterest' => $lead['enquiry_interest'] ?? '',
                'detailsRequestedAt' => $lead['details_requested_at'],
                'autoFollowupDueAt' => $lead['auto_followup_due_at'],
                'autoFollowupSentAt' => $lead['auto_followup_sent_at'],
                'lastAdminReplyAt' => $lead['last_admin_reply_at'],
                'lastInboundAt' => utc_iso($lead['last_inbound_at'] ?? $lead['last_message_at']),
                'awaitingAdminSince' => utc_iso(whatsapp_awaiting_admin_since($lead, $lead['last_inbound_at'] ?? null)),
                'createdAt' => $lead['created_at'],
                'updatedAt' => $lead['updated_at'],
                'chatUrl' => $lead['phone_e164'] ? 'https://wa.me/' . $lead['phone_e164'] : '',
                'customer' => $lead['linked_customer_code'] ? [
                    'customerCode' => $lead['linked_customer_code'],
                    'name' => $lead['linked_customer_name'],
                    'email' => $lead['linked_customer_email'] ?? '',
                    'phone' => $lead['linked_customer_phone'],
                    'address' => $lead['linked_customer_address'] ?? '',
                    'city' => $lead['linked_customer_city'] ?? '',
                    'state' => $lead['linked_customer_state'] ?? '',
                    'postalCode' => $lead['linked_customer_postal_code'] ?? '',
                    'marketingOptIn' => (bool)$lead['linked_marketing_opt_in'],
                ] : null,
            ], $leads),
            'newCount' => $counts['newCount'],
            'overdueCount' => $counts['overdueCount'],
        ]);
    }
    if ($path === 'admin/leads/count' && $method === 'GET') {
        respond(200, whatsapp_lead_counts());
    }
    if ($path === 'admin/whatsapp/messages' && $method === 'GET') {
        $chatId = text_value($_GET['chatId'] ?? '', 120);
        if (!preg_match('/^(?:\d{6,20}@c\.us|[A-Za-z0-9_-]{1,100}@lid)$/', $chatId)) fail(400, 'A valid WhatsApp chat is required.');
        $lead = one('SELECT id FROM whatsapp_leads WHERE chat_id=?', [$chatId]);
        $messages = $lead
            ? all('SELECT id, direction, message_type, body, created_at FROM whatsapp_messages WHERE lead_id=? ORDER BY created_at DESC LIMIT 200', [$lead['id']])
            : [];
        respond(200, ['messages' => array_reverse(array_map(static fn(array $message): array => [
            'id' => $message['id'],
            'direction' => $message['direction'],
            'type' => $message['message_type'],
            'body' => $message['body'],
            'createdAt' => $message['created_at'],
        ], $messages))]);
    }
    if ($path === 'admin/whatsapp/messages' && $method === 'POST') {
        $input = body();
        $phone = text_value($input['phone'] ?? '', 24);
        $chatId = text_value($input['chatId'] ?? '', 120);
        if ($chatId === '' && $phone !== '') $chatId = whatsapp_chat_id_from_phone($phone);
        if (!preg_match('/^(?:\d{6,20}@c\.us|[A-Za-z0-9_-]{1,100}@lid)$/', $chatId)) fail(400, 'A valid WhatsApp chat is required.');
        $message = text_value($input['message'] ?? '', 4000);
        if ($message === '') fail(400, 'Enter a message to send.');
        $name = text_value($input['name'] ?? '', 120);
        send_whatsapp_admin_message($chatId, $name, $phone !== '' ? preg_replace('/\D/', '', $phone) : null, $message);
        respond(201, ['sent' => true]);
    }
    if (preg_match('#^admin/leads/([0-9a-f-]{36})$#i', $path, $match) && $method === 'PATCH') {
        $id = rawurldecode($match[1]);
        if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail(400, 'A valid lead id is required.');
        $status = text_value(body()['status'] ?? '', 20);
        if (!in_array($status, ['new','active','closed'], true)) fail(400, 'Unknown lead status.');
        $result = run('UPDATE whatsapp_leads SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [$status, $id]);
        if ($result->rowCount() === 0 && !one('SELECT id FROM whatsapp_leads WHERE id=?', [$id])) fail(404, 'Lead not found.');
        $lead = one(
            'SELECT l.id, l.chat_id, l.phone_e164, l.contact_name, l.last_message, l.last_message_at, l.status, l.is_business_enquiry, '
                . 'l.is_existing_customer, l.enquiry_interest, l.details_requested_at, l.created_at, l.updated_at, '
                . '(SELECT MAX(m.created_at) FROM whatsapp_messages m WHERE m.lead_id=l.id AND m.direction="inbound") AS last_inbound_at, '
                . 'c.customer_code AS linked_customer_code, c.full_name AS linked_customer_name, c.email AS linked_customer_email, '
                . 'c.phone AS linked_customer_phone, c.delivery_address AS linked_customer_address, c.city AS linked_customer_city, '
                . 'c.state AS linked_customer_state, c.postal_code AS linked_customer_postal_code, c.marketing_opt_in AS linked_marketing_opt_in '
                . 'FROM whatsapp_leads l LEFT JOIN customers c ON c.id=l.customer_id WHERE l.id=?',
            [$id],
        );
        respond(200, ['lead' => [
            'id' => $lead['id'], 'chatId' => $lead['chat_id'], 'phone' => $lead['phone_e164'] ? '+' . $lead['phone_e164'] : $lead['chat_id'], 'name' => $lead['contact_name'],
            'lastMessage' => $lead['last_message'], 'lastMessageAt' => $lead['last_message_at'],
            'status' => $lead['status'], 'createdAt' => $lead['created_at'],
            'isBusinessEnquiry' => (bool)$lead['is_business_enquiry'],
            'isExistingCustomer' => (bool)$lead['is_existing_customer'],
            'enquiryInterest' => $lead['enquiry_interest'] ?? '',
            'detailsRequestedAt' => $lead['details_requested_at'],
            'lastInboundAt' => utc_iso($lead['last_inbound_at'] ?? $lead['last_message_at']),
            'awaitingAdminSince' => utc_iso(whatsapp_awaiting_admin_since($lead, $lead['last_inbound_at'] ?? null)),
            'updatedAt' => $lead['updated_at'], 'chatUrl' => $lead['phone_e164'] ? 'https://wa.me/' . $lead['phone_e164'] : '',
            'customer' => $lead['linked_customer_code'] ? [
                'customerCode' => $lead['linked_customer_code'], 'name' => $lead['linked_customer_name'],
                'email' => $lead['linked_customer_email'] ?? '', 'phone' => $lead['linked_customer_phone'],
                'address' => $lead['linked_customer_address'] ?? '', 'city' => $lead['linked_customer_city'] ?? '',
                'state' => $lead['linked_customer_state'] ?? '', 'postalCode' => $lead['linked_customer_postal_code'] ?? '',
                'marketingOptIn' => (bool)$lead['linked_marketing_opt_in'],
            ] : null,
        ]]);
    }
    if (preg_match('#^admin/customers/([^/]+)$#', $path, $match) && $method === 'GET') {
        $ref = rawurldecode($match[1]);
        $column = preg_match('/^[0-9a-f-]{36}$/i', $ref) ? 'id' : 'customer_code';
        $customer = one("SELECT * FROM customers WHERE `$column`=?", [$column === 'customer_code' ? strtoupper($ref) : $ref]);
        if (!$customer) fail(404, 'Customer not found.');
        $orders = all('SELECT * FROM orders WHERE customer_id=? ORDER BY created_at DESC', [$customer['id']]);
        $out = [];
        foreach ($orders as $order) $out[] = mapped_details(order_details($order['order_number']));
        $summary = array_merge(customer_out($customer), [
            'orders' => count(array_filter($orders, static fn($o) => $o['order_status'] !== 'cancelled')),
            'paidOrders' => count(array_filter($orders, static fn($o) => $o['payment_status'] === 'paid')),
            'spend' => array_sum(array_map(static fn($o) => $o['payment_status'] === 'paid' ? (int)$o['total_amount'] : 0, $orders)),
        ]);
        respond(200, ['customer' => $summary, 'orders' => $out]);
    }
    if ($path === 'admin/orders' && $method === 'GET') {
        $sql = 'SELECT o.* FROM orders o JOIN customers c ON c.id=o.customer_id WHERE 1=1';
        $values = [];
        foreach (['paymentStatus' => 'payment_status', 'orderStatus' => 'order_status'] as $key => $column) {
            if (isset($_GET[$key]) && in_array($_GET[$key], ['pending','paid','failed','refunded','confirmed','processing','packed','shipped','delivered','cancelled'], true)) {
                $sql .= " AND o.$column=?";
                $values[] = $_GET[$key];
            }
        }
        $q = text_value($_GET['q'] ?? '', 80);
        if ($q !== '') {
            $sql .= ' AND (o.order_number LIKE ? OR c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ?)';
            for ($i=0; $i<5; $i++) $values[] = '%' . $q . '%';
        }
        $rows = all($sql . ' ORDER BY o.created_at DESC LIMIT 200', $values);
        $out = [];
        foreach ($rows as $order) $out[] = mapped_details(order_details($order['order_number']));
        respond(200, ['orders' => $out]);
    }
    if (preg_match('#^admin/orders/([^/]+)$#', $path, $match) && $method === 'PATCH') {
        $input = body();
        $status = text_value($input['orderStatus'] ?? $input['status'] ?? '', 20);
        if (!in_array($status, ['pending','confirmed','processing','packed','shipped','delivered','cancelled'], true)) fail(400, 'Unknown order status.');
        $number = rawurldecode($match[1]);
        $details = order_details($number);
        if (!$details) fail(404, 'Order not found.');
        $changed = run(
            'UPDATE orders SET order_status=? WHERE order_number=? AND order_status<>?',
            [$status, $number, $status],
        )->rowCount() > 0;
        $whatsappStatus = 'not_configured';
        if ($changed) {
            $details = order_details($number);
            if (!empty($details['customer']['email'])) notify_event(
                $details['customer']['email'], 'order.status',
                'Order ' . $details['order']['order_number'] . ' is now ' . $status,
                order_status_whatsapp_text($details, $status),
                ['orderNumber' => $details['order']['order_number'], 'status' => $status]
            );
            if (!empty($details['customer']['phone'])) {
                global $config;
                $whatsappStatus = !empty($config['waapi_api_token']) && !empty($config['waapi_instance_id'])
                    ? (send_whatsapp_notification(
                    (string)$details['customer']['phone'],
                    (string)($details['customer']['full_name'] ?? ''),
                    order_status_whatsapp_text($details, $status),
                    ) ? 'sent' : 'failed')
                    : 'not_configured';
            }
        }
        respond(200, ['order' => mapped_details($details), 'notifications' => [
            'whatsapp' => $changed ? $whatsappStatus : 'unchanged',
        ]]);
    }

    if ($path === 'admin/campaigns/audience' && $method === 'GET') {
        $count = one('SELECT COUNT(*) AS count FROM customers WHERE marketing_opt_in=1 AND phone<>""');
        $audience = all('SELECT id,customer_code,full_name,email,phone FROM customers WHERE marketing_opt_in=1 AND phone<>"" ORDER BY updated_at DESC');
        respond(200, ['count' => (int)($count['count'] ?? 0), 'customers' => array_map(static fn($customer) => [
            'customerCode' => $customer['customer_code'], 'name' => $customer['full_name'],
            'email' => $customer['email'] ?? '', 'phone' => $customer['phone'],
        ], $audience)]);
    }
    if ($path === 'admin/campaigns' && $method === 'GET') {
        $campaigns = all('SELECT * FROM whatsapp_campaigns ORDER BY created_at DESC LIMIT 100');
        respond(200, ['campaigns' => array_map(static fn($campaign) => [
            'id' => $campaign['id'], 'message' => $campaign['message'],
            'recipientCount' => (int)$campaign['recipient_count'],
            'sentCount' => (int)$campaign['sent_count'], 'failedCount' => (int)$campaign['failed_count'],
            'skippedCount' => (int)$campaign['skipped_count'],
            'createdAt' => $campaign['created_at'],
        ], $campaigns)]);
    }
    if ($path === 'admin/campaigns' && $method === 'POST') {
        $message = text_value(body()['message'] ?? '', 1000);
        if ($message === '') fail(400, 'Campaign message is required.');
        if (empty($config['waapi_api_token']) || empty($config['waapi_instance_id'])) fail(503, 'WaAPI is not configured for sending campaigns.');
        if (preg_match('/\b(?:stop|unsubscribe|opt[\s-]?out)\b/i', $message) !== 1) {
            fail(400, 'Add a clear opt-out instruction such as “Reply STOP” before creating a campaign.');
        }
        $audience = all('SELECT id FROM customers WHERE marketing_opt_in=1 AND phone<>"" ORDER BY updated_at DESC');
        if (!$audience) fail(409, 'There are no customers with WhatsApp marketing consent.');
        $campaignId = new_id();
        $pdo = db();
        $pdo->beginTransaction();
        try {
            run('INSERT INTO whatsapp_campaigns (id,message,created_by,recipient_count) VALUES (?,?,?,?)', [
                $campaignId, $message, $session['email'], count($audience),
            ]);
            foreach ($audience as $customer) {
                run('INSERT INTO whatsapp_campaign_recipients (id,campaign_id,customer_id,status) VALUES (?,?,?,"pending")', [
                    new_id(), $campaignId, $customer['id'],
                ]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        respond(201, ['campaign' => [
            'id' => $campaignId, 'message' => $message,
            'recipientCount' => count($audience), 'sentCount' => 0, 'failedCount' => 0, 'skippedCount' => 0,
            'createdAt' => date(DATE_ATOM),
        ]]);
    }
    if (preg_match('#^admin/campaigns/([0-9a-f-]{36})/send$#i', $path, $match) && $method === 'POST') {
        $campaignId = $match[1];
        $campaign = one('SELECT * FROM whatsapp_campaigns WHERE id=?', [$campaignId]);
        if (!$campaign) fail(404, 'Campaign not found.');
        $pdo = db();
        $pdo->beginTransaction();
        try {
            run(
                'UPDATE whatsapp_campaign_recipients r JOIN customers c ON c.id=r.customer_id '
                . 'SET r.status="skipped",r.error_message="Marketing consent is no longer active." '
                . 'WHERE r.campaign_id=? AND r.status="pending" AND c.marketing_opt_in<>1',
                [$campaignId],
            );
            run(
                'UPDATE whatsapp_campaign_recipients SET status="pending" '
                . 'WHERE campaign_id=? AND status="sending" AND updated_at<UTC_TIMESTAMP()-INTERVAL 15 MINUTE',
                [$campaignId],
            );
            $recipients = all(
                'SELECT r.id AS recipient_id,c.id,c.full_name,c.phone FROM whatsapp_campaign_recipients r '
                . 'JOIN customers c ON c.id=r.customer_id WHERE r.campaign_id=? AND r.status="pending" '
                . 'AND c.marketing_opt_in=1 ORDER BY r.created_at ASC LIMIT 3 FOR UPDATE',
                [$campaignId],
            );
            foreach ($recipients as $recipient) {
                run('UPDATE whatsapp_campaign_recipients SET status="sending" WHERE id=? AND status="pending"', [$recipient['recipient_id']]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        foreach ($recipients as $recipient) {
            $consented = one('SELECT marketing_opt_in FROM customers WHERE id=?', [$recipient['id']]);
            $sent = $consented && (bool)$consented['marketing_opt_in']
                && send_whatsapp_notification((string)$recipient['phone'], (string)$recipient['full_name'], (string)$campaign['message']);
            run(
                'UPDATE whatsapp_campaign_recipients SET status=?,error_message=? WHERE id=? AND status="sending"',
                [$consented && (bool)$consented['marketing_opt_in'] ? ($sent ? 'sent' : 'failed') : 'skipped',
                    $sent ? null : ($consented && (bool)$consented['marketing_opt_in'] ? 'WaAPI did not accept the message.' : 'Marketing consent is no longer active.'),
                    $recipient['recipient_id']],
            );
        }
        $summary = one(
            'SELECT SUM(status IN ("pending","sending")) AS remaining,SUM(status="sent") AS sent,'
            . 'SUM(status="failed") AS failed,SUM(status="skipped") AS skipped '
            . 'FROM whatsapp_campaign_recipients WHERE campaign_id=?',
            [$campaignId],
        );
        run('UPDATE whatsapp_campaigns SET sent_count=?,failed_count=?,skipped_count=? WHERE id=?', [
            (int)($summary['sent'] ?? 0), (int)($summary['failed'] ?? 0), (int)($summary['skipped'] ?? 0), $campaignId,
        ]);
        respond(200, [
            'campaignId' => $campaignId, 'processed' => count($recipients),
            'sentCount' => (int)($summary['sent'] ?? 0), 'failedCount' => (int)($summary['failed'] ?? 0),
            'skippedCount' => (int)($summary['skipped'] ?? 0),
            'remaining' => (int)($summary['remaining'] ?? 0),
        ]);
    }

    if ($path === 'admin/insights' && $method === 'GET') {
        $summary = one(
            'SELECT '
            . '(SELECT COUNT(*) FROM whatsapp_leads WHERE is_business_enquiry=1 AND is_existing_customer=0) AS enquiries, '
            . '(SELECT COUNT(*) FROM whatsapp_leads WHERE is_business_enquiry=1 AND is_existing_customer=0 AND converted_at IS NOT NULL) AS conversions, '
            . '(SELECT COUNT(*) FROM orders WHERE payment_status="paid") AS paid_orders, '
            . '(SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE payment_status="paid") AS revenue'
        );
        // Timestamps are stored in UTC; every reported day and hour is IST.
        $ist = 'CONVERT_TZ(created_at, "+00:00", "+05:30")';
        $daily = all(
            'SELECT DATE(' . $ist . ') AS day,COUNT(*) AS orders FROM orders WHERE payment_status="paid" '
            . 'AND created_at>=UTC_TIMESTAMP()-INTERVAL 30 DAY GROUP BY DATE(' . $ist . ') ORDER BY day'
        );
        $istEnquiry = 'CONVERT_TZ(business_enquiry_at, "+00:00", "+05:30")';
        $heat = all(
            'SELECT DAYOFWEEK(' . $istEnquiry . ')-1 AS weekday,HOUR(' . $istEnquiry . ') AS hour,COUNT(*) AS count '
            . 'FROM whatsapp_leads WHERE is_business_enquiry=1 AND is_existing_customer=0 AND business_enquiry_at>=UTC_TIMESTAMP()-INTERVAL 90 DAY '
            . 'GROUP BY DAYOFWEEK(' . $istEnquiry . '),HOUR(' . $istEnquiry . ')'
        );
        $products = all(
            'SELECT p.id,p.name,COALESCE(SUM(IF(o.payment_status="paid",i.quantity,0)),0) AS units,'
            . 'COALESCE(SUM(IF(o.payment_status="paid",i.total_price,0)),0) AS revenue,'
            . 'COALESCE(SUM(IF(o.payment_status="paid" AND o.created_at>=UTC_TIMESTAMP()-INTERVAL 30 DAY,i.quantity,0)),0) AS recent_units '
            . 'FROM products p LEFT JOIN order_items i ON i.product_id=p.id LEFT JOIN orders o ON o.id=i.order_id AND o.payment_status="paid" '
            . 'GROUP BY p.id,p.name ORDER BY units DESC,revenue DESC LIMIT 20'
        );
        $rank = 0;
        $productRows = [];
        foreach ($products as $product) {
            if ((int)$product['units'] > 0) $rank++;
            $tag = (int)$product['recent_units'] >= 3 ? 'Hot' : (((int)$product['units'] > 0 && $rank === 1) ? 'Best seller' : null);
            $productRows[] = [
                'id' => $product['id'], 'name' => $product['name'],
                'units' => (int)$product['units'], 'recentUnits' => (int)$product['recent_units'],
                'revenue' => (int)$product['revenue'], 'trendTag' => $tag,
            ];
        }
        respond(200, [
            'summary' => [
                'enquiries' => (int)$summary['enquiries'], 'conversions' => (int)$summary['conversions'],
                'conversionRate' => (int)$summary['enquiries'] > 0 ? round((int)$summary['conversions'] * 100 / (int)$summary['enquiries'], 1) : 0,
                'paidOrders' => (int)$summary['paid_orders'], 'revenue' => (int)$summary['revenue'],
            ],
            'dailyPaidOrders' => array_map(static fn($row) => ['day' => $row['day'], 'count' => (int)$row['orders']], $daily),
            'enquiryHeatmap' => array_map(static fn($row) => [
                'weekday' => (int)$row['weekday'], 'hour' => (int)$row['hour'], 'count' => (int)$row['count'],
            ], $heat),
            'products' => $productRows,
        ]);
    }

    if ($path === 'admin/prizes' && $method === 'GET') {
        $prizes = all(
            'SELECT p.*, GREATEST(p.quantity-(SELECT COUNT(*) FROM customer_prizes cp WHERE cp.prize_id=p.id AND cp.released_at IS NULL),0) AS available_quantity '
            . 'FROM prizes p ORDER BY p.created_at DESC'
        );
        $assignments = all('SELECT cp.*,c.customer_code,c.full_name,c.email,p.title FROM customer_prizes cp JOIN customers c ON c.id=cp.customer_id JOIN prizes p ON p.id=cp.prize_id ORDER BY cp.assigned_at DESC');
        $active = [];
        foreach ($assignments as $assignment) if ($assignment['released_at'] === null && !isset($active[$assignment['prize_id']])) $active[$assignment['prize_id']] = $assignment;
        $mappedPrizes = [];
        foreach ($prizes as $prize) {
            $out = prize_out($prize);
            $a = $active[$prize['id']] ?? null;
            if ($a) {
                $out['awardedTo'] = $a['customer_code']; $out['awardedToName'] = $a['full_name'];
                $out['awardedAt'] = $a['assigned_at']; $out['notificationStatus'] = $a['notification_status'];
            }
            $mappedPrizes[] = $out;
        }
        $mappedAssignments = array_map(static fn($a) => [
            'id' => $a['id'], 'prizeId' => $a['prize_id'], 'prizeTitle' => $a['title'],
            'customerId' => $a['customer_code'], 'customerName' => $a['full_name'],
            'customerEmail' => $a['email'] ?? '', 'assignedBy' => $a['assigned_by'],
            'notificationStatus' => $a['notification_status'], 'assignedAt' => $a['assigned_at'],
            'releasedAt' => $a['released_at'], 'notes' => $a['notes'] ?? '',
        ], $assignments);
        respond(200, ['prizes' => $mappedPrizes, 'assignments' => $mappedAssignments]);
    }
    if ($path === 'admin/prizes' && $method === 'POST') {
        $v = prize_values(body(), false);
        $row = array_merge([
            'id' => new_id(), 'title' => '', 'description' => '', 'prize_type' => 'regular',
            'voucher_code' => null, 'worth' => 0, 'sponsor' => '', 'cycle' => '',
            'status' => 'open', 'quantity' => 1, 'media_urls' => '[]', 'is_active' => 1,
        ], $v);
        $columns = array_keys($row);
        run('INSERT INTO prizes (' . implode(',', array_map(static fn($x) => "`$x`", $columns)) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')', array_values($row));
        respond(201, ['prize' => prize_out(one('SELECT * FROM prizes WHERE id=?', [$row['id']]))]);
    }
    if (preg_match('#^admin/prizes/([0-9a-f-]{36})$#i', $path, $match)) {
        $id = rawurldecode($match[1]);
        if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) fail(400, 'A valid prize id is required.');
        $prize = one('SELECT * FROM prizes WHERE id=?', [$id]);
        if (!$prize) fail(404, 'Prize not found.');
        if ($method === 'DELETE') {
            run('UPDATE prizes SET is_active=0 WHERE id=?', [$id]);
            respond(200, ['ok' => true]);
        }
        if ($method === 'PATCH') {
            $v = prize_values(body(), true);
            if (($v['status'] ?? null) === 'open') {
                run('UPDATE customer_prizes SET released_at=CURRENT_TIMESTAMP,active_prize_id=NULL WHERE prize_id=? AND released_at IS NULL', [$id]);
                run('UPDATE prizes SET status="open" WHERE id=?', [$id]);
                unset($v['status']);
            }
            if (isset($v['quantity'])) {
                $assigned = one('SELECT COUNT(*) AS count FROM customer_prizes WHERE prize_id=? AND released_at IS NULL', [$id]);
                $assignedCount = (int)($assigned['count'] ?? 0);
                if ($assignedCount > $v['quantity']) fail(409, 'Quantity cannot be lower than the number of active gift cards already assigned.');
                if (!isset($v['status']) && $prize['status'] !== 'claimed') {
                    $v['status'] = $assignedCount >= $v['quantity'] ? 'awarded' : 'open';
                }
            }
            save_fields('prizes', 'id', $id, $v);
            respond(200, ['prize' => prize_out(one('SELECT * FROM prizes WHERE id=?', [$id]))]);
        }
    }
    if ($path === 'admin/prizes/assign' && $method === 'POST') {
        $input = body();
        $prizeId = text_value($input['prizeId'] ?? '', 64);
        $customerRef = strtoupper(text_value($input['customerId'] ?? '', 64));
        if (!preg_match('/^[0-9a-f-]{36}$/i', $prizeId)) fail(400, 'Select a valid prize.');
        if ($customerRef === '') fail(400, 'Select a customer.');
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $prize = one('SELECT * FROM prizes WHERE id=? FOR UPDATE', [$prizeId]);
            if (!$prize) fail(404, 'Prize not found.');
            if (!(bool)$prize['is_active'] || $prize['status'] !== 'open') fail(409, 'This reward is not currently available.');
            $assignedCount = one('SELECT COUNT(*) AS count FROM customer_prizes WHERE prize_id=? AND released_at IS NULL', [$prizeId]);
            if ((int)($assignedCount['count'] ?? 0) >= (int)$prize['quantity']) {
                run('UPDATE prizes SET status="awarded" WHERE id=?', [$prizeId]);
                fail(409, 'No units of this reward remain.');
            }
            $column = preg_match('/^[0-9a-f-]{36}$/i', $customerRef) ? 'id' : 'customer_code';
            $customer = one("SELECT * FROM customers WHERE `$column`=?", [$customerRef]);
            if (!$customer) fail(404, 'Customer not found. Check the customer code.');
            if (!one('SELECT id FROM orders WHERE customer_id=? AND payment_status="paid" LIMIT 1', [$customer['id']])) fail(409, 'This customer has no paid orders and is not eligible for assignment.');
            if (one('SELECT id FROM customer_prizes WHERE prize_id=? AND customer_id=? AND released_at IS NULL LIMIT 1', [$prizeId, $customer['id']])) {
                fail(409, 'This customer already has an active assignment for this reward.');
            }
            $notes = text_value($input['notes'] ?? '', 500);
            $assignmentId = new_id();
            $revealToken = bin2hex(random_bytes(32));
            run('INSERT INTO customer_prizes (id,customer_id,prize_id,active_prize_id,assigned_by,notification_status,notes,reveal_token) VALUES (?,?,?,?,?,?,?,?)', [
                $assignmentId, $customer['id'], $prizeId, $prizeId, $session['email'], 'not_configured', $notes ?: null, $revealToken,
            ]);
            run(
                'UPDATE prizes SET status=IF((SELECT COUNT(*) FROM customer_prizes WHERE prize_id=? AND released_at IS NULL)>=quantity,"awarded","open") WHERE id=?',
                [$prizeId, $prizeId],
            );
            $pdo->commit();
            global $config;
            $storefront = rtrim((string)($config['storefront_url'] ?? ''), '/');
            $revealUrl = short_url($storefront) && strtolower((string)parse_url($storefront, PHP_URL_SCHEME)) === 'https'
                ? $storefront . '/reward/' . $revealToken
                : '';
            $message = "🎉 Congratulations, {$customer['full_name']}!\n"
                . "3D Print Co. has a surprise reward for you.\n\n"
                . "Scratch to reveal your reward: " . ($revealUrl ?: 'Please contact our support team.') . "\n\n"
                . 'Your reward is hidden until you reveal it. — 3D Print Co.';
            $deliveryStatuses = [];
            if ($revealUrl !== '' && !empty($customer['email'])) {
                $deliveryStatuses[] = notify_event(
                    $customer['email'], 'prize.assigned', 'A surprise reward is waiting for you',
                    $message, ['phone' => $customer['phone']]
                );
            }
            if ($revealUrl !== '' && !empty($customer['phone'])) {
                $deliveryStatuses[] = !empty($config['waapi_api_token']) && !empty($config['waapi_instance_id'])
                    ? (send_whatsapp_notification((string)$customer['phone'], (string)$customer['full_name'], $message) ? 'sent' : 'failed')
                    : 'not_configured';
            }
            $notificationStatus = in_array('sent', $deliveryStatuses, true)
                ? 'sent'
                : (in_array('failed', $deliveryStatuses, true) ? 'failed' : 'not_configured');
            run('UPDATE customer_prizes SET notification_status=? WHERE id=?', [$notificationStatus, $assignmentId]);
            respond(201, ['assignment' => [
                'id' => $assignmentId, 'prizeId' => $prizeId, 'prizeTitle' => $prize['title'],
                'customerId' => $customer['customer_code'], 'customerName' => $customer['full_name'],
                'customerEmail' => $customer['email'] ?? '', 'assignedBy' => $session['email'],
                'notificationStatus' => $notificationStatus, 'assignedAt' => date(DATE_ATOM),
                'revealUrl' => $revealUrl, 'notes' => $notes,
            ]]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    if ($path === 'admin/collaborators' && $method === 'GET') {
        $collaborators = all('SELECT * FROM collaborators ORDER BY is_active DESC,name ASC');
        $offers = all('SELECT * FROM collaborator_offers ORDER BY created_at DESC');
        $offersByCollaborator = [];
        foreach ($offers as $offer) $offersByCollaborator[$offer['collaborator_id']][] = collaborator_offer_out($offer);
        respond(200, ['collaborators' => array_map(static fn(array $row): array => [
            'id' => $row['id'], 'name' => $row['name'], 'contactName' => $row['contact_name'],
            'email' => $row['email'] ?? '', 'phone' => $row['phone'], 'notes' => $row['notes'],
            'active' => (bool)$row['is_active'], 'createdAt' => $row['created_at'],
            'offers' => $offersByCollaborator[$row['id']] ?? [],
        ], $collaborators)]);
    }
    if ($path === 'admin/collaborators' && $method === 'POST') {
        $values = collaborator_values(body(), false);
        $row = array_merge(['id' => new_id(), 'is_active' => 1], $values);
        $columns = array_keys($row);
        run(
            'INSERT INTO collaborators (' . implode(',', array_map(static fn(string $column): string => "`$column`", $columns)) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')',
            array_values($row),
        );
        respond(201, ['collaborator' => ['id' => $row['id'], 'name' => $row['name'], 'contactName' => $row['contact_name'], 'email' => $row['email'] ?? '', 'phone' => $row['phone'], 'notes' => $row['notes'], 'active' => true, 'offers' => []]]);
    }
    if (preg_match('#^admin/collaborators/([0-9a-f-]{36})$#i', $path, $match) && $method === 'PATCH') {
        $id = $match[1];
        $values = collaborator_values(body(), true);
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $result = run(
                'UPDATE collaborators SET ' . implode(',', array_map(static fn(string $column): string => "`$column`=?", array_keys($values))) . ' WHERE id=?',
                [...array_values($values), $id],
            );
            $row = one('SELECT * FROM collaborators WHERE id=?', [$id]);
            if (!$row) {
                $pdo->rollBack();
                fail(404, 'Collaborator not found.');
            }
            if (array_key_exists('name', $values) || array_key_exists('is_active', $values)) {
                $offers = all('SELECT prize_id FROM collaborator_offers WHERE collaborator_id=?', [$id]);
                foreach ($offers as $offer) {
                    $claimed = one('SELECT COUNT(*) AS count FROM customer_prizes WHERE prize_id=? AND released_at IS NULL', [$offer['prize_id']]);
                    run(
                        'UPDATE prizes SET sponsor=?,is_active=?,status=IF(?=1 AND ?<quantity,"open",status) WHERE id=?',
                        [$row['name'], (int)$row['is_active'], (int)$row['is_active'], (int)($claimed['count'] ?? 0), $offer['prize_id']],
                    );
                }
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        $row = one('SELECT * FROM collaborators WHERE id=?', [$id]);
        respond(200, ['collaborator' => [
            'id' => $row['id'], 'name' => $row['name'], 'contactName' => $row['contact_name'],
            'email' => $row['email'] ?? '', 'phone' => $row['phone'], 'notes' => $row['notes'],
            'active' => (bool)$row['is_active'],
        ]]);
    }
    if (preg_match('#^admin/collaborators/([0-9a-f-]{36})/offers$#i', $path, $match) && $method === 'POST') {
        $collaboratorId = $match[1];
        $collaborator = one('SELECT * FROM collaborators WHERE id=?', [$collaboratorId]);
        if (!$collaborator) fail(404, 'Collaborator not found.');
        if (!(bool)$collaborator['is_active']) fail(409, 'Activate this collaborator before adding an offer.');
        $values = collaborator_offer_values(body(), false);
        if ($values['reward_type'] === 'percentage_discount' && (float)$values['reward_value'] > 100) fail(400, 'Percentage discount cannot exceed 100%.');
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $offerId = new_id();
            $prizeId = new_id();
            $typeLabel = [
                'cashback' => 'Cashback', 'percentage_discount' => 'Discount',
                'fixed_discount' => 'Discount', 'product' => 'Product reward', 'other' => 'Reward',
            ][$values['reward_type']];
            $valueText = $values['reward_type'] === 'percentage_discount'
                ? rtrim(rtrim(number_format((float)$values['reward_value'], 2, '.', ''), '0'), '.') . '%'
                : (in_array($values['reward_type'], ['cashback', 'fixed_discount'], true) ? 'INR ' . $values['reward_value'] : '');
            $description = trim($valueText . ($values['terms'] !== '' ? ($valueText !== '' ? ' · ' : '') . $values['terms'] : ''));
            $worth = in_array($values['reward_type'], ['cashback', 'fixed_discount'], true)
                ? (int)round((float)$values['reward_value'] * 100)
                : 0;
            run(
                'INSERT INTO prizes (id,title,description,prize_type,voucher_code,worth,sponsor,cycle,status,quantity,media_urls,is_active) '
                . 'VALUES (?,?,?,?,NULL,?,?,?,"open",?,"[]",1)',
                [$prizeId, $values['reward_name'], $description, in_array($values['reward_type'], ['product', 'other'], true) ? 'regular' : 'voucher', $worth, $collaborator['name'], 'Collaborator offer', $values['quantity']],
            );
            run(
                'INSERT INTO collaborator_offers (id,collaborator_id,prize_id,reward_name,reward_type,reward_value,quantity,terms) VALUES (?,?,?,?,?,?,?,?)',
                [$offerId, $collaboratorId, $prizeId, $values['reward_name'], $values['reward_type'], $values['reward_value'], $values['quantity'], $values['terms']],
            );
            $pdo->commit();
            respond(201, ['offer' => [
                'id' => $offerId, 'collaboratorId' => $collaboratorId, 'prizeId' => $prizeId,
                'rewardName' => $values['reward_name'], 'rewardType' => $values['reward_type'],
                'rewardValue' => (float)$values['reward_value'], 'quantity' => $values['quantity'],
                'terms' => $values['terms'],
            ]]);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }
    if (preg_match('#^admin/collaborator-offers/([0-9a-f-]{36})$#i', $path, $match) && $method === 'PATCH') {
        $id = $match[1];
        $offer = one('SELECT * FROM collaborator_offers WHERE id=?', [$id]);
        if (!$offer) fail(404, 'Collaborator offer not found.');
        $changes = collaborator_offer_values(body(), true);
        $next = array_merge($offer, $changes);
        if ($next['reward_type'] === 'percentage_discount' && (float)$next['reward_value'] > 100) fail(400, 'Percentage discount cannot exceed 100%.');
        $assignedCount = one('SELECT COUNT(*) AS count FROM customer_prizes WHERE prize_id=? AND released_at IS NULL', [$offer['prize_id']]);
        if ((int)($assignedCount['count'] ?? 0) > (int)$next['quantity']) fail(409, 'Quantity cannot be lower than the number of active gift cards already assigned.');
        $collaborator = one('SELECT name FROM collaborators WHERE id=?', [$offer['collaborator_id']]);
        $label = ['cashback' => 'Cashback', 'percentage_discount' => 'Discount', 'fixed_discount' => 'Discount', 'product' => 'Product reward', 'other' => 'Reward'][$next['reward_type']];
        $valueText = $next['reward_type'] === 'percentage_discount'
            ? rtrim(rtrim(number_format((float)$next['reward_value'], 2, '.', ''), '0'), '.') . '%'
            : (in_array($next['reward_type'], ['cashback', 'fixed_discount'], true) ? 'INR ' . number_format((float)$next['reward_value'], 2) : '');
        $description = trim($valueText . ($next['terms'] !== '' ? ($valueText !== '' ? ' · ' : '') . $next['terms'] : ''));
        $worth = in_array($next['reward_type'], ['cashback', 'fixed_discount'], true) ? (int)round((float)$next['reward_value'] * 100) : 0;
        $pdo = db();
        $pdo->beginTransaction();
        try {
            save_fields('collaborator_offers', 'id', $id, $changes);
            run(
                'UPDATE prizes SET title=?,description=?,prize_type=?,worth=?,sponsor=?,quantity=?,is_active=1,status=IF(?<quantity,"open","awarded") WHERE id=?',
                [$next['reward_name'], $description, in_array($next['reward_type'], ['product', 'other'], true) ? 'regular' : 'voucher', $worth, $collaborator['name'] ?? '', $next['quantity'], (int)($assignedCount['count'] ?? 0), $offer['prize_id']],
            );
            $pdo->commit();
            respond(200, ['offer' => collaborator_offer_out(array_merge($offer, $next))]);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }

    if ($path === 'admin/settings' && $method === 'GET') {
        $settings = store_settings();
        $public = settings_public($settings);
        respond(200, ['settings' => array_merge($settings, ['razorpayKeyId' => $public['razorpayKeyId']]), 'capabilities' => [
            'database' => true, 'razorpayTestMode' => $public['paymentsReady'],
            'razorpayWebhook' => !empty($config['razorpay_webhook_secret']),
            'adminAuth' => admin_auth_ready(),
            'email' => notification_capabilities()['email'],
            'webhook' => notification_capabilities()['webhook'],
        ]]);
    }
    if ($path === 'admin/settings' && $method === 'PATCH') {
        $input = body();
        $source = is_array($input['settings'] ?? null) ? $input['settings'] : $input;
        $allowed = ['storeName','supportEmail','supportPhone','city','gstin','freeShippingOver','shippingFlat'];
        $changes = [];
        foreach ($allowed as $key) if (array_key_exists($key, $source)) {
            if (in_array($key, ['freeShippingOver','shippingFlat'], true)) {
                $value = filter_var($source[$key], FILTER_VALIDATE_INT);
                if ($value === false || $value < 0 || $value > 10000000) fail(400, "$key must be a whole number in paise.");
                $changes[$key] = (string)$value;
            } else {
                $value = text_value($source[$key], 500);
                if ($key === 'supportEmail' && $value !== '' && !filter_var($value, FILTER_VALIDATE_EMAIL)) fail(400, 'Please provide a valid email address.');
                $changes[$key] = $key === 'gstin' ? strtoupper($value) : $value;
            }
        }
        if (!$changes) fail(400, 'Nothing to update.');
        foreach ($changes as $key => $value) run('INSERT INTO settings (id,setting_key,setting_value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)', [new_id(), $key, $value]);
        $settings = store_settings();
        $public = settings_public($settings);
        respond(200, ['settings' => array_merge($settings, ['razorpayKeyId' => $public['razorpayKeyId']]), 'capabilities' => [
            'database' => true, 'razorpayTestMode' => $public['paymentsReady'],
            'razorpayWebhook' => !empty($config['razorpay_webhook_secret']),
            'adminAuth' => admin_auth_ready(),
            'email' => notification_capabilities()['email'],
            'webhook' => notification_capabilities()['webhook'],
        ]]);
    }
    if ($path === 'admin/stats' && $method === 'GET') {
        $counts = one('SELECT (SELECT COUNT(*) FROM orders) order_count,(SELECT COUNT(*) FROM customers) customers,(SELECT COUNT(*) FROM products WHERE is_active=1) products,(SELECT COUNT(*) FROM orders WHERE payment_status="pending") pending_orders,(SELECT COUNT(*) FROM prizes WHERE status="open" AND is_active=1) open_prizes,(SELECT COALESCE(SUM(amount),0) FROM payments WHERE status="paid") revenue');
        $low = all('SELECT id,name,stock_quantity,category FROM products WHERE is_active=1 AND stock_quantity<=10 ORDER BY stock_quantity ASC LIMIT 5');
        $recent = all('SELECT o.*,c.full_name,c.city FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC LIMIT 8');
        respond(200, [
            'revenue' => (int)$counts['revenue'], 'orderCount' => (int)$counts['order_count'],
            'customers' => (int)$counts['customers'], 'products' => (int)$counts['products'],
            'pendingOrders' => (int)$counts['pending_orders'], 'openPrizes' => (int)$counts['open_prizes'],
            'lowStock' => array_map(static fn($p) => ['id'=>$p['id'],'name'=>$p['name'],'stock'=>(int)$p['stock_quantity'],'category'=>$p['category']], $low),
            'recent' => array_map(static fn($o) => [
                'id'=>$o['order_number'],'customerName'=>$o['full_name'],'city'=>$o['city'] ?? '',
                'total'=>(int)$o['total_amount'],'status'=>$o['order_status'],
                'paymentStatus'=>$o['payment_status'],'createdAt'=>$o['created_at'],
            ], $recent),
        ]);
    }
    if ($path === 'admin/uploads' && $method === 'POST') {
        handle_upload();
    }
    if ($path === 'admin/uploads' && $method === 'GET') {
        $bucket = text_value($_GET['bucket'] ?? 'products', 40);
        if (!in_array($bucket, ['products','product-videos','prize-media'], true)) fail(400, 'Unknown storage bucket.');
        $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
        $dir = dirname(__DIR__, 2) . '/uploads/' . $bucket;
        $files = [];
        if (is_dir($dir)) {
            $names = array_diff(scandir($dir) ?: [], ['.','..']);
            usort($names, static fn($a,$b) => filemtime($dir.'/'.$b) <=> filemtime($dir.'/'.$a));
            foreach (array_slice($names, 0, $limit) as $name) {
                if (!is_file($dir . '/' . $name) || str_starts_with($name, '.')) continue;
                $files[] = [
                    'name' => $name, 'path' => $bucket . '/' . $name,
                    'size' => filesize($dir . '/' . $name),
                    'contentType' => mime_content_type($dir . '/' . $name) ?: null,
                    'createdAt' => gmdate(DATE_ATOM, filemtime($dir . '/' . $name)),
                    'publicUrl' => media_url($bucket, $name),
                ];
            }
        }
        respond(200, ['bucket' => $bucket, 'files' => $files]);
    }
    if ($path === 'admin/uploads' && $method === 'DELETE') {
        $input = body();
        $bucket = text_value($input['bucket'] ?? '', 40);
        $objectPath = text_value($input['path'] ?? '', 600);
        if (!empty($input['url'])) {
            $urlPath = (string)parse_url((string)$input['url'], PHP_URL_PATH);
            if (!preg_match('#/uploads/(products|product-videos|prize-media)/([^/]+)$#', $urlPath, $m)) fail(400, 'That URL does not point at a managed bucket.');
            $bucket = $m[1]; $objectPath = $bucket . '/' . rawurldecode($m[2]);
        }
        $partsPath = explode('/', str_replace('\\', '/', $objectPath));
        if (!in_array($bucket, ['products','product-videos','prize-media'], true) || count($partsPath) !== 2 || $partsPath[0] !== $bucket || $partsPath[1] === '' || str_contains($partsPath[1], '..')) fail(400, 'bucket and path (or URL) are required.');
        $target = dirname(__DIR__, 2) . '/uploads/' . $bucket . '/' . basename($partsPath[1]);
        if (is_file($target) && !unlink($target)) fail(500, 'Could not delete the media file.');
        respond(200, ['ok' => true]);
    }
    return false;
}

function media_url(string $bucket, string $name): string
{
    global $config;
    $siteUrl = rtrim((string)($config['site_url'] ?? ''), '/');
    if (!short_url($siteUrl)) throw new RuntimeException('Set a valid https site_url in api/config.php.');
    if (strtolower((string)parse_url($siteUrl, PHP_URL_SCHEME)) !== 'https') {
        throw new RuntimeException('site_url must use HTTPS for public media URLs.');
    }
    return $siteUrl . '/uploads/' . rawurlencode($bucket) . '/' . rawurlencode($name);
}

function handle_upload(): never
{
    $bucket = text_value($_POST['bucket'] ?? '', 40);
    if (!in_array($bucket, ['products','product-videos','prize-media'], true)) fail(400, 'Unknown storage bucket.');
    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) fail(400, 'A file is required.');
    $file = $_FILES['file'];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) fail(400, 'The upload did not complete successfully.');
    $max = $bucket === 'products' ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
    if ((int)$file['size'] < 1 || (int)$file['size'] > $max) fail(413, 'File exceeds the upload limit for this media type.');
    $name = basename((string)$file['name']);
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: 'application/octet-stream';
    $allowed = match ($bucket) {
        'products' => ['png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp','avif'=>'image/avif','glb'=>'model/gltf-binary','gltf'=>'model/gltf+json'],
        'product-videos' => ['mp4'=>'video/mp4','webm'=>'video/webm','mov'=>'video/quicktime'],
        default => ['png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp','avif'=>'image/avif','mp4'=>'video/mp4','webm'=>'video/webm','mov'=>'video/quicktime'],
    };
    if (!isset($allowed[$ext])) fail(415, 'That file type is not allowed in this bucket.');
    $acceptedMime = $allowed[$ext];
    if ($mime !== $acceptedMime && !($bucket === 'products' && in_array($ext, ['glb','gltf'], true) && in_array($mime, ['application/octet-stream','application/json','text/plain'], true))) fail(415, 'The file content does not match its extension.');
    $safeBase = strtolower((string)preg_replace('/[^a-z0-9]+/i', '-', pathinfo($name, PATHINFO_FILENAME)));
    $safeBase = trim(substr($safeBase, 0, 60), '-') ?: 'file';
    $stored = time() . '-' . bin2hex(random_bytes(5)) . '-' . $safeBase . '.' . $ext;
    $dir = dirname(__DIR__, 2) . '/uploads/' . $bucket;
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) fail(500, 'Could not prepare media storage.');
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $stored)) fail(500, 'Could not save uploaded media.');
    respond(201, ['bucket' => $bucket, 'path' => $bucket . '/' . $stored, 'url' => media_url($bucket, $stored)]);
}
