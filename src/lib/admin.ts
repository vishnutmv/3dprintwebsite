/**
 * Typed admin API client. The browser sends the HttpOnly session cookie
 * automatically; a 401 clears only the in-memory login state.
 */

import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "./api";
import { useAdminAuth } from "./auth";
import type { Order, Prize, Product, ProductReview, StoreSettings } from "./types";

export type AdminProduct = Product & {
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminCustomer = {
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
  joinedAt: string;
};

export type AdminLead = {
  id: string;
  chatId: string;
  phone: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string;
  status: "new" | "active" | "closed";
  isBusinessEnquiry: boolean;
  isExistingCustomer: boolean;
  enquiryInterest: string;
  detailsRequestedAt: string | null;
  autoFollowupDueAt: string | null;
  autoFollowupSentAt: string | null;
  lastAdminReplyAt: string | null;
  /** Time of the customer's latest inbound message (UTC ISO). */
  lastInboundAt: string | null;
  /** Set while no admin has replied since that message; null when answered. */
  awaitingAdminSince: string | null;
  createdAt: string;
  updatedAt: string;
  chatUrl: string;
  customer: {
    customerCode: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    marketingOptIn: boolean;
  } | null;
};

export type WhatsAppMessage = {
  id: string;
  direction: "inbound" | "outbound";
  type: string;
  body: string;
  createdAt: string;
};

export type AdminOrder = Order;

export type AdminReview = ProductReview & {
  customerPhone?: string | null;
  customerEmail?: string | null;
};

export const TRACKING_COURIERS = [
  { slug: "delhivery", name: "Delhivery" },
  { slug: "dtdc", name: "DTDC" },
  { slug: "bluedart", name: "Blue Dart" },
  { slug: "speedpost", name: "Speed Post" },
  { slug: "indiapost", name: "India Post" },
  { slug: "xpressbees", name: "XpressBees" },
  { slug: "ekart", name: "Ekart Logistics" },
  { slug: "shadowfax", name: "Shadowfax" },
  { slug: "professional", name: "Professional Courier" },
  { slug: "trackon", name: "Trackon Courier" },
  { slug: "shreetirupati", name: "Shree Tirupati Courier" },
  { slug: "stcourier", name: "ST Courier" },
  { slug: "shreemaruti", name: "Shree Maruti" },
  { slug: "gati", name: "Gati" },
  { slug: "shiprocket", name: "Shiprocket" },
  { slug: "vrl", name: "VRL Logistics" },
] as const;

export type AdminAssignment = {
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

export type AdminCampaign = {
  id: string;
  message: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
};

export type CampaignBatchResult = {
  campaignId: string;
  processed: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  remaining: number;
};

export type AdminInsights = {
  summary: {
    enquiries: number;
    conversions: number;
    conversionRate: number;
    paidOrders: number;
    revenue: number;
  };
  dailyPaidOrders: { day: string; count: number }[];
  enquiryHeatmap: { weekday: number; hour: number; count: number }[];
  products: { id: string; name: string; units: number; recentUnits: number; revenue: number; trendTag: string | null }[];
};

export type AdminPrize = Prize & {
  active: boolean;
  quantity: number;
  availableQuantity?: number;
  createdAt?: string;
  updatedAt?: string;
  awardedToName?: string;
};

export type AdminStats = {
  revenue: number;
  orderCount: number;
  customers: number;
  products: number;
  pendingOrders: number;
  openPrizes: number;
  lowStock: { id: string; name: string; stock: number; category: string }[];
  recent: {
    id: string;
    customerName: string;
    city: string;
    total: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }[];
};

export type AdminCapabilities = {
  database: boolean;
  razorpayTestMode: boolean;
  razorpayWebhook: boolean;
  adminAuth: boolean;
  email: boolean;
  webhook: boolean;
};

export type AdminSettingsResponse = {
  settings: StoreSettings & { razorpayKeyId: string };
  capabilities: AdminCapabilities;
};

export type AdminSettingsInput = {
  storeName?: string;
  supportEmail?: string;
  supportPhone?: string;
  city?: string;
  gstin?: string;
  freeShippingOver?: number;
  shippingFlat?: number;
};

export type ProductInput = {
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  price?: number;
  mrp?: number | null;
  promotionPrice?: number | null;
  promotionStartAt?: string | null;
  promotionEndAt?: string | null;
  stock?: number;
  images?: string[];
  videoUrl?: string | null;
  specifications?: Record<string, string>;
  material?: string;
  dimensions?: string;
  printTime?: string;
  badge?: string | null;
  variant?: string;
  accent?: string;
  modelUrl?: string | null;
  rating?: number;
  reviews?: number;
  active?: boolean;
};

export type PrizeInput = {
  title?: string;
  description?: string;
  prizeType?: string;
  voucherCode?: string | null;
  worth?: number;
  quantity?: number;
  sponsor?: string;
  cycle?: string;
  mediaUrls?: string[];
  active?: boolean;
  status?: string;
};

export type AdminCollaboratorOffer = {
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

export type AdminCollaborator = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  createdAt?: string;
  offers: AdminCollaboratorOffer[];
};

export type MediaFile = {
  name: string;
  path: string;
  size: number | null;
  contentType: string | null;
  createdAt: string | null;
  publicUrl: string;
};

async function authed<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      useAdminAuth.getState().clearSession();
    }
    throw error;
  }
}

