/**
 * Server environment access. Only used by /api (never bundled into the client).
 * Missing required values fail loudly with a safe message that never includes secrets.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export type ServerEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  adminEmail: string;
  adminPassword: string;
  adminSecret: string;
  resendApiKey: string;
  notifyFrom: string;
  notifyWebhookUrl: string;
};

function read(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function supabaseEnv(): { url: string; serviceRoleKey: string } {
  const url = read("SUPABASE_URL");
  const serviceRoleKey = read("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new ConfigError(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the deployment environment.",
    );
  }
  return { url, serviceRoleKey };
}

export function razorpayEnv(): { keyId: string; keySecret: string } {
  const keyId = read("RAZORPAY_KEY_ID");
  const keySecret = read("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) {
    throw new ConfigError(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test mode keys) in the deployment environment.",
    );
  }
  if (!keyId.startsWith("rzp_test_")) {
    throw new ConfigError(
      "This deployment only accepts Razorpay TEST mode keys (rzp_test_…). Live keys are deliberately rejected.",
    );
  }
  return { keyId, keySecret };
}

export function adminEnv(): { email: string; password: string; secret: string } {
  const email = read("ADMIN_EMAIL") || "admin@3dprintco.in";
  const password = read("ADMIN_PASSWORD");
  const secret = read("ADMIN_SECRET");
  if (!password || !secret || secret.length < 24) {
    throw new ConfigError(
      "Admin access is not configured. Set ADMIN_PASSWORD and a random ADMIN_SECRET of at least 24 characters.",
    );
  }
  return { email, password, secret };
}

export function adminEmail(): string {
  return read("ADMIN_EMAIL") || "admin@3dprintco.in";
}

export function webhookSecret(): string {
  return read("RAZORPAY_WEBHOOK_SECRET");
}

export function notificationEnv(): { resendApiKey: string; from: string; webhookUrl: string } {
  return {
    resendApiKey: read("RESEND_API_KEY"),
    from: read("NOTIFY_FROM"),
    webhookUrl: read("NOTIFY_WEBHOOK_URL"),
  };
}

export function serverEnvSnapshot(): ServerEnv {
  return {
    supabaseUrl: read("SUPABASE_URL"),
    serviceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
    razorpayKeyId: read("RAZORPAY_KEY_ID"),
    razorpayKeySecret: read("RAZORPAY_KEY_SECRET"),
    razorpayWebhookSecret: read("RAZORPAY_WEBHOOK_SECRET"),
    adminEmail: adminEmail(),
    adminPassword: read("ADMIN_PASSWORD"),
    adminSecret: read("ADMIN_SECRET"),
    resendApiKey: read("RESEND_API_KEY"),
    notifyFrom: read("NOTIFY_FROM"),
    notifyWebhookUrl: read("NOTIFY_WEBHOOK_URL"),
  };
}
