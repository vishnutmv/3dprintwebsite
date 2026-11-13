import type { Order, Prize, Product, StoreSettings } from "./types";
import { newCustomerId, newOrderId } from "./format";

const DEMO_DB_KEY = "3dp-client-demo-v1";
const DEMO_SESSION_KEY = "3dp-client-demo-session";
const DEMO_CUSTOMER_SESSION_KEY = "3dp-client-demo-customer";

/** The preview never sends WhatsApp messages; this fixed code stands in for OTP. */
const DEMO_OTP_CODE = "K7M2X9";

type DemoProduct = Product & { active: boolean; createdAt: string };
type DemoOrder = Order & { marketingOptIn?: boolean };
type DemoPrize = Prize & { active: boolean; createdAt: string; awardedToName?: string; quantity: number; availableQuantity?: number };
type DemoCustomer = {
  id: string;
  customerCode: string;
  name: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  postalCode: string;
  address: string;
  orders: number;
  paidOrders: number;
  spend: number;
  marketingOptIn: boolean;
  joinedAt: string;
};
type DemoAssignment = {
  id: string;
  prizeId: string;
  prizeTitle: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  assignedBy: string;
  notificationStatus: string;
  assignedAt: string;
  releasedAt?: string;
  revealUrl?: string;
  notes: string;
};
type DemoCampaign = {
  id: string;
  message: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  recipientCodes: string[];
};
type DemoRewardToken = { token: string; prizeId: string; revealed: boolean };
type DemoCollaboratorOffer = {
  id: string;
  collaboratorId: string;
  prizeId: string;
  rewardName: string;
  rewardType: "cashback" | "percentage_discount" | "fixed_discount" | "product" | "other";
  rewardValue: number;
  quantity: number;
  terms: string;
  createdAt: string;
};
type DemoCollaborator = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  createdAt: string;
  offers: DemoCollaboratorOffer[];
};
type DemoLead = {
  id: string;
  chatId: string;
  phone: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string;
  status: "new" | "active" | "closed";
  createdAt: string;
  updatedAt: string;
  chatUrl: string;
  customer: null;
  isBusinessEnquiry?: boolean;
  isExistingCustomer?: boolean;
  enquiryInterest?: string;
  detailsRequestedAt?: string | null;
};
type DemoWhatsAppMessage = {
  id: string;
  chatId: string;
  direction: "inbound" | "outbound";
  type: string;
  body: string;
  createdAt: string;
};
type DemoDb = {
  products: DemoProduct[];
  orders: DemoOrder[];
  prizes: DemoPrize[];
  assignments: DemoAssignment[];
  leads: DemoLead[];
  whatsappMessages: DemoWhatsAppMessage[];
  campaigns: DemoCampaign[];
  rewardTokens: DemoRewardToken[];
  collaborators: DemoCollaborator[];
  settings: StoreSettings;
};

const demoSettings: StoreSettings = {
  storeName: "3D Print Co.",
  supportEmail: "hello@3dprintco.in",
  supportPhone: "+91 98400 00000",
  city: "Chennai",
  gstin: "",
  freeShippingOver: 149900,
  shippingFlat: 4900,
  razorpayKeyId: "",
  paymentsReady: false,
  notifyEmail: "",
  notifications: { email: false, webhook: false },
};

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function sampleProduct(
  id: string,
  slug: string,
  name: string,
  category: string,
  price: number,
  variant: Product["variant"],
  accent: string,
  badge: string,
  description: string,
  material = "PLA+ matte",
  stock = 12,
): DemoProduct {
  return {
    id,
    slug,
    name,
    category,
    price,
    mrp: Math.round(price * 1.2),
    description,
    material,
    dimensions: "Approx. 12 × 8 × 8 cm",
    printTime: "4–6 hours",
    stock,
    badge,
    variant,
    accent,
    rating: 4.8,
    reviews: 16 + Number(id.slice(-1)),
    active: true,
    createdAt: daysAgo(30),
  };
}