export function adminGet<T>(path: string): Promise<T> {
  return authed(() => apiGet<T>(path));
}

export function adminPost<T>(path: string, body: unknown): Promise<T> {
  return authed(() => apiPost<T>(path, body));
}

export function adminPatch<T>(path: string, body: unknown): Promise<T> {
  return authed(() => apiPatch<T>(path, body));
}

export function adminDelete<T>(path: string, body?: unknown): Promise<T> {
  return authed(() => apiDelete<T>(path, body));
}

/* ---------------------------- Dashboard ---------------------------- */

export function getStats(): Promise<AdminStats> {
  return adminGet<AdminStats>("/api/admin/stats");
}

export function getInsights(): Promise<AdminInsights> {
  return adminGet<AdminInsights>("/api/admin/insights");
}

export function getCampaignAudience(): Promise<{
  count: number;
  customers: { customerCode: string; name: string; email: string; phone: string }[];
}> {
  return adminGet("/api/admin/campaigns/audience");
}

export async function getCampaigns(): Promise<AdminCampaign[]> {
  const response = await adminGet<{ campaigns: AdminCampaign[] }>("/api/admin/campaigns");
  return response.campaigns;
}

export async function createCampaign(message: string): Promise<AdminCampaign> {
  const response = await adminPost<{ campaign: AdminCampaign }>("/api/admin/campaigns", { message });
  return response.campaign;
}

export function sendCampaignBatch(id: string): Promise<CampaignBatchResult> {
  return adminPost(`/api/admin/campaigns/${encodeURIComponent(id)}/send`, {});
}

/* ---------------------------- Products ----------------------------- */

export async function getProducts(): Promise<AdminProduct[]> {
  const response = await adminGet<{ products: AdminProduct[] }>("/api/admin/products");
  return response.products;
}

export async function createProduct(input: ProductInput): Promise<AdminProduct> {
  const response = await adminPost<{ product: AdminProduct }>("/api/admin/products", input);
  return response.product;
}

export async function updateProduct(id: string, input: ProductInput): Promise<AdminProduct> {
  const response = await adminPatch<{ product: AdminProduct }>(
    `/api/admin/products/${encodeURIComponent(id)}`,
    input,
  );
  return response.product;
}

export function deactivateProduct(id: string): Promise<{ ok: boolean }> {
  return adminDelete(`/api/admin/products/${encodeURIComponent(id)}`);
}

