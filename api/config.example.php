<?php
declare(strict_types=1);

// Copy to config.php and fill in the values from DirectAdmin. Never commit
// config.php; api/.htaccess blocks direct web access to PHP files other than
// the API front controller.
return [
    'site_url' => 'https://your-domain.example',
    'allowed_origins' => [],
    'db_host' => 'localhost',
    'db_name' => 'ACCOUNT_DATABASE',
    'db_user' => 'ACCOUNT_DATABASE_USER',
    'db_password' => 'CHANGE_ME',
    'admin_email' => 'admin@example.com',
    'admin_password' => 'CHANGE_ME',
    'razorpay_key_id' => '',
    'razorpay_key_secret' => '',
    'razorpay_webhook_secret' => '',
    'resend_api_key' => '',
    'notify_from' => '',
    'notify_webhook_url' => '',
    'whatsapp_business_number' => '',
    'waapi_instance_id' => '',
    'waapi_api_token' => '',
    'waapi_webhook_secret' => '',
    'storefront_url' => '',
];