function seedDemoDb(): DemoDb {
  const products = [
    sampleProduct("demo-p-01", "articulated-dragon", "Articulated Desk Dragon", "Miniatures", 129900, "dragon", "#a78bfa", "Bestseller", "A flexible articulated dragon designed as a playful desk companion."),
    sampleProduct("demo-p-02", "modular-desk-organiser", "Modular Desk Organiser", "Desk gear", 89900, "organiser", "#34d399", "Made to order", "A compact organiser for pens, clips and everyday desk essentials.", "PLA+ matte", 8),
    sampleProduct("demo-p-03", "kinetic-gear-fidget", "Kinetic Gear Fidget", "Miniatures", 49900, "gear", "#fb7185", "Small batch", "Interlocking gears make this pocket-sized fidget satisfying to turn."),
    sampleProduct("demo-p-04", "ripple-mini-planter", "Ripple Mini Planter", "Home", 69900, "planter", "#fbbf24", "New", "A sculptural planter for small succulents and cuttings.", "PLA+ silk", 15),
    sampleProduct("demo-p-05", "guardian-knight", "Guardian Knight Figure", "Miniatures", 159900, "knight", "#60a5fa", "Studio pick", "A display-ready fantasy miniature with layered armour details.", "PLA+ matte", 6),
    sampleProduct("demo-p-06", "filament-swatch-set", "Filament Colour Set", "Supplies", 34900, "spool", "#f472b6", "Colour samples", "A sample set to compare popular filament colours before a custom order.", "PLA", 24),
    sampleProduct("demo-p-07", "lattice-vase", "Lattice Table Vase", "Home", 119900, "lattice", "#2dd4bf", "Gift idea", "A lightweight decorative vase with an airy geometric surface.", "PLA+ silk", 9),
    sampleProduct("demo-p-08", "cable-dock", "Snap-fit Cable Dock", "Functional", 29900, "organiser", "#c084fc", "Everyday utility", "A tidy snap-fit cable holder for a cleaner workstation.", "PETG", 22),
  ];

  // Sample live offers so the preview shows the countdown surfaces.
  const offerStart = new Date(Date.now() - 3_600_000).toISOString();
  const offerEnd = new Date(Date.now() + 2 * 86_400_000).toISOString();
  for (const [index, promotionPrice] of [[0, 99900], [6, 89900]] as const) {
    products[index].promotionPrice = promotionPrice;
    products[index].promotionStartAt = offerStart;
    products[index].promotionEndAt = offerEnd;
  }

  const sampleOrders: DemoOrder[] = [
    { id: "demo-o-01", orderNumber: "ORD-11112026-A1B2C3D4E5", customerId: "demo-c-01", customerCode: "11112026K4M29XQPAB", customerName: "Aarav Menon", phone: "+91 98400 11288", email: "aarav@example.com", address: "12 Beach Road", city: "Chennai", state: "Tamil Nadu", pin: "600041", postalCode: "600041", subtotal: 129900, shipping: 0, total: 129900, status: "delivered", orderStatus: "delivered", paymentStatus: "paid", paymentId: "demo_pay_001", uid: "11112026K4M29XQPAB", createdAt: daysAgo(2), marketingOptIn: true, items: [{ productId: "demo-p-01", name: "Articulated Desk Dragon", qty: 1, price: 129900, lineTotal: 129900 }] },
    { id: "demo-o-02", orderNumber: "ORD-09112026-F6G7H8J9K0", customerId: "demo-c-02", customerCode: "09112026P7N3B6TAQ9", customerName: "Diya Raman", phone: "+91 98840 22110", email: "diya@example.com", address: "4 Lake View Street", city: "Coimbatore", state: "Tamil Nadu", pin: "641001", postalCode: "641001", subtotal: 159800, shipping: 0, total: 159800, status: "shipped", orderStatus: "shipped", paymentStatus: "paid", paymentId: "demo_pay_002", uid: "09112026P7N3B6TAQ9", createdAt: daysAgo(4), marketingOptIn: true, items: [{ productId: "demo-p-02", name: "Modular Desk Organiser", qty: 1, price: 89900, lineTotal: 89900 }, { productId: "demo-p-04", name: "Ripple Mini Planter", qty: 1, price: 69900, lineTotal: 69900 }] },
    { id: "demo-o-03", orderNumber: "ORD-07112026-M1N2P3Q4R5", customerId: "demo-c-03", customerCode: "07112026H8V5Q2LMN4", customerName: "Kabir Shah", phone: "+91 98765 43210", email: "kabir@example.com", address: "21 Bypass Road", city: "Madurai", state: "Tamil Nadu", pin: "625001", postalCode: "625001", subtotal: 49900, shipping: 4900, total: 54800, status: "processing", orderStatus: "processing", paymentStatus: "paid", paymentId: "demo_pay_003", uid: "07112026H8V5Q2LMN4", createdAt: daysAgo(6), items: [{ productId: "demo-p-03", name: "Kinetic Gear Fidget", qty: 1, price: 49900, lineTotal: 49900 }] },
    { id: "demo-o-04", orderNumber: "ORD-05112026-S6T7U8V9W0", customerId: "demo-c-04", customerCode: "05112026C5R9W3JDT8", customerName: "Mira Iyer", phone: "+91 90030 44556", email: "mira@example.com", address: "8 Park Avenue", city: "Chennai", state: "Tamil Nadu", pin: "600028", postalCode: "600028", subtotal: 119900, shipping: 4900, total: 124800, status: "confirmed", orderStatus: "confirmed", paymentStatus: "paid", paymentId: "demo_pay_004", uid: "05112026C5R9W3JDT8", createdAt: daysAgo(8), items: [{ productId: "demo-p-07", name: "Lattice Table Vase", qty: 1, price: 119900, lineTotal: 119900 }] },
    { id: "demo-o-05", orderNumber: "ORD-03112026-X1Y2Z3A4B5", customerId: "demo-c-05", customerCode: "03112026T1Z6A8KUB2", customerName: "Neel Joshi", phone: "+91 98100 77889", email: "neel@example.com", address: "17 Station Road", city: "Tiruchirappalli", state: "Tamil Nadu", pin: "620001", postalCode: "620001", subtotal: 159900, shipping: 0, total: 159900, status: "pending", orderStatus: "pending", paymentStatus: "pending", uid: "03112026T1Z6A8KUB2", createdAt: daysAgo(10), items: [{ productId: "demo-p-05", name: "Guardian Knight Figure", qty: 1, price: 159900, lineTotal: 159900 }] },
  ];

  const prizes: DemoPrize[] = [
    { id: "demo-r-01", title: "₹500 Studio Voucher", description: "A sample partner voucher for a future campaign. Final terms are subject to approval.", prizeType: "voucher", tier: "regular", voucherCode: "DEMO-500", worth: 50000, sponsor: "3D Print Co.", cycle: "Sample campaign", status: "open", active: true, quantity: 1, createdAt: daysAgo(15) },
    { id: "demo-r-02", title: "Custom Print Credit", description: "Credit toward a custom 3D-printing project.", prizeType: "credit", tier: "special", worth: 100000, sponsor: "Studio reward", cycle: "Sample campaign", status: "open", active: true, quantity: 1, createdAt: daysAgo(12) },
    { id: "demo-r-03", title: "Filament Starter Pack", description: "A sample reward bundle for an upcoming partner campaign.", prizeType: "product", tier: "regular", worth: 79900, sponsor: "Partner preview", cycle: "Sample campaign", status: "open", active: true, quantity: 1, createdAt: daysAgo(9) },
  ];

  return { products, orders: sampleOrders, prizes, assignments: [], leads: [], whatsappMessages: [], campaigns: [], rewardTokens: [], collaborators: [], settings: { ...demoSettings } };
}

