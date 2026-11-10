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
    try {
        $order = one('SELECT * FROM orders WHERE razorpay_order_id = ? FOR UPDATE', [$razorOrderId]);
        if (!$order) {
            $pdo->rollBack();
            return null;
        }
        if ($order['payment_status'] !== 'paid') {
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
            if ($customer) link_whatsapp_leads_to_customer(
                (string)$customer['id'],
                (string)$customer['phone'],
                (string)$customer['full_name'],
                (string)$order['id'],
            );
        }
        $pdo->commit();
        return one('SELECT * FROM orders WHERE id=?', [$order['id']]);
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

function handle_commerce(string $path, array $parts): bool
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    global $config;
    if ($path === 'products' && $method === 'GET') {
        $sql = 'SELECT * FROM products WHERE is_active=1';
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
        $row = one("SELECT * FROM products WHERE is_active=1 AND $column=?", [$id]);
        if (!$row) fail(404, 'Product not found.');
        header('Cache-Control: public, max-age=30, stale-while-revalidate=120');
        respond(200, ['product' => product_out($row)]);
    }
    if ($path === 'prizes' && $method === 'GET') {
        $rows = all('SELECT * FROM prizes WHERE is_active=1 AND status="open" ORDER BY worth DESC');
        respond(200, ['prizes' => array_map(static fn(array $r): array => prize_out($r, true), $rows)]);
    }
    if ($path === 'settings' && $method === 'GET') respond(200, ['settings' => settings_public(store_settings())]);

    if ($path === 'orders' && $method === 'POST') {
        rate_limit('order-create', 20, 60);
        $body = body();
        $contact = $body['contact'] ?? $body;
        if (!is_array($contact)) fail(400, 'Delivery details are missing.');
        $name = text_value($contact['name'] ?? '', 120);
        $email = strtolower(text_value($contact['email'] ?? '', 254));
        $phone = text_value($contact['phone'] ?? '', 24);
        $digits = preg_replace('/\D/', '', $phone);
        $address = text_value($contact['address'] ?? '', 500);
        $city = text_value($contact['city'] ?? '', 100);
        $state = text_value($contact['state'] ?? '', 100);
        $pin = text_value($contact['postalCode'] ?? $contact['pin'] ?? '', 10);
        if (mb_strlen($name) < 2) fail(400, 'Please enter your full name.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Please enter a valid email address.');
        if (strlen((string)$digits) < 10 || strlen((string)$digits) > 15) fail(400, 'Please enter a valid phone number with 10–15 digits.');
        if (mb_strlen($address) < 5 || mb_strlen($city) < 2 || mb_strlen($state) < 2) fail(400, 'Please complete your delivery address.');
        if (!preg_match('/^\d{4,6}$/', $pin)) fail(400, 'Please enter a valid PIN / postal code.');
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
            $subtotal += (int)$product['price'] * $qty;
        }
        $settings = store_settings();
        $shipping = $subtotal >= $settings['freeShippingOver'] ? 0 : max(0, $settings['shippingFlat']);
        $total = $subtotal + $shipping;
        if ($total <= 0) fail(400, 'Order total is invalid.');

        $existing = one('SELECT * FROM customers WHERE email=? OR phone=? LIMIT 1', [$email, $phone]);
        if ($existing) {
            $customerId = $existing['id'];
            run('UPDATE customers SET full_name=?,email=?,phone=?,delivery_address=?,city=?,state=?,postal_code=?,marketing_opt_in=? WHERE id=?', [
                $name, $email, $phone, $address, $city, $state, $pin,
                !empty($contact['marketingOptIn']) ? 1 : 0, $customerId,
            ]);
        } else {
            $customerId = new_id();
            do {
                $customerCode = '3DP-' . strtoupper(bin2hex(random_bytes(2))) . '-' . strtoupper(bin2hex(random_bytes(2)));
            } while (one('SELECT id FROM customers WHERE customer_code=?', [$customerCode]));
            run('INSERT INTO customers (id,customer_code,full_name,email,phone,delivery_address,city,state,postal_code,marketing_opt_in) VALUES (?,?,?,?,?,?,?,?,?,?)', [
                $customerId, $customerCode, $name, $email, $phone, $address, $city, $state, $pin,
                !empty($contact['marketingOptIn']) ? 1 : 0,
            ]);
        }
        $customer = one('SELECT * FROM customers WHERE id=?', [$customerId]);
        if ($customer) link_whatsapp_leads_to_customer(
            (string)$customer['id'],
            (string)$customer['phone'],
            (string)$customer['full_name'],
        );
        $orderId = new_id();
        do {
            $orderNumber = 'ORD-' . strtoupper(bin2hex(random_bytes(4)));
        } while (one('SELECT id FROM orders WHERE order_number=?', [$orderNumber]));
        db()->beginTransaction();
        try {
            run('INSERT INTO orders (id,order_number,customer_id,subtotal,shipping_charge,total_amount) VALUES (?,?,?,?,?,?)', [
                $orderId, $orderNumber, $customerId, $subtotal, $shipping, $total,
            ]);
            foreach ($products as [$product, $qty]) {
                $images = json_array($product['images']);
                run('INSERT INTO order_items (id,order_id,product_id,product_name,quantity,unit_price,total_price,image_url,model_url) VALUES (?,?,?,?,?,?,?,?,?)', [
                    new_id(), $orderId, $product['id'], $product['name'], $qty, $product['price'],
                    (int)$product['price'] * $qty, $images[0] ?? null, $product['model_url'],
                ]);
            }
            db()->commit();
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
        $order = one('SELECT * FROM orders WHERE id=?', [$orderId]);
        $session = make_session($order);
        $details = order_details($orderNumber);
        notify_event(
            $email,
            'order.created',
            'Order ' . $orderNumber . ' received',
            "Thanks for your order.\n\nOrder: $orderNumber\nCustomer ID: {$customer['customer_code']}\nTotal: ₹" . number_format($total / 100, 2) . "\n\nWe will email you again as soon as Razorpay confirms the payment.\n— 3D Print Co.",
            ['orderNumber' => $orderNumber]
        );
        respond(201, ['order' => mapped_details($details), 'session' => $session]);
    }

    if (($parts[0] ?? '') === 'orders' && count($parts) === 2 && $method === 'GET') {
        rate_limit('order-read', 60, 60);
        $code = strtoupper(text_value($_GET['code'] ?? '', 32));
        if ($code === '') fail(403, 'A customer code is required to view this order.');
        $details = order_details($parts[1]);
        if (!$details || strtoupper($details['customer']['customer_code'] ?? '') !== $code) fail(404, 'Order not found.');
        respond(200, ['order' => mapped_details($details)]);
    }

    if (($parts[0] ?? '') === 'customers' && count($parts) === 3 && $parts[2] === 'orders' && $method === 'GET') {
        rate_limit('customer-orders', 30, 60);
        $code = strtoupper($parts[1]);
        if (!preg_match('/^3DP-[A-Z0-9]{4}-[A-Z0-9]{4}$/', $code)) fail(404, 'Customer not found.');
        $customer = one('SELECT * FROM customers WHERE customer_code=?', [$code]);
        if (!$customer) fail(404, 'Customer not found.');
        $orders = all('SELECT * FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 100', [$customer['id']]);
        $mapped = [];
        foreach ($orders as $order) $mapped[] = mapped_details(order_details($order['order_number']));
        respond(200, ['customer' => [
            'code' => $customer['customer_code'], 'name' => $customer['full_name'],
            'email' => $customer['email'], 'phone' => $customer['phone'],
        ], 'orders' => $mapped]);
    }

    if ($path === 'payments/create-order' && $method === 'POST') {
        rate_limit('payment-create-order', 20, 60);
        $payload = body();
        $number = text_value($payload['orderNumber'] ?? $payload['orderId'] ?? '', 32);
        $code = strtoupper(text_value($payload['customerCode'] ?? '', 32));
        if (!preg_match('/^ORD-[A-Z0-9]{8}$/', $number) || !preg_match('/^3DP-[A-Z0-9]{4}-[A-Z0-9]{4}$/', $code)) fail(400, 'A valid order number and customer code are required.');
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
            mark_paid($orderId, $paymentId);
        }
        $details = order_details($order['order_number']);
        if (!$wasPaid && !empty($details['customer']['email'])) {
            notify_event(
                $details['customer']['email'], 'payment.success', 'Payment confirmed — ' . $order['order_number'],
                "Payment confirmed. Your order is now being prepared.\n\nOrder: {$order['order_number']}\nCustomer ID: {$details['customer']['customer_code']}\nPaid: ₹" . number_format((int)$order['total_amount'] / 100, 2) . "\nRazorpay payment: $paymentId\n\n— 3D Print Co.",
                ['orderNumber' => $order['order_number'], 'paymentId' => $paymentId]
            );
        }
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
        mark_paid($rzOrderId, $rzPaymentId);
        if (!$wasPaid) {
            $details = order_details($order['order_number']);
            if (!empty($details['customer']['email'])) notify_event(
                $details['customer']['email'], 'payment.success', 'Payment confirmed — ' . $order['order_number'],
                "Payment confirmed. Your order is now being prepared.\n\nOrder: {$order['order_number']}\nCustomer ID: {$details['customer']['customer_code']}\nPaid: ₹" . number_format((int)$order['total_amount'] / 100, 2) . "\nRazorpay payment: $rzPaymentId\n\n— 3D Print Co.",
                ['orderNumber' => $order['order_number'], 'paymentId' => $rzPaymentId]
            );
        }
        respond(200, ['received' => true]);
    }
    return false;
}
