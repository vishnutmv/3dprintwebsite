/**
 * Typed admin API client. The browser sends the HttpOnly session cookie
 * automatically; a 401 clears only the in-memory login state.
 */

import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "./api";
import { useAdminAuth } from "./auth";
import type { Order, Prize, Product, StoreSettings } from "./types";

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
  notes: string;
};

export type AdminPrize = Prize & {
  active: boolean;
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
  sponsor?: string;
  cycle?: string;
  mediaUrls?: string[];
  active?: boolean;
  status?: string;
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

export async function updateOrderStatus(orderNumber: string, orderStatus: string): Promise<AdminOrder> {
  const response = await adminPatch<{ order: AdminOrder }>(
    `/api/admin/orders/${encodeURIComponent(orderNumber)}`,
    { orderStatus },
  );
  return response.order;
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

export async function getLeads(): Promise<{ leads: AdminLead[]; newCount: number }> {
  return adminGet("/api/admin/leads");
}

export async function getNewLeadCount(): Promise<number> {
  const response = await adminGet<{ newCount: number }>("/api/admin/leads/count");
  return response.newCount;
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