function readDb(): DemoDb {
  const raw = localStorage.getItem(DEMO_DB_KEY);
  if (!raw) {
    const seeded = seedDemoDb();
    writeDb(seeded);
    return seeded;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !("products" in parsed) || !("orders" in parsed)) {
    throw new Error("The local demo data is invalid. Clear this site's local storage and reload.");
  }
  return {
    ...(parsed as DemoDb),
    prizes: Array.isArray((parsed as Partial<DemoDb>).prizes)
      ? (parsed as DemoDb).prizes.map((prize) => ({ ...prize, quantity: Math.max(1, Number(prize.quantity) || 1) }))
      : [],
    leads: Array.isArray((parsed as Partial<DemoDb>).leads) ? (parsed as DemoDb).leads : [],
    whatsappMessages: Array.isArray((parsed as Partial<DemoDb>).whatsappMessages) ? (parsed as DemoDb).whatsappMessages : [],
    campaigns: Array.isArray((parsed as Partial<DemoDb>).campaigns) ? (parsed as DemoDb).campaigns : [],
    rewardTokens: Array.isArray((parsed as Partial<DemoDb>).rewardTokens) ? (parsed as DemoDb).rewardTokens : [],
    collaborators: Array.isArray((parsed as Partial<DemoDb>).collaborators) ? (parsed as DemoDb).collaborators : [],
  };
}

function writeDb(db: DemoDb): void {
  localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db));
}

function jsonResponse<T>(data: T): T {
  return data;
}

function badRequest(message: string, status = 400): never {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  throw error;
}

function requireDemoSession(): void {
  if (localStorage.getItem(DEMO_SESSION_KEY) !== "true") {
    badRequest("Your demo admin session has expired. Sign in again.", 401);
  }
}

function customersFrom(orders: Order[]): DemoCustomer[] {
  const grouped = new Map<string, Order[]>();
  for (const order of orders) {
    grouped.set(order.customerCode, [...(grouped.get(order.customerCode) ?? []), order]);
  }
  return [...grouped.entries()].map(([code, customerOrders]) => {
    const order = customerOrders[0];
    const paidOrders = customerOrders.filter((item) => item.paymentStatus === "paid");
    return {
      id: order.customerId,
      customerCode: code,
      name: order.customerName,
      fullName: order.customerName,
      email: order.email ?? "",
      phone: order.phone,
      city: order.city,
      state: order.state,
      postalCode: order.postalCode ?? order.pin,
      address: order.address,
      orders: customerOrders.length,
      paidOrders: paidOrders.length,
      spend: paidOrders.reduce((sum, item) => sum + item.total, 0),
      joinedAt: order.createdAt,
      marketingOptIn: (order as DemoOrder).marketingOptIn === true,
    };
  });
}

function demoPhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

function demoCustomerSession(db: DemoDb, phone: string) {
  const digits = demoPhoneDigits(phone);
  if (digits.length !== 10) return null;
  const orders = db.orders.filter((order) => demoPhoneDigits(order.phone) === digits);
  const customer = customersFrom(orders)[0];
  if (!customer) return null;
  return {
    customer: {
      code: customer.customerCode,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      state: customer.state,
      postalCode: customer.postalCode,
    },
    orders,
  };
}

function productSales(db: DemoDb, product: DemoProduct): DemoProduct {
  const sold = db.orders
    .filter((order) => order.paymentStatus === "paid")
    .flatMap((order) => order.createdAt ? order.items.map((item) => ({ order, item })) : [])
    .filter(({ item }) => item.productId === product.id);
  const recentSoldCount = sold
    .filter(({ order }) => Date.now() - new Date(order.createdAt).getTime() <= 30 * 86_400_000)
    .reduce((sum, { item }) => sum + item.qty, 0);
  const soldCount = sold.reduce((sum, { item }) => sum + item.qty, 0);
  return {
    ...product,
    soldCount,
    recentSoldCount,
    trendTag: recentSoldCount >= 3 ? "Hot" : soldCount >= 10 ? "Best seller" : undefined,
  };
}

function makeSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeProduct(id: string, input: Record<string, unknown>, previous?: DemoProduct): DemoProduct {
  const name = String(input.name ?? previous?.name ?? "New sample product");
  const images = Array.isArray(input.images) ? input.images.map(String) : previous?.images ?? [];
  return {
    ...(previous ?? {
      id,
      slug: makeSlug(name),
      name,
      category: "Functional",
      price: 49900,
      description: "",
      material: "PLA+ matte",
      dimensions: "Approx. 12 × 8 × 8 cm",
      printTime: "4–6 hours",
      stock: 10,
      variant: "organiser" as const,
      accent: "#a78bfa",
      rating: 5,
      reviews: 0,
      createdAt: new Date().toISOString(),
    }),
    name,
    slug: String(input.slug ?? makeSlug(name)),
    category: String(input.category ?? previous?.category ?? "Functional"),
    price: Number(input.price ?? previous?.price ?? 49900),
    mrp: input.mrp === null ? undefined : Number(input.mrp ?? previous?.mrp ?? 0) || undefined,
    description: String(input.description ?? previous?.description ?? ""),
    material: String(input.material ?? previous?.material ?? "PLA+ matte"),
    dimensions: String(input.dimensions ?? previous?.dimensions ?? ""),
    printTime: String(input.printTime ?? previous?.printTime ?? ""),
    stock: Number(input.stock ?? previous?.stock ?? 10),
    badge: input.badge === null ? undefined : String(input.badge ?? previous?.badge ?? "") || undefined,
    variant: (input.variant ?? previous?.variant ?? "organiser") as Product["variant"],
    accent: String(input.accent ?? previous?.accent ?? "#a78bfa"),
    images,
    imageUrl: images[0] ?? previous?.imageUrl,
    videoUrl: input.videoUrl === null ? undefined : String(input.videoUrl ?? previous?.videoUrl ?? "") || undefined,
    modelUrl: input.modelUrl === null ? undefined : String(input.modelUrl ?? previous?.modelUrl ?? "") || undefined,
    specifications: (input.specifications as Record<string, string> | undefined) ?? previous?.specifications,
    active: Boolean(input.active ?? previous?.active ?? true),
  };
}

