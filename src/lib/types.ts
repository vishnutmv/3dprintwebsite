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
  items: OrderItem[];
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
