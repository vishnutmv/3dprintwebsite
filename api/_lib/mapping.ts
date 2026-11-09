/**
 * Supabase row shapes and API response mappers.
 * Public product/order payloads stay compatible with the existing React app.
 */

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  mrp: number | null;
  category: string;
  stock_quantity: number;
  images: string[] | null;
  video_url: string | null;
  specifications: Record<string, string> | null;
  material: string;
  dimensions: string;
  print_time: string;
  badge: string | null;
  variant: string;
  accent: string;
  model_url: string | null;
  rating: number | string;
  reviews: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  customer_code: string;
  full_name: string;
  email: string | null;
  phone: string;
  delivery_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  marketing_opt_in?: boolean;
  created_at: string;
};

export type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  subtotal: number;
  shipping_charge: number;
  total_amount: number;
  payment_status: string;
  order_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url: string | null;
  model_url: string | null;
};

export type PrizeRow = {
  id: string;
  title: string;
  description: string;
  prize_type: string;
  voucher_code: string | null;
  worth: number;
  sponsor: string;
  cycle: string;
  status: string;
  media_urls: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerPrizeRow = {
  id: string;
  customer_id: string;
  prize_id: string;
  assigned_by: string;
  notification_status: string;
  assigned_at: string;
  released_at?: string | null;
  notes: string | null;
};

export type StoreSettings = {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  city: string;
  gstin: string;
  freeShippingOver: number;
  shippingFlat: number;
  notifyEmail: string;
};

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "3D Print Co.",
  supportEmail: "orders@3dprintco.in",
  supportPhone: "+91 98400 00000",
  city: "Chennai",
  gstin: "",
  freeShippingOver: 149900,
  shippingFlat: 4900,
  notifyEmail: "",
};

export function mapSettings(rows: { setting_key: string; setting_value: string }[]): StoreSettings {
  const map = new Map(rows.map((row) => [row.setting_key, row.setting_value]));
  const value = (key: string, fallback: string) => map.get(key) ?? fallback;
  return {
    storeName: value("storeName", DEFAULT_SETTINGS.storeName),
    supportEmail: value("supportEmail", DEFAULT_SETTINGS.supportEmail),
    supportPhone: value("supportPhone", DEFAULT_SETTINGS.supportPhone),
    city: value("city", DEFAULT_SETTINGS.city),
    gstin: value("gstin", DEFAULT_SETTINGS.gstin),
    freeShippingOver: Number(map.get("freeShippingOver") ?? DEFAULT_SETTINGS.freeShippingOver) || 0,
    shippingFlat: Number(map.get("shippingFlat") ?? DEFAULT_SETTINGS.shippingFlat) || 0,
    notifyEmail: value("notifyEmail", DEFAULT_SETTINGS.notifyEmail),
  };
}

export function publicProduct(row: ProductRow) {
  const images = row.images ?? [];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    price: row.price,
    mrp: row.mrp ?? undefined,
    description: row.description,
    material: row.material,
    dimensions: row.dimensions,
    printTime: row.print_time,
    stock: row.stock_quantity,
    badge: row.badge ?? undefined,
    variant: row.variant,
    accent: row.accent,
    imageUrl: images[0] ?? undefined,
    images,
    videoUrl: row.video_url ?? undefined,
    modelUrl: row.model_url ?? undefined,
    specifications: row.specifications ?? {},
    rating: Number(row.rating) || 0,
    reviews: row.reviews,
  };
}

export function adminProduct(row: ProductRow) {
  return {
    ...publicProduct(row),
    active: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function publicPrize(row: PrizeRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    prizeType: row.prize_type,
    worth: row.worth,
    sponsor: row.sponsor,
    cycle: row.cycle,
    status: row.status,
    mediaUrls: row.media_urls ?? [],
  };
}

export function mapPrize(row: PrizeRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    prizeType: row.prize_type,
    tier: row.prize_type,
    voucherCode: row.voucher_code ?? undefined,
    worth: row.worth,
    sponsor: row.sponsor,
    cycle: row.cycle,
    status: row.status,
    active: row.is_active,
    mediaUrls: row.media_urls ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapOrderItem(row: OrderItemRow) {
  return {
    productId: row.product_id ?? "",
    name: row.product_name,
    qty: row.quantity,
    price: row.unit_price,
    lineTotal: row.total_price,
    imageUrl: row.image_url ?? undefined,
    modelUrl: row.model_url ?? undefined,
  };
}

export function mapOrder(order: OrderRow, items: OrderItemRow[], customer: CustomerRow | null) {
  return {
    id: order.order_number,
    orderNumber: order.order_number,
    customerId: customer?.customer_code ?? "",
    customerCode: customer?.customer_code ?? "",
    customerName: customer?.full_name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? undefined,
    address: customer?.delivery_address ?? "",
    city: customer?.city ?? "",
    state: customer?.state ?? "",
    pin: customer?.postal_code ?? "",
    postalCode: customer?.postal_code ?? "",
    subtotal: order.subtotal,
    shipping: order.shipping_charge,
    total: order.total_amount,
    status: order.order_status,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    paymentId: order.razorpay_payment_id ?? undefined,
    razorpayOrderId: order.razorpay_order_id ?? undefined,
    paymentMode: "razorpay",
    notes: order.notes ?? "",
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map(mapOrderItem),
  };
}