/* ---------------------------- Orders ------------------------------- */

export type OrderFilters = {
  paymentStatus?: string;
  orderStatus?: string;
  q?: string;
};

export async function getOrders(filters: OrderFilters = {}): Promise<AdminOrder[]> {
  const params = new URLSearchParams();
  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    params.set("paymentStatus", filters.paymentStatus);
  }
  if (filters.orderStatus && filters.orderStatus !== "all") {
    params.set("orderStatus", filters.orderStatus);
  }
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await adminGet<{ orders: AdminOrder[] }>(`/api/admin/orders${suffix}`);
  return response.orders;
}

export async function updateOrderStatus(
  orderNumber: string,
  orderStatus: string,
): Promise<{ order: AdminOrder; notifications: { whatsapp: "sent" | "failed" | "not_configured" | "unchanged" } }> {
  const response = await adminPatch<{ order: AdminOrder; notifications: { whatsapp: "sent" | "failed" | "not_configured" | "unchanged" } }>(
    `/api/admin/orders/${encodeURIComponent(orderNumber)}`,
    { orderStatus },
  );
  return response;
}

export async function updateOrderShipment(
  orderNumber: string,
  shipment: { courier: string; trackingNumber: string },
): Promise<AdminOrder> {
  const response = await adminPatch<{ order: AdminOrder }>(
    `/api/admin/orders/${encodeURIComponent(orderNumber)}/shipment`,
    shipment,
  );
  return response.order;
}

/* ---------------------------- Reviews ------------------------------ */

export async function getReviews(): Promise<{ reviews: AdminReview[]; unreadCount: number; adminName: string }> {
  return adminGet("/api/admin/reviews");
}

export async function getReviewCount(): Promise<{ unreadCount: number; total: number; averageRating: number }> {
  return adminGet("/api/admin/reviews/count");
}

export async function replyToReview(
  id: string,
  reply: string,
): Promise<{ review: AdminReview | null; notifications: { whatsapp: string } }> {
  return adminPost(`/api/admin/reviews/${encodeURIComponent(id)}/reply`, { reply });
}

export function setReviewStatus(id: string, status: "published" | "hidden"): Promise<{ ok: boolean }> {
  return adminPatch(`/api/admin/reviews/${encodeURIComponent(id)}`, { status });
}

export function deleteReview(id: string): Promise<{ ok: boolean }> {
  return adminDelete(`/api/admin/reviews/${encodeURIComponent(id)}`);
}

/* --------------------------- Customers ----------------------------- */

export async function getCustomers(q = ""): Promise<AdminCustomer[]> {
  const suffix = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const response = await adminGet<{ customers: AdminCustomer[] }>(`/api/admin/customers${suffix}`);
  return response.customers;
}

export function getCustomer(code: string): Promise<{ customer: AdminCustomer; orders: AdminOrder[] }> {
  return adminGet(`/api/admin/customers/${encodeURIComponent(code)}`);
}

/* ------------------------------- Leads ---------------------------- */

export async function getLeads(): Promise<{ leads: AdminLead[]; newCount: number; overdueCount: number }> {
  return adminGet("/api/admin/leads");
}

export async function getLeadCounts(): Promise<{ newCount: number; overdueCount: number; attentionCount: number }> {
  return adminGet("/api/admin/leads/count");
}

export async function updateLeadStatus(id: string, status: AdminLead["status"]): Promise<AdminLead> {
  const response = await adminPatch<{ lead: AdminLead }>(
    `/api/admin/leads/${encodeURIComponent(id)}`,
    { status },
  );
  return response.lead;
}

export async function getWhatsAppMessages(chatId: string): Promise<WhatsAppMessage[]> {
  const response = await adminGet<{ messages: WhatsAppMessage[] }>(
    `/api/admin/whatsapp/messages?chatId=${encodeURIComponent(chatId)}`,
  );
  return response.messages;
}

