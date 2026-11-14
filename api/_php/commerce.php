<?php
declare(strict_types=1);

function razorpay_request(string $method, string $resource, ?array $payload = null): array
{
    global $config;
    $key = (string)($config['razorpay_key_id'] ?? '');
    $secret = (string)($config['razorpay_key_secret'] ?? '');
    if (!str_starts_with($key, 'rzp_test_') || $secret === '') fail(503, 'Razorpay TEST mode is not configured.');
    $headers = "Authorization: Basic " . base64_encode($key . ':' . $secret) . "\r\n";
    if ($payload !== null) $headers .= "Content-Type: application/json\r\n";
    $context = stream_context_create(['http' => [
        'method' => $method, 'header' => $headers,
        'content' => $payload === null ? '' : json_encode($payload),
        'timeout' => 20, 'ignore_errors' => true,
    ]]);
    $response = @file_get_contents('https://api.razorpay.com/v1/' . ltrim($resource, '/'), false, $context);
    $status = 0;
    foreach (($http_response_header ?? []) as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) $status = (int)$match[1];
    }
    $decoded = is_string($response) ? json_decode($response, true) : null;
    if ($status < 200 || $status >= 300 || !is_array($decoded)) {
        error_log('[interserver-api] Razorpay request failed with status ' . $status);
        fail(502, 'Razorpay request failed. Check payment configuration and try again.');
    }
    return $decoded;
}

function make_session(array $order, ?string $expectedCode = null): array
{
    global $config;
    $customer = one('SELECT * FROM customers WHERE id = ?', [$order['customer_id']]);
    if (!$customer) fail(409, 'Customer record is missing.');
    if ($expectedCode !== null && strtoupper($customer['customer_code']) !== strtoupper($expectedCode)) fail(404, 'Order not found.');
    if ($order['payment_status'] === 'paid') fail(409, 'This order has already been paid.');
    if ($order['order_status'] === 'cancelled') fail(409, 'This order was cancelled.');
    $razorOrderId = $order['razorpay_order_id'];
    if (!$razorOrderId) {
        $settings = store_settings();
        $created = razorpay_request('POST', 'orders', [
            'amount' => (int)$order['total_amount'], 'currency' => 'INR',
            'receipt' => $order['order_number'],
            'notes' => [
                'order_number' => $order['order_number'],
                'customer_code' => $customer['customer_code'],
                'store' => substr($settings['storeName'], 0, 80),
            ],
            'payment_capture' => 1,
        ]);
        $razorOrderId = (string)$created['id'];
        run('UPDATE orders SET razorpay_order_id = ? WHERE id = ? AND razorpay_order_id IS NULL', [$razorOrderId, $order['id']]);
        $order = one('SELECT * FROM orders WHERE id = ?', [$order['id']]) ?? $order;
        $razorOrderId = (string)$order['razorpay_order_id'];
    }
    run(
        'INSERT INTO payments (id,order_id,gateway,gateway_order_id,amount,currency,status) VALUES (?,?,?,?,?,?,?) '
        . 'ON DUPLICATE KEY UPDATE gateway_order_id=VALUES(gateway_order_id),amount=VALUES(amount),currency=VALUES(currency),status=IF(status="paid",status,"created")',
        [new_id(), $order['id'], 'razorpay', $razorOrderId, $order['total_amount'], 'INR', 'created']
    );
    return [
        'orderNumber' => $order['order_number'], 'customerCode' => $customer['customer_code'],
        'razorpayOrderId' => $razorOrderId, 'keyId' => (string)$config['razorpay_key_id'],
        'amount' => (int)$order['total_amount'], 'currency' => 'INR',
        'customerName' => $customer['full_name'], 'customerEmail' => $customer['email'] ?? '',
        'customerPhone' => $customer['phone'],
    ];
}

function order_details(string $orderNumber): ?array
{
    $order = one('SELECT * FROM orders WHERE order_number = ?', [$orderNumber]);
    if (!$order) return null;
    $customer = one('SELECT * FROM customers WHERE id = ?', [$order['customer_id']]);
    $items = all('SELECT * FROM order_items WHERE order_id = ?', [$order['id']]);
    return ['order' => $order, 'customer' => $customer ?? [], 'items' => $items];
}

