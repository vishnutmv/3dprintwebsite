export type ModelVariant =
  | "dragon"
  | "organiser"
  | "gear"
  | "planter"
  | "knight"
  | "spool"
  | "lattice";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number; // paise
  mrp?: number; // paise
  promotionPrice?: number | null; // paise
  promotionStartAt?: string | null;
  promotionEndAt?: string | null;
  promotionActive?: boolean;
  currentPrice?: number;
  description: string;
  material: string;
  dimensions: string;
  printTime: string;
  stock: number;
  badge?: string;
  variant: ModelVariant;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  modelUrl?: string;
  specifications?: Record<string, string>;
  accent: string;
  rating: number;
  reviews: number;
  trendTag?: string | null;
  soldCount?: number;
  recentSoldCount?: number;
};

export type CartItem = { productId: string; qty: number };

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type OrderItem = {
  productId: string;
  name: string;
  qty: number;
  price: number; // paise
  lineTotal?: number;
  imageUrl?: string;
  modelUrl?: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  postalCode?: string;
  subtotal: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  razorpayOrderId?: string;
  paymentMode?: string;
  notes?: string;
  uid?: string;
  createdAt: string;
  updatedAt?: string;
  trackingNumber?: string | null;
  courierSlug?: string | null;
  trackingSyncedAt?: string | null;
  items: OrderItem[];
};

export type ShipmentState =
  | "pending"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "unknown";

export type TrackingCheckpoint = {
  at: string;
  location: string;
  status: string;
  rawStatus?: string;
};

/** Live courier position for one order, served by /api/customer/orders/:n/tracking. */
export type OrderTracking = {
  configured: boolean;
  apiReady: boolean;
  courier: string;
  courierName: string;
  trackingNumber: string;
  state: ShipmentState;
  statusLabel: string;
  mostRecentStatus: string;
  estimatedDelivery: string | null;
  originCity: string | null;
  destinationCity: string | null;
  checkpoints: TrackingCheckpoint[];
  syncedAt: string | null;
  stale: boolean;
  message: string;
};

export type ProductReview = {
  id: string;
  productId: string;
  productName?: string;
  productSlug?: string;
  customerCode?: string | null;
  authorName: string;
  isAdmin: boolean;
  rating: number | null;
  title: string;
  body: string;
  adminReply: string | null;
  adminReplyBy?: string | null;
  adminRepliedAt: string | null;
  status?: "published" | "hidden";
  adminSeen?: boolean;
  createdAt: string;
};

export type ReviewSummary = {
  average: number;
  count: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
};

export type CustomerNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type CustomerTransaction = {
  id: string;
  orderNumber: string;
  kind: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  amount: number;
  paymentId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type CustomerTransactions = {
  summary: {
    orderCount: number;
    paidOrders: number;
    pendingOrders: number;
    refundedOrders: number;
    totalSpend: number;
    lastOrderAt: string | null;
  };
  transactions: CustomerTransaction[];
};

export type CustomerProfile = {
  code: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  marketingOptIn: boolean;
  joinedAt?: string | null;
};

export type Prize = {
  id: string;
  title: string;
  description?: string;
  prizeType?: string;
  tier?: string;
  voucherCode?: string;
  worth: number; // paise
  sponsor: string;
  cycle: string;
  status: "open" | "awarded" | "claimed";
  mediaUrls?: string[];
  awardedTo?: string;
  awardedAt?: string;
  notificationStatus?: string;
  active?: boolean;
};

export type StoreSettings = {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  city: string;
  gstin: string;
  freeShippingOver: number; // paise
  shippingFlat: number; // paise
  razorpayKeyId: string;
  paymentsReady: boolean;
  /** Server clock (UTC ISO) so storefront timers match server pricing. */
  serverTime?: string;
  notifyEmail: string;
  whatsappContactUrl?: string;
  notifications?: { email: boolean; webhook: boolean };
};

/** Kept as an alias so older imports keep working. */
export type Settings = StoreSettings;

export type CheckoutContact = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  marketingOptIn: boolean;
};

export type CheckoutSession = {
  orderNumber: string;
  customerCode: string;
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

export type RazorpayCallback = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