export function sendWhatsAppMessage(input: {
  chatId?: string;
  phone?: string;
  name: string;
  message: string;
}): Promise<{ sent: boolean }> {
  return adminPost("/api/admin/whatsapp/messages", input);
}

/* ----------------------------- Prizes ------------------------------ */

export async function getPrizes(): Promise<{
  prizes: AdminPrize[];
  assignments: AdminAssignment[];
}> {
  return adminGet("/api/admin/prizes");
}

export async function createPrize(input: PrizeInput): Promise<AdminPrize> {
  const response = await adminPost<{ prize: AdminPrize }>("/api/admin/prizes", input);
  return response.prize;
}

export async function updatePrize(id: string, input: PrizeInput): Promise<AdminPrize> {
  const response = await adminPatch<{ prize: AdminPrize }>(
    `/api/admin/prizes/${encodeURIComponent(id)}`,
    input,
  );
  return response.prize;
}

export function deletePrize(id: string): Promise<{ ok: boolean }> {
  return adminDelete(`/api/admin/prizes/${encodeURIComponent(id)}`);
}

export async function assignPrize(input: {
  prizeId: string;
  customerId: string;
  notes?: string;
}): Promise<AdminAssignment> {
  const response = await adminPost<{ assignment: AdminAssignment }>(
    "/api/admin/prizes/assign",
    input,
  );
  return response.assignment;
}

export async function getCollaborators(): Promise<AdminCollaborator[]> {
  const response = await adminGet<{ collaborators: AdminCollaborator[] }>("/api/admin/collaborators");
  return response.collaborators;
}

export async function createCollaborator(input: Pick<AdminCollaborator, "name" | "contactName" | "email" | "phone" | "notes">): Promise<AdminCollaborator> {
  const response = await adminPost<{ collaborator: AdminCollaborator }>("/api/admin/collaborators", input);
  return response.collaborator;
}

export async function updateCollaborator(
  id: string,
  input: Partial<Pick<AdminCollaborator, "name" | "contactName" | "email" | "phone" | "notes" | "active">>,
): Promise<AdminCollaborator> {
  const response = await adminPatch<{ collaborator: AdminCollaborator }>(`/api/admin/collaborators/${encodeURIComponent(id)}`, input);
  return response.collaborator;
}

export async function createCollaboratorOffer(
  id: string,
  input: Pick<AdminCollaboratorOffer, "rewardName" | "rewardType" | "rewardValue" | "quantity" | "terms">,
): Promise<AdminCollaboratorOffer> {
  const response = await adminPost<{ offer: AdminCollaboratorOffer }>(`/api/admin/collaborators/${encodeURIComponent(id)}/offers`, input);
  return response.offer;
}

export async function updateCollaboratorOffer(
  id: string,
  input: Partial<Pick<AdminCollaboratorOffer, "rewardName" | "rewardType" | "rewardValue" | "quantity" | "terms">>,
): Promise<AdminCollaboratorOffer> {
  const response = await adminPatch<{ offer: AdminCollaboratorOffer }>(`/api/admin/collaborator-offers/${encodeURIComponent(id)}`, input);
  return response.offer;
}

/* ---------------------------- Settings ----------------------------- */

export function getAdminSettings(): Promise<AdminSettingsResponse> {
  return adminGet<AdminSettingsResponse>("/api/admin/settings");
}

export function saveAdminSettings(input: AdminSettingsInput): Promise<AdminSettingsResponse> {
  return adminPatch<AdminSettingsResponse>("/api/admin/settings", input);
}

/* ----------------------------- Media ------------------------------- */

export async function listMedia(bucket: string): Promise<MediaFile[]> {
  const response = await adminGet<{ files: MediaFile[] }>(
    `/api/admin/uploads?bucket=${encodeURIComponent(bucket)}`,
  );
  return response.files;
}

export function deleteMedia(url: string): Promise<{ ok: boolean }> {
  return adminDelete("/api/admin/uploads", { url });
}