function mark_paid(string $razorOrderId, string $paymentId): ?array
{
    $pdo = db();
    $pdo->beginTransaction();
    $newlyPaid = false;
    try {
        $order = one('SELECT * FROM orders WHERE razorpay_order_id = ? FOR UPDATE', [$razorOrderId]);
        if (!$order) {
            $pdo->rollBack();
            return null;
        }
        if ($order['payment_status'] !== 'paid') {
            $newlyPaid = true;
            run('UPDATE payments SET status="paid",gateway_payment_id=?,payment_signature_verified=1 WHERE order_id=?', [$paymentId, $order['id']]);
            $items = all('SELECT product_id,quantity FROM order_items WHERE order_id=? AND product_id IS NOT NULL', [$order['id']]);
            foreach ($items as $item) {
                run('UPDATE products SET stock_quantity=GREATEST(0,stock_quantity-?) WHERE id=?', [$item['quantity'], $item['product_id']]);
            }
            run(
                'UPDATE orders SET payment_status="paid",razorpay_payment_id=?,order_status=IF(order_status="pending","confirmed",order_status) WHERE id=?',
                [$paymentId, $order['id']]
            );
            $customer = one('SELECT id, phone, full_name FROM customers WHERE id=?', [$order['customer_id']]);
            if ($customer) add_customer_notification(
                (string)$customer['id'],
                'payment',
                'Payment confirmed',
                'We received ₹' . number_format((int)$order['total_amount'] / 100, 2) . ' for order ' . $order['order_number'] . '. Your order is now confirmed.',
                '/account?tab=orders',
            );
            if ($customer) link_whatsapp_leads_to_customer(
                (string)$customer['id'],
                (string)$customer['phone'],
                (string)$customer['full_name'],
                (string)$order['id'],
            );
        }
        $pdo->commit();
        $updated = one('SELECT * FROM orders WHERE id=?', [$order['id']]);
        if ($updated) $updated['_newly_paid'] = $newlyPaid;
        return $updated;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function mark_failed(string $razorOrderId, ?string $paymentId): void
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $order = one('SELECT * FROM orders WHERE razorpay_order_id=? FOR UPDATE', [$razorOrderId]);
        if ($order && $order['payment_status'] !== 'paid') {
            run('UPDATE payments SET status="failed",gateway_payment_id=COALESCE(?,gateway_payment_id) WHERE order_id=?', [$paymentId, $order['id']]);
            run('UPDATE orders SET payment_status="failed" WHERE id=?', [$order['id']]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function mapped_details(array $details): array
{
    return order_out($details['order'], $details['customer'], $details['items']);
}

function paid_order_whatsapp_text(array $details, string $paymentId): string
{
    $order = $details['order'];
    $customer = $details['customer'];
    $itemLines = [];
    foreach (array_slice($details['items'], 0, 4) as $item) {
        $itemLines[] = '- ' . (int)$item['quantity'] . ' x ' . text_value($item['product_name'], 70);
    }
    if (count($details['items']) > 4) $itemLines[] = '- More items in your order';
    return 'Hi ' . text_value($customer['full_name'] ?? 'there', 100) . ",\n\n"
        . "PAYMENT CONFIRMED\n"
        . "Order: {$order['order_number']}\n"
        . "Items:\n" . implode("\n", $itemLines) . "\n\n"
        . "Total: INR " . number_format((int)$order['total_amount'] / 100, 2) . "\n"
        . "Payment method: Razorpay\n"
        . "Transaction ID: {$paymentId}\n\n"
        . "Your order is confirmed and being prepared.\n\n"
        . '— 3D Print Co.';
}

function send_paid_order_whatsapp(array $details, string $paymentId): void
{
    if (empty($details['customer']['phone'])) return;
    $customer = $details['customer'];
    $message = paid_order_whatsapp_text($details, $paymentId);
    $chatId = whatsapp_chat_id_from_phone((string)$customer['phone']);
    $firstImage = $details['items'][0]['image_url'] ?? null;
    if (is_string($firstImage) && str_starts_with(strtolower($firstImage), 'https://')) {
        if (send_whatsapp_media_url($chatId, $firstImage, $message)) return;
        error_log('[interserver-api] WhatsApp order image could not be sent; using the text confirmation.');
    }
    send_whatsapp_notification((string)$customer['phone'], (string)($customer['full_name'] ?? ''), $message);
}

function reveal_reward(string $token, bool $reveal): array
{
    if (!preg_match('/^[a-f0-9]{64}$/i', $token)) fail(404, 'Reward not found.');
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $assignment = one(
            'SELECT cp.id,cp.revealed_at,p.title,p.description,p.worth,p.prize_type,p.sponsor,p.voucher_code '
            . 'FROM customer_prizes cp JOIN prizes p ON p.id=cp.prize_id '
            . 'WHERE cp.reveal_token=? AND cp.released_at IS NULL LIMIT 1 FOR UPDATE',
            [strtolower($token)],
        );
        if (!$assignment) {
            $pdo->rollBack();
            fail(404, 'Reward not found or no longer active.');
        }
        if ($reveal && $assignment['revealed_at'] === null) {
            run('UPDATE customer_prizes SET revealed_at=UTC_TIMESTAMP() WHERE id=? AND revealed_at IS NULL', [$assignment['id']]);
            $assignment['revealed_at'] = gmdate('Y-m-d H:i:s');
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    if ($assignment['revealed_at'] === null) return ['revealed' => false];
    return [
        'revealed' => true, 'title' => $assignment['title'],
        'description' => $assignment['description'], 'worth' => (int)$assignment['worth'],
        'prizeType' => $assignment['prize_type'], 'sponsor' => $assignment['sponsor'],
        'voucherCode' => $assignment['voucher_code'] ?? null,
        'revealedAt' => $assignment['revealed_at'],
    ];
}

function customer_session_required(): array
{
    $customerId = (string)($_SESSION['customer_id'] ?? '');
    $expiresAt = (int)($_SESSION['customer_expires_at'] ?? 0);
    if ($customerId === '' || $expiresAt < time()) {
        unset($_SESSION['customer_id'], $_SESSION['customer_expires_at']);
        fail(401, 'Sign in with your WhatsApp number to view your profile.');
    }
    $customer = one('SELECT * FROM customers WHERE id=?', [$customerId]);
    if (!$customer) {
        unset($_SESSION['customer_id'], $_SESSION['customer_expires_at']);
        fail(401, 'Sign in with your WhatsApp number to view your profile.');
    }
    return $customer;
}

function find_customer_for_login(string $phone): ?array
{
    $match = find_customer_by_phone($phone);
    return $match ? one('SELECT * FROM customers WHERE id=?', [$match['id']]) : null;
}

/**
 * Signing key for one-time customer codes. `customer_otp_secret` is preferred, but
 * config files written before it existed must keep working: fall back to a stable
 * key derived from the admin secret so sign-in never fails closed for that reason.
 */
function customer_otp_secret(): string
{
    global $config;
    $secret = trim((string)($config['customer_otp_secret'] ?? ''));
    if (strlen($secret) >= 32) return $secret;
    $seed = trim((string)($config['admin_secret'] ?? '')) . '|' . trim((string)($config['site_url'] ?? ''));
    if (strlen($seed) < 24) return '';
    return hash_hmac('sha256', '3dprintco-customer-otp-v1', $seed);
}

function customer_profile_out(array $customer): array
{
    return [
        'code' => $customer['customer_code'],
        'name' => $customer['full_name'],
        'email' => $customer['email'],
        'phone' => $customer['phone'],
        'address' => $customer['delivery_address'],
        'city' => $customer['city'],
        'state' => $customer['state'],
        'postalCode' => $customer['postal_code'],
        'marketingOptIn' => (bool)($customer['marketing_opt_in'] ?? false),
        'joinedAt' => utc_iso($customer['created_at'] ?? null),
    ];
}

function customer_orders_response(array $customer): array
{
    $orders = all('SELECT * FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 100', [$customer['id']]);
    return [
        'customer' => customer_profile_out($customer),
        'orders' => array_map(
            static fn(array $order): array => mapped_details(order_details($order['order_number'])),
            $orders,
        ),
    ];
}

function handle_commerce(string $path, array $parts): bool
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    global $config;
    if ($path === 'customer/register' && $method === 'POST') {
        rate_limit('customer-register', 5, 3600);
        $input = body();
        $name = text_value($input['name'] ?? '', 120);
        $email = strtolower(text_value($input['email'] ?? '', 254));
        $phone = normalize_indian_mobile(text_value($input['phone'] ?? '', 24));
        if (mb_strlen($name) < 2) fail(400, 'Please enter your full name.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Please enter a valid email address.');
        if ($phone === null) fail(400, 'Please enter a valid Indian mobile number.');
        if (find_customer_for_login($phone)) fail(409, 'This number already has an account. Sign in with a WhatsApp code instead.');
        if (one('SELECT id FROM customers WHERE email=?', [$email])) fail(409, 'That email address is already linked to an account. Sign in instead.');
        $address = text_value($input['address'] ?? '', 500);
        $city = text_value($input['city'] ?? '', 100);
        $city = in_array($city, tamil_nadu_districts(), true) ? $city : '';
        $pin = text_value($input['postalCode'] ?? $input['pin'] ?? '', 10);
        if (!preg_match('/^6\d{5}$/', $pin)) $pin = '';
        $customerId = new_id();
        do {
            $customerCode = customer_code();
        } while (one('SELECT id FROM customers WHERE customer_code=?', [$customerCode]));
        run(
            'INSERT INTO customers (id,customer_code,full_name,email,phone,delivery_address,city,state,postal_code,marketing_opt_in) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$customerId, $customerCode, $name, $email, $phone, $address ?: null, $city ?: null, $city !== '' ? 'Tamil Nadu' : null, $pin ?: null, !empty($input['marketingOptIn']) ? 1 : 0],
        );
        $customer = one('SELECT * FROM customers WHERE id=?', [$customerId]);
        if (!$customer) fail(500, 'The account could not be created. Please try again.');
        add_customer_notification(
            $customerId,
            'account',
            'Welcome to the store',
            'Your customer account is ready. Complete your address in the profile tab before checking out.',
            '/account?tab=profile',
        );
        respond(201, [
            'customer' => customer_profile_out($customer),
            'message' => 'Account created. Request a WhatsApp code to sign in.',
        ]);
    }
    if ($path === 'customer/auth/request' && $method === 'POST') {
        rate_limit('customer-otp-request', 5, 600);
        $input = body();
        $phone = normalize_indian_mobile(text_value($input['phone'] ?? '', 24));
        if ($phone === null) fail(400, 'Enter the Indian mobile number used at checkout.');
        $otpSecret = customer_otp_secret();
        $whatsappReady = !empty($config['waapi_api_token']) && !empty($config['waapi_instance_id']);
        $emailReady = notification_capabilities()['email'];
        if ($otpSecret === '' || (!$whatsappReady && !$emailReady)) {
            $missing = [];
            if ($otpSecret === '') $missing[] = 'customer_otp_secret (or admin_secret) for signing';
            if (!$whatsappReady) $missing[] = 'waapi_instance_id/waapi_api_token';
            if (!$emailReady) $missing[] = 'resend_api_key/notify_from';
            error_log('[interserver-api] Customer sign-in unavailable; api/config.php is missing: ' . implode(' + ', $missing));
            fail(503, 'Customer sign-in is not configured. Please contact the store.');
        }
        $customer = find_customer_for_login($phone);
        if (!$customer) respond(200, ['message' => 'If an account exists for this number, a sign-in code has been sent.']);

        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $otp = '';
        for ($i = 0; $i < 6; $i++) $otp .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $nowSql = $now->format('Y-m-d H:i:s');
        $expiresAt = $now->modify('+5 minutes');
        $expiresSql = $expiresAt->format('Y-m-d H:i:s');
        $hash = hash_hmac(
            'sha256',
            $otp . '|' . $customer['id'] . '|' . $expiresSql,
            $otpSecret,
        );
        $pdo = db();
        $pdo->beginTransaction();
        try {
            run(
                'INSERT IGNORE INTO customer_otp_challenges '
                    . '(customer_id, otp_hash, expires_at, attempts, request_count, window_started_at, last_sent_at) '
                    . 'VALUES (?, ?, ?, 0, 0, ?, ?)',
                [$customer['id'], hash('sha256', random_bytes(32)), '1970-01-01 00:00:00', $nowSql, '1970-01-01 00:00:00'],
            );
            $challenge = one('SELECT * FROM customer_otp_challenges WHERE customer_id=? FOR UPDATE', [$customer['id']]);
            if (!$challenge) throw new RuntimeException('Customer OTP challenge could not be initialized.');
            $windowStarted = new DateTimeImmutable((string)$challenge['window_started_at'], new DateTimeZone('UTC'));
            $windowExpired = $now->getTimestamp() - $windowStarted->getTimestamp() >= 3600;
            $recentSend = $now->getTimestamp() - (new DateTimeImmutable((string)$challenge['last_sent_at'], new DateTimeZone('UTC')))->getTimestamp() < 60;
            if ($recentSend || (!$windowExpired && (int)$challenge['request_count'] >= 5)) {
                $pdo->commit();
                respond(200, ['message' => 'If an account exists for this number, a sign-in code has been sent.']);
            }
            run(
                'UPDATE customer_otp_challenges SET otp_hash=?, expires_at=?, attempts=0, '
                    . 'request_count=?, window_started_at=?, last_sent_at=?, verified_at=NULL WHERE customer_id=?',
                [
                    $hash,
                    $expiresSql,
                    $windowExpired ? 1 : (int)$challenge['request_count'] + 1,
                    $windowExpired ? $nowSql : $challenge['window_started_at'],
                    $nowSql,
                    $customer['id'],
                ],
            );
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }

        $message = 'Your 3D Print Co. sign-in code is ' . $otp . '. It expires in 5 minutes. Never share it.';
        if ($whatsappReady) {
            $sent = send_whatsapp_text($phone . '@c.us', $message);
        } else {
            $email = trim((string)($customer['email'] ?? ''));
            $sent = $email !== '' && notify_event($email, 'customer_signin_code', 'Your 3D Print Co. sign-in code', $message) === 'sent';
        }
        if (!$sent) {
            run(
                'UPDATE customer_otp_challenges SET expires_at=UTC_TIMESTAMP(), otp_hash=? WHERE customer_id=?',
                [hash('sha256', random_bytes(32)), $customer['id']],
            );
            fail(502, 'We could not deliver your sign-in code. Please try again later.');
        }
        respond(200, ['message' => 'If an account exists for this number, a sign-in code has been sent.']);
    }
    if ($path === 'customer/auth/verify' && $method === 'POST') {
        rate_limit('customer-otp-verify', 10, 600);
        $input = body();
        $phone = normalize_indian_mobile(text_value($input['phone'] ?? '', 24));
        $otp = strtoupper(trim(text_value($input['code'] ?? '', 6)));
        if ($phone === null || !preg_match('/^[A-Z0-9]{6}$/', $otp)) fail(400, 'The code is invalid or expired.');
        $customer = find_customer_for_login($phone);
        if (!$customer) fail(400, 'The code is invalid or expired.');
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $challenge = one('SELECT * FROM customer_otp_challenges WHERE customer_id=? FOR UPDATE', [$customer['id']]);
            if (
                !$challenge
                || (int)$challenge['attempts'] >= 5
                || new DateTimeImmutable((string)$challenge['expires_at'], new DateTimeZone('UTC')) <= new DateTimeImmutable('now', new DateTimeZone('UTC'))
                || $challenge['verified_at'] !== null
            ) {
                $pdo->commit();
                fail(400, 'The code is invalid or expired.');
            }
            $expected = hash_hmac(
                'sha256',
                $otp . '|' . $customer['id'] . '|' . $challenge['expires_at'],
                customer_otp_secret(),
            );
            if (!hash_equals((string)$challenge['otp_hash'], $expected)) {
                run('UPDATE customer_otp_challenges SET attempts=attempts+1 WHERE customer_id=?', [$customer['id']]);
                $pdo->commit();
                fail(400, 'The code is invalid or expired.');
            }
            run(
                'UPDATE customer_otp_challenges SET verified_at=UTC_TIMESTAMP(), otp_hash=? WHERE customer_id=?',
                [hash('sha256', random_bytes(32)), $customer['id']],
            );
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        session_regenerate_id(true);
        $_SESSION['customer_id'] = $customer['id'];
        $_SESSION['customer_expires_at'] = time() + 28800;
        respond(200, customer_orders_response($customer));
    }
    if ($path === 'customer/session' && $method === 'GET') {
        respond(200, customer_orders_response(customer_session_required()));
    }
    if ($path === 'customer/me' && $method === 'GET') {
        respond(200, ['customer' => customer_profile_out(customer_session_required())]);
    }
    if ($path === 'customer/profile' && $method === 'PATCH') {
        rate_limit('customer-profile', 20, 600);
        $customer = customer_session_required();
        $input = body();
        $name = text_value($input['name'] ?? $customer['full_name'], 120);
        $email = strtolower(text_value($input['email'] ?? ($customer['email'] ?? ''), 254));
        $phone = normalize_indian_mobile(text_value($input['phone'] ?? $customer['phone'], 24));
        $address = text_value($input['address'] ?? ($customer['delivery_address'] ?? ''), 500);
        $city = text_value($input['city'] ?? ($customer['city'] ?? ''), 100);
        $pin = text_value($input['postalCode'] ?? $input['pin'] ?? ($customer['postal_code'] ?? ''), 10);
        if (mb_strlen($name) < 2) fail(400, 'Please enter your full name.');
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Please enter a valid email address.');
        if ($phone === null) fail(400, 'Please enter a valid Indian mobile number.');
        if (mb_strlen($address) < 5) fail(400, 'Please enter the street address your parcels are delivered to.');
        if (!in_array($city, tamil_nadu_districts(), true)) fail(400, 'Choose a Tamil Nadu district for delivery.');
        if (!preg_match('/^6\d{5}$/', $pin)) fail(400, 'Please enter a valid 6-digit Tamil Nadu PIN code.');
        if (one('SELECT id FROM customers WHERE phone=? AND id<>?', [$phone, $customer['id']])) {
            fail(409, 'That mobile number already belongs to another account. Contact the store if it is yours.');
        }
        if ($email !== '' && one('SELECT id FROM customers WHERE email=? AND id<>?', [$email, $customer['id']])) {
            fail(409, 'That email address already belongs to another account.');
        }
        $marketingOptIn = array_key_exists('marketingOptIn', $input)
            ? (!empty($input['marketingOptIn']) ? 1 : 0)
            : (int)($customer['marketing_opt_in'] ?? 0);
        try {
            run(
                'UPDATE customers SET full_name=?,email=?,phone=?,delivery_address=?,city=?,state=?,postal_code=?,marketing_opt_in=? WHERE id=?',
                [$name, $email === '' ? null : $email, $phone, $address, $city, 'Tamil Nadu', $pin, $marketingOptIn, $customer['id']],
            );
        } catch (Throwable $error) {
            if ($error instanceof PDOException && (string)$error->getCode() === '23000') {
                fail(409, 'That mobile number or email address is already in use by another account.');
            }
            throw $error;
        }
        $updated = one('SELECT * FROM customers WHERE id=?', [$customer['id']]);
        if (!$updated) fail(404, 'Customer not found.');
        respond(200, customer_orders_response($updated));
    }
    if (($parts[0] ?? '') === 'customer' && ($parts[1] ?? '') === 'orders' && count($parts) === 4
        && $parts[3] === 'tracking' && $method === 'GET') {
        rate_limit('customer-tracking', 30, 60);
        $customer = customer_session_required();
        $number = strtoupper(rawurldecode($parts[2]));
        if (!valid_order_number($number)) fail(404, 'Order not found.');
        $order = one('SELECT * FROM orders WHERE order_number=? AND customer_id=?', [$number, $customer['id']]);
        if (!$order) fail(404, 'Order not found.');
        $force = ($_GET['refresh'] ?? '') === '1';
        respond(200, ['tracking' => tracking_snapshot($order, $force)]);
    }
    if ($path === 'customer/logout' && $method === 'POST') {
        unset($_SESSION['customer_id'], $_SESSION['customer_expires_at']);
        respond(200, ['ok' => true]);
    }
    if ($path === 'products' && $method === 'GET') {
        $sql = 'SELECT p.*, '
            . '(SELECT COALESCE(SUM(i.quantity),0) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=p.id AND o.payment_status="paid") AS sold_count, '
            . '(SELECT COALESCE(SUM(i.quantity),0) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=p.id AND o.payment_status="paid" AND o.created_at>=UTC_TIMESTAMP()-INTERVAL 30 DAY) AS recent_sold_count '
            . 'FROM products p WHERE p.is_active=1';
        $values = [];
        $category = text_value($_GET['category'] ?? '', 80);
        if ($category !== '' && $category !== 'All') { $sql .= ' AND category=?'; $values[] = $category; }
        $search = text_value($_GET['q'] ?? '', 80);
        if ($search !== '') {
            $sql .= ' AND (name LIKE ? OR category LIKE ? OR description LIKE ?)';
            $needle = '%' . $search . '%';
            array_push($values, $needle, $needle, $needle);
        }
        $rows = all($sql . ' ORDER BY created_at DESC', $values);
        header('Cache-Control: public, max-age=30, stale-while-revalidate=120');
        respond(200, ['products' => array_map('product_out', $rows)]);
    }
    if (($parts[0] ?? '') === 'products' && count($parts) === 2 && $method === 'GET') {
        $id = $parts[1];
        $column = preg_match('/^[0-9a-f-]{36}$/i', $id) ? 'id' : 'slug';
        $row = one(
            "SELECT p.*, "
            . "(SELECT COALESCE(SUM(i.quantity),0) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=p.id AND o.payment_status=\"paid\") AS sold_count, "
            . "(SELECT COALESCE(SUM(i.quantity),0) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=p.id AND o.payment_status=\"paid\" AND o.created_at>=UTC_TIMESTAMP()-INTERVAL 30 DAY) AS recent_sold_count "
            . "FROM products p WHERE p.is_active=1 AND p.$column=?",
            [$id],
        );
        if (!$row) fail(404, 'Product not found.');
        header('Cache-Control: public, max-age=30, stale-while-revalidate=120');
        respond(200, ['product' => product_out($row)]);
    }
    if ($path === 'prizes' && $method === 'GET') {
        $rows = all(
            'SELECT p.*, GREATEST(p.quantity-(SELECT COUNT(*) FROM customer_prizes cp WHERE cp.prize_id=p.id AND cp.released_at IS NULL),0) AS available_quantity '
            . 'FROM prizes p WHERE p.is_active=1 AND p.status="open" '
            . 'AND (SELECT COUNT(*) FROM customer_prizes cp WHERE cp.prize_id=p.id AND cp.released_at IS NULL)<p.quantity '
            . 'AND NOT EXISTS (SELECT 1 FROM collaborator_offers co WHERE co.prize_id=p.id) ORDER BY p.worth DESC'
        );
        respond(200, ['prizes' => array_map(static fn(array $r): array => prize_out($r, true), $rows)]);
    }

    if ($path === 'rewards/reveal' && $method === 'GET') {
        rate_limit('reward-reveal-read', 30, 60);
        $token = text_value($_GET['token'] ?? '', 64);
        respond(200, reveal_reward($token, false));
    }
    if ($path === 'rewards/reveal' && $method === 'POST') {
        rate_limit('reward-reveal', 20, 60);
        $input = body();
        $token = text_value($input['token'] ?? '', 64);
        respond(200, reveal_reward($token, true));
    }
    if ($path === 'settings' && $method === 'GET') respond(200, ['settings' => settings_public(store_settings())]);

    if ($path === 'orders' && $method === 'POST') {
        rate_limit('order-create', 20, 60);
        // Purchases require a signed-in customer so order history, favourites,
        // invoices and status notifications always belong to one account.
        $account = customer_session_required();
        $body = body();
        $contact = $body['contact'] ?? $body;
        if (!is_array($contact)) fail(400, 'Delivery details are missing.');
        $name = text_value($contact['name'] ?? '', 120);
        $email = strtolower(text_value($contact['email'] ?? '', 254));
        $phone = normalize_indian_mobile(text_value($contact['phone'] ?? '', 24));
        $address = text_value($contact['address'] ?? '', 500);
        $city = text_value($contact['city'] ?? '', 100);
        $state = text_value($contact['state'] ?? '', 100);
        $pin = text_value($contact['postalCode'] ?? $contact['pin'] ?? '', 10);
        if (mb_strlen($name) < 2) fail(400, 'Please enter your full name.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Please enter a valid email address.');
        if ($phone === null) fail(400, 'Please enter a valid Indian mobile number.');
        if (mb_strlen($address) < 5 || !in_array($city, tamil_nadu_districts(), true) || $state !== 'Tamil Nadu') {
            fail(400, 'Delivery is currently available only to Tamil Nadu districts.');
        }
        if (!preg_match('/^6\d{5}$/', $pin)) fail(400, 'Please enter a valid 6-digit Tamil Nadu PIN code.');
        $rawItems = $body['items'] ?? null;
        if (!is_array($rawItems) || count($rawItems) === 0 || count($rawItems) > 50) fail(400, 'Your cart is empty or contains too many products.');
        $merged = [];
        foreach ($rawItems as $item) {
            if (!is_array($item)) fail(400, 'Invalid cart item.');
            $productId = text_value($item['productId'] ?? $item['product_id'] ?? '', 64);
            $qty = filter_var($item['quantity'] ?? $item['qty'] ?? null, FILTER_VALIDATE_INT);
            if (!preg_match('/^[0-9a-f-]{36}$/i', $productId) || $qty === false || $qty < 1 || $qty > 50) fail(400, 'Invalid product or quantity in cart.');
            $merged[$productId] = ($merged[$productId] ?? 0) + $qty;
        }
        if (array_sum($merged) > 1000) fail(400, 'Too many items in this order.');
        $products = [];
        $subtotal = 0;
        foreach ($merged as $id => $qty) {
            $product = one('SELECT * FROM products WHERE id=? AND is_active=1', [$id]);
            if (!$product) fail(409, 'One of the products is no longer available.');
            if ((int)$product['stock_quantity'] < $qty) fail(409, 'Only ' . (int)$product['stock_quantity'] . ' of ' . $product['name'] . ' left in stock.');
            $products[] = [$product, $qty];
            $subtotal += active_product_price($product) * $qty;
        }
        $settings = store_settings();
        $shipping = $subtotal >= $settings['freeShippingOver'] ? 0 : max(0, $settings['shippingFlat']);
        $total = $subtotal + $shipping;
        if ($total <= 0) fail(400, 'Order total is invalid.');
        if (array_key_exists('expectedTotal', $body) && $body['expectedTotal'] !== null) {
            $expectedTotal = filter_var($body['expectedTotal'], FILTER_VALIDATE_INT);
            if ($expectedTotal === false || $expectedTotal !== $total) {
                fail(409, 'Prices or shipping changed while you were checking out. Review your cart and try again. Nothing was charged.');
            }
        }

        // The signed-in account owns the order. Contact fields confirm/refresh
        // the profile instead of creating a second customer record.
        $customerId = (string)$account['id'];
        $customerCode = (string)$account['customer_code'];
        if ($phone !== (string)$account['phone'] && one('SELECT id FROM customers WHERE phone=? AND id<>?', [$phone, $customerId])) {
            fail(409, 'That mobile number belongs to another account. Change it in your profile first.');
        }
        run('UPDATE customers SET full_name=?,email=?,phone=?,delivery_address=?,city=?,state=?,postal_code=?,marketing_opt_in=? WHERE id=?', [
            $name, $email, $phone, $address, $city, $state, $pin,
            !empty($contact['marketingOptIn']) ? 1 : 0, $customerId,
        ]);
        $customer = one('SELECT * FROM customers WHERE id=?', [$customerId]);
        if ($customer) link_whatsapp_leads_to_customer(
            (string)$customer['id'],
            (string)$customer['phone'],
            (string)$customer['full_name'],
        );
        $orderId = new_id();
        do {
            $orderNumber = order_number();
        } while (one('SELECT id FROM orders WHERE order_number=?', [$orderNumber]));
        db()->beginTransaction();
        try {
            run('INSERT INTO orders (id,order_number,customer_id,subtotal,shipping_charge,total_amount) VALUES (?,?,?,?,?,?)', [
                $orderId, $orderNumber, $customerId, $subtotal, $shipping, $total,
            ]);
            foreach ($products as [$product, $qty]) {
                $images = json_array($product['images']);
                $unitPrice = active_product_price($product);
                run('INSERT INTO order_items (id,order_id,product_id,product_name,quantity,unit_price,total_price,image_url,model_url) VALUES (?,?,?,?,?,?,?,?,?)', [
                    new_id(), $orderId, $product['id'], $product['name'], $qty, $unitPrice,
                    $unitPrice * $qty, $images[0] ?? null, $product['model_url'],
                ]);
            }
            db()->commit();
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
        $details = order_details($orderNumber);
        add_customer_notification(
            $customerId,
            'order',
            'Order ' . $orderNumber . ' received',
            'We saved your order for ₹' . number_format($total / 100, 2) . '. ' . ($total > 0 ? 'Complete payment to confirm it.' : ''),
            '/account?tab=orders',
        );
        notify_event(
            $email,
            'order.created',
            'Order ' . $orderNumber . ' received',
            "Thanks for your order.\n\nOrder: $orderNumber\nCustomer ID: {$customer['customer_code']}\nTotal: ₹" . number_format($total / 100, 2) . "\n\nWe will email you again as soon as Razorpay confirms the payment.\n— 3D Print Co.",
            ['orderNumber' => $orderNumber]
        );
        // The order is saved before any payment gateway call. The browser opens
        // Razorpay separately through payments/create-order, so a gateway hiccup
        // never leaves a paid-for order without a confirmation page.
        respond(201, ['order' => mapped_details($details)]);
    }

    if (($parts[0] ?? '') === 'orders' && count($parts) === 2 && $method === 'GET') {
        rate_limit('order-read', 60, 60);
        $code = strtoupper(text_value($_GET['code'] ?? '', 32));
        if ($code === '') fail(403, 'A customer code is required to view this order.');
        $details = order_details($parts[1]);
        if (!$details || strtoupper($details['customer']['customer_code'] ?? '') !== $code) fail(404, 'Order not found.');
        respond(200, ['order' => mapped_details($details)]);
    }

    if ($path === 'invoices/send' && $method === 'POST') {
        rate_limit('invoice-email', 6, 300);
        $input = body();
        $number = text_value($input['orderNumber'] ?? '', 32);
        $code = strtoupper(text_value($input['customerCode'] ?? '', 32));
        $pdf = base64_decode((string)($input['pdfBase64'] ?? ''), true);
        if (!valid_order_number($number) || !valid_customer_code($code)) {
            fail(400, 'A valid order number and customer code are required.');
        }
        if (!is_string($pdf) || strlen($pdf) > 2 * 1024 * 1024 || !str_starts_with($pdf, '%PDF-')) {
            fail(400, 'A valid invoice PDF under 2 MB is required.');
        }
        $details = order_details($number);
        if (!$details || strtoupper((string)($details['customer']['customer_code'] ?? '')) !== $code) fail(404, 'Order not found.');
        if ($details['order']['payment_status'] !== 'paid') fail(409, 'An invoice is available only after payment is verified.');
        if (!empty($details['order']['invoice_sent_at'])) respond(200, ['sent' => true, 'alreadySent' => true]);
        if (empty($details['customer']['email'])) fail(409, 'This order does not have a customer email address.');
        if (empty($config['resend_api_key']) || empty($config['notify_from'])) fail(503, 'Email delivery is not configured on the server.');
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Authorization: Bearer " . $config['resend_api_key'] . "\r\nContent-Type: application/json\r\n",
            'content' => json_encode([
                'from' => $config['notify_from'],
                'to' => [$details['customer']['email']],
                'subject' => 'Invoice for order ' . $number,
                'text' => "Your payment is confirmed. Your invoice is attached.\nOrder: $number\n— 3D Print Co.",
                'attachments' => [[
                    'filename' => 'invoice-' . $number . '.pdf',
                    'content' => base64_encode($pdf),
                ]],
            ]),
            'timeout' => 15, 'ignore_errors' => true,
        ]]);
        $response = @file_get_contents('https://api.resend.com/emails', false, $context);
        $status = 0;
        foreach (($http_response_header ?? []) as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) $status = (int)$match[1];
        }
        if (!is_string($response) || $status < 200 || $status >= 300) {
            error_log('[interserver-api] Invoice email provider returned status ' . $status);
            fail(502, 'The invoice could not be emailed. Download the PDF and try again later.');
        }
        run('UPDATE orders SET invoice_sent_at=UTC_TIMESTAMP() WHERE id=? AND invoice_sent_at IS NULL', [$details['order']['id']]);
        respond(200, ['sent' => true, 'alreadySent' => false]);
    }

    if ($path === 'invoices/whatsapp' && $method === 'POST') {
        rate_limit('invoice-whatsapp', 5, 300);
        $input = body();
        $number = strtoupper(text_value($input['orderNumber'] ?? '', 32));
        $code = strtoupper(text_value($input['customerCode'] ?? '', 32));
        $pdf = base64_decode((string)($input['pdfBase64'] ?? ''), true);
        if (!valid_order_number($number) || !valid_customer_code($code)) {
            fail(400, 'A valid order number and customer code are required.');
        }
        if (!is_string($pdf) || strlen($pdf) > 2 * 1024 * 1024 || !str_starts_with($pdf, '%PDF-')) {
            fail(400, 'A valid invoice PDF under 2 MB is required.');
        }
        $details = order_details($number);
        if (!$details || strtoupper((string)($details['customer']['customer_code'] ?? '')) !== $code) fail(404, 'Order not found.');
        if ($details['order']['payment_status'] !== 'paid') fail(409, 'An invoice is available only after payment is verified.');
        if (!empty($details['order']['whatsapp_invoice_sent_at'])) respond(200, ['sent' => true, 'alreadySent' => true]);
        $phone = (string)($details['customer']['phone'] ?? '');
        if ($phone === '') fail(409, 'This order does not have a WhatsApp number.');
        $caption = 'Payment confirmed for order ' . $number . ". Your invoice is attached.\n— 3D Print Co.";
        if (!send_whatsapp_media(
            whatsapp_chat_id_from_phone($phone),
            base64_encode($pdf),
            'invoice-' . $number . '.pdf',
            $caption,
        )) {
            fail(502, 'The WhatsApp invoice could not be sent. Please retry or download the PDF.');
        }
        run('UPDATE orders SET whatsapp_invoice_sent_at=UTC_TIMESTAMP() WHERE id=? AND whatsapp_invoice_sent_at IS NULL', [$details['order']['id']]);
        respond(200, ['sent' => true, 'alreadySent' => false]);
    }

    if (($parts[0] ?? '') === 'customers' && count($parts) === 3 && $parts[2] === 'orders' && $method === 'GET') {
        rate_limit('customer-orders', 30, 60);
        $customer = customer_session_required();
        if (strtoupper($customer['customer_code']) !== strtoupper($parts[1])) fail(404, 'Customer not found.');
        respond(200, customer_orders_response($customer));
    }

    if ($path === 'payments/create-order' && $method === 'POST') {
        rate_limit('payment-create-order', 20, 60);
        $payload = body();
        $number = text_value($payload['orderNumber'] ?? $payload['orderId'] ?? '', 32);
        $code = strtoupper(text_value($payload['customerCode'] ?? '', 32));
        if (!valid_order_number($number) || !valid_customer_code($code)) fail(400, 'A valid order number and customer code are required.');
        $order = one('SELECT * FROM orders WHERE order_number=?', [$number]);
        if (!$order) fail(404, 'Order not found.');
        respond(200, ['session' => make_session($order, $code)]);
    }

    if ($path === 'payments/verify' && $method === 'POST') {
        rate_limit('payment-verify', 30, 60);
        $payload = body();
        $orderId = text_value($payload['razorpay_order_id'] ?? $payload['orderId'] ?? '', 64);
        $paymentId = text_value($payload['razorpay_payment_id'] ?? $payload['paymentId'] ?? '', 64);
        $signature = text_value($payload['razorpay_signature'] ?? $payload['signature'] ?? '', 256);
        if (!$orderId || !$paymentId || !$signature) fail(400, 'Payment details are incomplete.');
        $expected = hash_hmac('sha256', $orderId . '|' . $paymentId, (string)($config['razorpay_key_secret'] ?? ''));
        if (!hash_equals($expected, $signature)) fail(400, 'Payment signature did not match. The order has not been marked paid.');
        $order = one('SELECT * FROM orders WHERE razorpay_order_id=?', [$orderId]);
        if (!$order) fail(404, 'Order not found for this payment.');
        $wasPaid = $order['payment_status'] === 'paid';
        if (!$wasPaid) {
            $payment = razorpay_request('GET', 'payments/' . rawurlencode($paymentId));
            if (($payment['order_id'] ?? '') !== $orderId) fail(400, 'Payment belongs to a different order.');
            if ((int)($payment['amount'] ?? 0) !== (int)$order['total_amount'] || ($payment['currency'] ?? '') !== 'INR') fail(400, 'Payment amount does not match the stored order total.');
            if (($payment['status'] ?? '') === 'failed') {
                mark_failed($orderId, $paymentId);
                fail(402, 'Razorpay reports this payment as failed. Nothing was marked paid.');
            }
            if (!in_array($payment['status'] ?? '', ['captured', 'authorized'], true)) fail(409, 'Payment is not complete yet.');
            $settled = mark_paid($orderId, $paymentId);
            $wasPaid = !$settled || empty($settled['_newly_paid']);
        }
        $details = order_details($order['order_number']);
        if (!$wasPaid && !empty($details['customer']['email'])) {
            notify_event(
                $details['customer']['email'], 'payment.success', 'Payment confirmed — ' . $order['order_number'],
                "Payment confirmed. Your order is now being prepared.\n\nOrder: {$order['order_number']}\nCustomer ID: {$details['customer']['customer_code']}\nPaid: ₹" . number_format((int)$order['total_amount'] / 100, 2) . "\nRazorpay payment: $paymentId\n\n— 3D Print Co.",
                ['orderNumber' => $order['order_number'], 'paymentId' => $paymentId]
            );
        }
        if (!$wasPaid) send_paid_order_whatsapp($details, $paymentId);
        respond(200, ['order' => mapped_details($details)]);
    }

    if ($path === 'payments/webhook' && $method === 'POST') {
        $secret = (string)($config['razorpay_webhook_secret'] ?? '');
        $signature = (string)($_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '');
        $raw = file_get_contents('php://input') ?: '';
        if ($secret === '') fail(503, 'Webhook secret is not configured.');
        if ($signature === '' || !hash_equals(hash_hmac('sha256', $raw, $secret), $signature)) fail(400, 'Invalid webhook signature.');
        $payload = json_decode($raw, true);
        if (!is_array($payload)) fail(400, 'Invalid JSON payload.');
        $event = $payload['event'] ?? '';
        $payment = $payload['payload']['payment']['entity'] ?? [];
        $orderEntity = $payload['payload']['order']['entity'] ?? [];
        if ($event === 'payment.failed' && !empty($payment['order_id'])) {
            mark_failed((string)$payment['order_id'], $payment['id'] ?? null);
            respond(200, ['received' => true]);
        }
        if (!in_array($event, ['payment.captured', 'order.paid'], true)) respond(200, ['received' => true, 'ignored' => true]);
        $rzOrderId = (string)($payment['order_id'] ?? $orderEntity['id'] ?? '');
        $rzPaymentId = (string)($payment['id'] ?? '');
        $order = one('SELECT * FROM orders WHERE razorpay_order_id=?', [$rzOrderId]);
        if (!$order) respond(200, ['received' => true, 'ignored' => 'unknown_order']);
        if ((int)($payment['amount'] ?? $orderEntity['amount'] ?? 0) !== (int)$order['total_amount']) respond(200, ['received' => true, 'ignored' => 'amount_mismatch']);
        if ($rzPaymentId === '') respond(200, ['received' => true, 'ignored' => 'missing_payment_id']);
        $wasPaid = $order['payment_status'] === 'paid';
        $settled = mark_paid($rzOrderId, $rzPaymentId);
        $wasPaid = !$settled || empty($settled['_newly_paid']);
        if (!$wasPaid) {
            $details = order_details($order['order_number']);
            if (!empty($details['customer']['email'])) notify_event(
                $details['customer']['email'], 'payment.success', 'Payment confirmed — ' . $order['order_number'],
                "Payment confirmed. Your order is now being prepared.\n\nOrder: {$order['order_number']}\nCustomer ID: {$details['customer']['customer_code']}\nPaid: ₹" . number_format((int)$order['total_amount'] / 100, 2) . "\nRazorpay payment: $rzPaymentId\n\n— 3D Print Co.",
                ['orderNumber' => $order['order_number'], 'paymentId' => $rzPaymentId]
            );
            send_paid_order_whatsapp($details, $rzPaymentId);
        }
        respond(200, ['received' => true]);
    }
    return false;
}