export async function demoApiRequest<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
): Promise<T> {
  await Promise.resolve();
  const url = new URL(path, window.location.origin);
  const route = url.pathname.replace(/\/+$/, "") || "/";
  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (route === "/api/rewards/reveal") {
    const token = String(url.searchParams.get("token") ?? payload.token ?? "");
    const db = readDb();
    const entry = db.rewardTokens.find((reward) => reward.token === token);
    if (!entry) badRequest("Reward not found or no longer active.", 404);
    if (method === "POST") {
      entry.revealed = true;
      writeDb(db);
    }
    if (!entry.revealed) return jsonResponse({ revealed: false }) as T;
    const prize = db.prizes.find((item) => item.id === entry.prizeId);
    if (!prize) badRequest("Reward not found.", 404);
    return jsonResponse({
      revealed: true, title: prize.title, description: prize.description,
      worth: prize.worth, prizeType: prize.prizeType, sponsor: prize.sponsor,
      voucherCode: prize.voucherCode ?? null,
    }) as T;
  }

  if (route === "/api/admin/login" && method === "POST") {
    const email = String(payload.email ?? "").trim().toLowerCase();
    const password = String(payload.password ?? "");
    const expectedEmail = (import.meta.env.VITE_DEMO_ADMIN_EMAIL || "admin@3dprintco.in").toLowerCase();
    const expectedPassword = import.meta.env.VITE_DEMO_ADMIN_PASSWORD;
    if (!expectedPassword || email !== expectedEmail || password !== expectedPassword) {
      badRequest("Incorrect demo admin email or password.", 401);
    }
    localStorage.setItem(DEMO_SESSION_KEY, "true");
    return jsonResponse({ admin: { email: expectedEmail } }) as T;
  }
  if (route === "/api/admin/session" && method === "GET") {
    requireDemoSession();
    return jsonResponse({
      admin: { email: import.meta.env.VITE_DEMO_ADMIN_EMAIL || "admin@3dprintco.in" },
    }) as T;
  }
  if (route === "/api/admin/logout" && method === "POST") {
    localStorage.removeItem(DEMO_SESSION_KEY);
    return jsonResponse({ ok: true }) as T;
  }

  const isAdminRoute = route.startsWith("/api/admin/");
  if (isAdminRoute) requireDemoSession();

  const db = readDb();
  if (route === "/api/products" && method === "GET") {
    return jsonResponse({ products: db.products.filter((product) => product.active).map((product) => productSales(db, product)) }) as T;
  }
  if (route === "/api/settings" && method === "GET") {
    return jsonResponse({ settings: { ...db.settings, serverTime: new Date().toISOString() } }) as T;
  }
  if (route === "/api/prizes" && method === "GET") {
    return jsonResponse({
      prizes: db.prizes.filter((prize) => prize.active && prize.status === "open"
        && !db.collaborators.flatMap((item) => item.offers).some((offer) => offer.prizeId === prize.id)),
    }) as T;
  }

  // Customer sign-in mirrors the PHP flow. The preview cannot send WhatsApp, so
  // it accepts a fixed code and says so in the response.
  if (route === "/api/customer/auth/request" && method === "POST") {
    const session = demoCustomerSession(db, String(payload.phone ?? ""));
    return jsonResponse({
      message: session
        ? `Demo preview: use the code ${DEMO_OTP_CODE} to sign in.`
        : "If an account exists for this number, a sign-in code has been sent.",
    }) as T;
  }
  if (route === "/api/customer/auth/verify" && method === "POST") {
    const phone = String(payload.phone ?? "");
    if (String(payload.code ?? "").trim().toUpperCase() !== DEMO_OTP_CODE) {
      badRequest("The code is invalid or expired.", 400);
    }
    const session = demoCustomerSession(db, phone);
    if (!session) badRequest("The code is invalid or expired.", 400);
    localStorage.setItem(DEMO_CUSTOMER_SESSION_KEY, demoPhoneDigits(phone));
    return jsonResponse(session) as T;
  }
  if (route === "/api/customer/session" && method === "GET") {
    const phone = localStorage.getItem(DEMO_CUSTOMER_SESSION_KEY) ?? "";
    const session = phone ? demoCustomerSession(db, phone) : null;
    if (!session) badRequest("Sign in with your WhatsApp number to view your profile.", 401);
    return jsonResponse(session) as T;
  }
  if (route === "/api/customer/logout" && method === "POST") {
    localStorage.removeItem(DEMO_CUSTOMER_SESSION_KEY);
    return jsonResponse({ ok: true }) as T;
  }

  if (route === "/api/orders" && method === "POST") {
    const contact = payload.contact as Record<string, unknown> | undefined;
    const items = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [];
    if (!contact || items.length === 0) badRequest("Add an item and delivery details before placing a demo order.");
    const products = items.map((item) => {
      const product = db.products.find((candidate) => candidate.id === item.productId && candidate.active);
      if (!product) badRequest("A product in your cart is no longer available.");
      const quantity = Math.min(product.stock, Math.max(1, Number(item.quantity) || 1));
      return { product, quantity };
    });
    const customerName = String(contact.name ?? "Demo Customer");
    const email = String(contact.email ?? "");
    const phone = String(contact.phone ?? "");
    const city = String(contact.city ?? "");
    const unitPrice = (product: DemoProduct): number => {
      const startsAt = product.promotionStartAt ? Date.parse(product.promotionStartAt) : NaN;
      const endsAt = product.promotionEndAt ? Date.parse(product.promotionEndAt) : NaN;
      return product.promotionPrice
        && Number.isFinite(startsAt) && Number.isFinite(endsAt)
        && startsAt <= Date.now() && Date.now() < endsAt
        ? product.promotionPrice
        : product.price;
    };
    const subtotal = products.reduce((sum, item) => sum + unitPrice(item.product) * item.quantity, 0);
    const shipping = subtotal >= db.settings.freeShippingOver ? 0 : db.settings.shippingFlat;
    const digits = phone.replace(/\D/g, "").slice(-10);
    const previous = db.orders.find((order) => order.phone.replace(/\D/g, "").slice(-10) === digits);
    const customerCode = previous?.customerCode ?? newCustomerId();
    const customerId = previous?.customerId ?? customerCode;
    const now = new Date().toISOString();
    const orderNumber = newOrderId();
    const order: DemoOrder = {
      id: orderNumber,
      orderNumber,
      customerId,
      customerCode,
      customerName,
      phone,
      email,
      address: String(contact.address ?? ""),
      city,
      state: String(contact.state ?? ""),
      pin: String(contact.postalCode ?? ""),
      postalCode: String(contact.postalCode ?? ""),
      subtotal,
      shipping,
      total: subtotal + shipping,
      status: "pending",
      orderStatus: "pending",
      paymentStatus: "pending",
      uid: customerCode,
      createdAt: now,
      marketingOptIn: Boolean(contact.marketingOptIn),
      items: products.map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        qty: quantity,
        price: unitPrice(product),
        lineTotal: unitPrice(product) * quantity,
        imageUrl: product.imageUrl,
      })),
    };
    db.orders.unshift(order);
    writeDb(db);
    return jsonResponse({
      order,
      session: {
        orderNumber,
        customerCode,
        razorpayOrderId: "demo-no-payment",
        keyId: "",
        amount: order.total,
        currency: "INR",
        customerName,
        customerEmail: email,
        customerPhone: phone,
      },
    }) as T;
  }
  const orderMatch = route.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch && method === "GET") {
    const order = db.orders.find((item) => item.orderNumber === decodeURIComponent(orderMatch[1]));
    if (!order || url.searchParams.get("code") !== order.customerCode) {
      badRequest("Order not found for this customer ID.", 404);
    }
    return jsonResponse({ order }) as T;
  }
  const accountMatch = route.match(/^\/api\/customers\/([^/]+)\/orders$/);
  if (accountMatch && method === "GET") {
    const code = decodeURIComponent(accountMatch[1]);
    const orders = db.orders.filter((order) => order.customerCode === code);
    if (!orders.length) badRequest("No orders were found for that customer ID.", 404);
    const customer = customersFrom(orders)[0];
    return jsonResponse({ customer: { code, name: customer.name, email: customer.email, phone: customer.phone }, orders }) as T;
  }

  if (route === "/api/admin/stats" && method === "GET") {
    const paid = db.orders.filter((order) => order.paymentStatus === "paid");
    const recent = db.orders.slice(0, 7).map((order) => ({
      id: order.orderNumber,
      customerName: order.customerName,
      city: order.city,
      total: order.total,
      status: order.orderStatus,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    }));
    return jsonResponse({
      revenue: paid.reduce((sum, order) => sum + order.total, 0),
      orderCount: db.orders.length,
      customers: customersFrom(db.orders).length,
      products: db.products.filter((product) => product.active).length,
      pendingOrders: db.orders.filter((order) => order.paymentStatus === "pending").length,
      openPrizes: db.prizes.filter((prize) => prize.active && prize.status === "open").length,
      lowStock: db.products.filter((product) => product.active && product.stock < 5).map(({ id, name, stock, category }) => ({ id, name, stock, category })),
      recent,
    }) as T;
  }

  if (route === "/api/admin/insights" && method === "GET") {
    const paidOrders = db.orders.filter((order) => order.paymentStatus === "paid");
    const enquiries = db.leads.filter((lead) => lead.isBusinessEnquiry && !lead.isExistingCustomer);
    const conversions = enquiries.filter((lead) => lead.customer);
    const byDay = new Map<string, number>();
    for (const order of paidOrders) {
      const day = order.createdAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const products = db.products.map((product) => {
      const sales = paidOrders.flatMap((order) => order.items.filter((item) => item.productId === product.id).map((item) => ({ order, item })));
      const units = sales.reduce((sum, { item }) => sum + item.qty, 0);
      const recentUnits = sales.filter(({ order }) => Date.now() - new Date(order.createdAt).getTime() <= 30 * 86_400_000).reduce((sum, { item }) => sum + item.qty, 0);
      return {
        id: product.id, name: product.name, units, recentUnits,
        revenue: sales.reduce((sum, { item }) => sum + (item.lineTotal ?? item.price * item.qty), 0),
        trendTag: recentUnits >= 3 ? "Hot" : units >= 10 ? "Best seller" : null,
      };
    }).sort((a, b) => b.units - a.units).slice(0, 20);
    return jsonResponse({
      summary: {
        enquiries: enquiries.length, conversions: conversions.length,
        conversionRate: enquiries.length ? Math.round(conversions.length * 1000 / enquiries.length) / 10 : 0,
        paidOrders: paidOrders.length, revenue: paidOrders.reduce((sum, order) => sum + order.total, 0),
      },
      dailyPaidOrders: [...byDay].map(([day, count]) => ({ day, count })),
      enquiryHeatmap: [],
      products,
    }) as T;
  }

  if (route === "/api/admin/campaigns/audience" && method === "GET") {
    const customers = customersFrom(db.orders).filter((customer) => customer.marketingOptIn && customer.phone);
    return jsonResponse({ count: customers.length, customers: customers.map(({ customerCode, name, email, phone }) => ({ customerCode, name, email, phone })) }) as T;
  }
  if (route === "/api/admin/campaigns" && method === "GET") {
    return jsonResponse({ campaigns: db.campaigns.map(({ recipientCodes: _codes, ...campaign }) => campaign) }) as T;
  }
  if (route === "/api/admin/campaigns" && method === "POST") {
    const message = String(payload.message ?? "").trim();
    if (!message) badRequest("Campaign message is required.");
    if (!/\b(?:stop|unsubscribe|opt[\s-]?out)\b/i.test(message)) badRequest("Add an opt-out instruction such as Reply STOP.");
    const audience = customersFrom(db.orders).filter((customer) => customer.marketingOptIn && customer.phone);
    if (!audience.length) badRequest("There are no opted-in customers in the demo data.");
    const campaign: DemoCampaign = {
      id: `demo-campaign-${crypto.randomUUID()}`, message,
      recipientCount: audience.length, sentCount: 0, failedCount: 0, skippedCount: 0,
      createdAt: new Date().toISOString(), recipientCodes: audience.map((customer) => customer.customerCode),
    };
    db.campaigns.unshift(campaign);
    writeDb(db);
    const { recipientCodes: _codes, ...response } = campaign;
    return jsonResponse({ campaign: response }) as T;
  }
  const demoCampaignMatch = route.match(/^\/api\/admin\/campaigns\/([^/]+)\/send$/);
  if (demoCampaignMatch && method === "POST") {
    const campaign = db.campaigns.find((item) => item.id === decodeURIComponent(demoCampaignMatch[1]));
    if (!campaign) badRequest("Campaign not found.", 404);
    const processed = Math.min(20, campaign.recipientCount - campaign.sentCount - campaign.failedCount - campaign.skippedCount);
    campaign.sentCount += processed;
    writeDb(db);
    return jsonResponse({
      campaignId: campaign.id, processed, sentCount: campaign.sentCount,
      failedCount: campaign.failedCount, skippedCount: campaign.skippedCount,
      remaining: campaign.recipientCount - campaign.sentCount - campaign.failedCount - campaign.skippedCount,
    }) as T;
  }

  if (route === "/api/admin/products" && method === "GET") {
    return jsonResponse({ products: db.products.map((product) => productSales(db, product)) }) as T;
  }
  if (route === "/api/admin/products" && method === "POST") {
    const product = makeProduct(`demo-p-${crypto.randomUUID()}`, payload);
    db.products.unshift(product);
    writeDb(db);
    return jsonResponse({ product }) as T;
  }
  const productMatch = route.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch) {
    const id = decodeURIComponent(productMatch[1]);
    const index = db.products.findIndex((product) => product.id === id);
    if (index < 0) badRequest("Product not found.", 404);
    if (method === "DELETE") {
      db.products[index] = { ...db.products[index], active: false };
      writeDb(db);
      return jsonResponse({ ok: true }) as T;
    }
    if (method === "PATCH") {
      const product = makeProduct(id, payload, db.products[index]);
      db.products[index] = product;
      writeDb(db);
      return jsonResponse({ product }) as T;
    }
  }

  if (route === "/api/admin/orders" && method === "GET") {
    let orders = [...db.orders];
    const paymentStatus = url.searchParams.get("paymentStatus");
    const orderStatus = url.searchParams.get("orderStatus");
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    if (paymentStatus && paymentStatus !== "all") orders = orders.filter((order) => order.paymentStatus === paymentStatus);
    if (orderStatus && orderStatus !== "all") orders = orders.filter((order) => order.orderStatus === orderStatus);
    if (q) orders = orders.filter((order) => `${order.orderNumber} ${order.customerName} ${order.phone} ${order.customerCode}`.toLowerCase().includes(q));
    return jsonResponse({ orders }) as T;
  }
  const adminOrderMatch = route.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (adminOrderMatch && method === "PATCH") {
    const orderNumber = decodeURIComponent(adminOrderMatch[1]);
    const order = db.orders.find((item) => item.orderNumber === orderNumber);
    if (!order) badRequest("Order not found.", 404);
    const orderStatus = String(payload.orderStatus ?? order.orderStatus) as Order["orderStatus"];
    const changed = order.orderStatus !== orderStatus;
    order.orderStatus = orderStatus;
    order.status = orderStatus;
    order.updatedAt = new Date().toISOString();
    writeDb(db);
    return jsonResponse({ order, notifications: { whatsapp: changed ? "not_configured" : "unchanged" } }) as T;
  }

  if (route === "/api/admin/customers" && method === "GET") {
    const query = (url.searchParams.get("q") ?? "").toLowerCase();
    const customers = customersFrom(db.orders).filter((customer) =>
      `${customer.name} ${customer.email} ${customer.phone} ${customer.customerCode}`.toLowerCase().includes(query),
    );
    return jsonResponse({ customers }) as T;
  }
  const adminCustomerMatch = route.match(/^\/api\/admin\/customers\/([^/]+)$/);
  if (adminCustomerMatch && method === "GET") {
    const code = decodeURIComponent(adminCustomerMatch[1]);
    const orders = db.orders.filter((order) => order.customerCode === code);
    const customer = customersFrom(orders)[0];
    if (!customer) badRequest("Customer not found.", 404);
    return jsonResponse({ customer, orders }) as T;
  }

  if (route === "/api/admin/leads" && method === "GET") {
    const leads = [...db.leads].sort((a, b) =>
      Number(a.status !== "new") - Number(b.status !== "new")
      || b.updatedAt.localeCompare(a.updatedAt),
    );
    return jsonResponse({ leads, newCount: leads.filter((lead) => lead.status === "new").length }) as T;
  }
  if (route === "/api/admin/leads/count" && method === "GET") {
    return jsonResponse({ newCount: db.leads.filter((lead) => lead.status === "new").length }) as T;
  }
  if (route === "/api/admin/whatsapp/messages" && method === "GET") {
    const chatId = url.searchParams.get("chatId") ?? "";
    return jsonResponse({ messages: db.whatsappMessages.filter((message) => message.chatId === chatId) }) as T;
  }
  if (route === "/api/admin/whatsapp/messages" && method === "POST") {
    const chatId = String(payload.chatId ?? "");
    const message = String(payload.message ?? "").trim();
    if (!chatId || !message) badRequest("Choose a contact and enter a message.");
    db.whatsappMessages.push({
      id: `demo-wa-${crypto.randomUUID()}`,
      chatId,
      direction: "outbound",
      type: "chat",
      body: message,
      createdAt: new Date().toISOString(),
    });
    writeDb(db);
    return jsonResponse({ sent: true }) as T;
  }
  const demoLeadMatch = route.match(/^\/api\/admin\/leads\/([^/]+)$/);
  if (demoLeadMatch && method === "PATCH") {
    const id = decodeURIComponent(demoLeadMatch[1]);
    const lead = db.leads.find((item) => item.id === id);
    if (!lead) badRequest("Lead not found.", 404);
    const status = payload.status;
    if (!["new", "active", "closed"].includes(String(status))) badRequest("Unknown lead status.");
    lead.status = status as DemoLead["status"];
    lead.updatedAt = new Date().toISOString();
    writeDb(db);
    return jsonResponse({ lead }) as T;
  }

  if (route === "/api/admin/prizes" && method === "GET") {
    return jsonResponse({
      prizes: db.prizes.map((prize) => ({
        ...prize,
        availableQuantity: Math.max(0, prize.quantity - db.assignments.filter((item) => item.prizeId === prize.id && !item.releasedAt).length),
      })),
      assignments: db.assignments,
    }) as T;
  }
  if (route === "/api/admin/prizes" && method === "POST") {
    const prize: DemoPrize = {
      id: `demo-r-${crypto.randomUUID()}`,
      title: String(payload.title ?? "New reward"),
      description: String(payload.description ?? ""),
      prizeType: String(payload.prizeType ?? "regular"),
      tier: String(payload.prizeType ?? "regular"),
      voucherCode: String(payload.voucherCode ?? "") || undefined,
      worth: Number(payload.worth ?? 0),
      quantity: Math.max(1, Number(payload.quantity ?? 1)),
      sponsor: String(payload.sponsor ?? ""),
      cycle: String(payload.cycle ?? ""),
      status: "open",
      active: true,
      createdAt: new Date().toISOString(),
    };
    db.prizes.unshift(prize);
    writeDb(db);
    return jsonResponse({ prize }) as T;
  }
  if (route === "/api/admin/prizes/assign" && method === "POST") {
    const prize = db.prizes.find((item) => item.id === payload.prizeId && item.active && item.status === "open");
    const customer = customersFrom(db.orders).find((item) => item.customerCode === payload.customerId && item.paidOrders > 0);
    if (!prize || !customer) badRequest("Choose an open prize and a customer with a paid sample order.");
    const activeAssignments = db.assignments.filter((item) => item.prizeId === prize.id && !item.releasedAt);
    if (activeAssignments.length >= prize.quantity) badRequest("No units of this reward remain.", 409);
    if (activeAssignments.some((item) => item.customerId === customer.customerCode)) badRequest("This customer already has this active reward.", 409);
    if (activeAssignments.length + 1 >= prize.quantity) prize.status = "awarded";
    prize.awardedTo = customer.customerCode;
    prize.awardedToName = customer.name;
    prize.awardedAt = new Date().toISOString();
    const rewardToken = crypto.randomUUID().replace(/-/g, "");
    const assignment: DemoAssignment = {
      id: `demo-a-${crypto.randomUUID()}`,
      prizeId: prize.id,
      prizeTitle: prize.title,
      customerId: customer.customerCode,
      customerName: customer.name,
      customerEmail: customer.email,
      assignedBy: "Demo administrator",
      notificationStatus: "demo_only",
      assignedAt: new Date().toISOString(),
      revealUrl: `/reward/${rewardToken}`,
      notes: String(payload.notes ?? ""),
    };
    db.rewardTokens.push({
      token: rewardToken,
      prizeId: prize.id,
      revealed: false,
    });
    db.assignments.unshift(assignment);
    writeDb(db);
    return jsonResponse({ assignment }) as T;
  }
  if (route === "/api/admin/collaborators" && method === "GET") {
    return jsonResponse({ collaborators: db.collaborators }) as T;
  }
  if (route === "/api/admin/collaborators" && method === "POST") {
    const collaborator: DemoCollaborator = {
      id: `demo-partner-${crypto.randomUUID()}`,
      name: String(payload.name ?? ""),
      contactName: String(payload.contactName ?? ""),
      email: String(payload.email ?? ""),
      phone: String(payload.phone ?? ""),
      notes: String(payload.notes ?? ""),
      active: true,
      createdAt: new Date().toISOString(),
      offers: [],
    };
    if (collaborator.name.trim().length < 2) badRequest("Collaborator name must contain at least 2 characters.");
    db.collaborators.unshift(collaborator);
    writeDb(db);
    return jsonResponse({ collaborator }) as T;
  }
  const demoCollaboratorOfferMatch = route.match(/^\/api\/admin\/collaborators\/([^/]+)\/offers$/);
  if (demoCollaboratorOfferMatch && method === "POST") {
    const collaborator = db.collaborators.find((item) => item.id === decodeURIComponent(demoCollaboratorOfferMatch[1]));
    if (!collaborator || !collaborator.active) badRequest("Choose an active collaborator.", 404);
    const quantity = Number(payload.quantity ?? 1);
    const rewardValue = Number(payload.rewardValue ?? 0);
    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(rewardValue) || rewardValue < 0) badRequest("Enter a valid reward value and quantity.");
    const prizeId = `demo-r-${crypto.randomUUID()}`;
    const offer: DemoCollaboratorOffer = {
      id: `demo-offer-${crypto.randomUUID()}`,
      collaboratorId: collaborator.id,
      prizeId,
      rewardName: String(payload.rewardName ?? ""),
      rewardType: String(payload.rewardType ?? "other") as DemoCollaboratorOffer["rewardType"],
      rewardValue,
      quantity,
      terms: String(payload.terms ?? ""),
      createdAt: new Date().toISOString(),
    };
    const prize: DemoPrize = {
      id: prizeId,
      title: offer.rewardName,
      description: offer.terms,
      prizeType: offer.rewardType === "product" || offer.rewardType === "other" ? "regular" : "voucher",
      tier: offer.rewardType,
      worth: offer.rewardType === "cashback" || offer.rewardType === "fixed_discount" ? Math.round(rewardValue * 100) : 0,
      sponsor: collaborator.name,
      cycle: "Collaborator offer",
      status: "open",
      active: true,
      quantity,
      createdAt: new Date().toISOString(),
    };
    db.prizes.unshift(prize);
    collaborator.offers.unshift(offer);
    writeDb(db);
    return jsonResponse({ offer }) as T;
  }
  const demoCollaboratorMatch = route.match(/^\/api\/admin\/collaborators\/([^/]+)$/);
  if (demoCollaboratorMatch && method === "PATCH") {
    const collaborator = db.collaborators.find((item) => item.id === decodeURIComponent(demoCollaboratorMatch[1]));
    if (!collaborator) badRequest("Collaborator not found.", 404);
    Object.assign(collaborator, payload);
    writeDb(db);
    return jsonResponse({ collaborator }) as T;
  }
  const demoOfferMatch = route.match(/^\/api\/admin\/collaborator-offers\/([^/]+)$/);
  if (demoOfferMatch && method === "PATCH") {
    const offer = db.collaborators.flatMap((item) => item.offers).find((item) => item.id === decodeURIComponent(demoOfferMatch[1]));
    if (!offer) badRequest("Collaborator offer not found.", 404);
    Object.assign(offer, payload);
    const prize = db.prizes.find((item) => item.id === offer.prizeId);
    if (prize) {
      prize.title = offer.rewardName;
      prize.description = offer.terms;
      prize.quantity = offer.quantity;
      prize.worth = offer.rewardType === "cashback" || offer.rewardType === "fixed_discount" ? Math.round(offer.rewardValue * 100) : 0;
    }
    writeDb(db);
    return jsonResponse({ offer }) as T;
  }
  const prizeMatch = route.match(/^\/api\/admin\/prizes\/([^/]+)$/);
  if (prizeMatch) {
    const id = decodeURIComponent(prizeMatch[1]);
    const index = db.prizes.findIndex((prize) => prize.id === id);
    if (index < 0) badRequest("Prize not found.", 404);
    if (method === "DELETE") {
      db.prizes[index] = { ...db.prizes[index], active: false };
      writeDb(db);
      return jsonResponse({ ok: true }) as T;
    }
    if (method === "PATCH") {
      if (payload.status === "open" && db.prizes[index].status === "awarded") {
        const assignment = db.assignments.find(
          (item) => item.prizeId === id && !item.releasedAt,
        );
        if (assignment) assignment.releasedAt = new Date().toISOString();
        db.prizes[index] = {
          ...db.prizes[index],
          status: "open",
          awardedTo: undefined,
          awardedToName: undefined,
          awardedAt: undefined,
        };
        writeDb(db);
        return jsonResponse({ prize: db.prizes[index] }) as T;
      }
      db.prizes[index] = { ...db.prizes[index], ...payload } as DemoPrize;
      writeDb(db);
      return jsonResponse({ prize: db.prizes[index] }) as T;
    }
  }
  if (route === "/api/admin/settings" && method === "GET") {
    return jsonResponse({
      settings: db.settings,
      capabilities: { database: false, razorpayTestMode: false, razorpayWebhook: false, adminAuth: true, email: false, webhook: false },
    }) as T;
  }
  if (route === "/api/admin/settings" && method === "PATCH") {
    db.settings = { ...db.settings, ...payload } as StoreSettings;
    writeDb(db);
    return jsonResponse({
      settings: db.settings,
      capabilities: { database: false, razorpayTestMode: false, razorpayWebhook: false, adminAuth: true, email: false, webhook: false },
    }) as T;
  }
  if (route === "/api/admin/uploads" && method === "GET") return jsonResponse({ files: [] }) as T;
  if (route === "/api/admin/uploads" && method === "DELETE") return jsonResponse({ ok: true }) as T;

  badRequest(`This action is unavailable in the local demo: ${method} ${route}`, 501);
}
