/**
 * Order creation and checkout-session logic.
 * Prices, stock and totals are always recalculated here from Supabase.
 */

import { db } from "./supabase";
import { getStoreSettings } from "./settings";
import { findOrCreateCustomer, getCustomerById } from "./customers";
import { createRazorpayOrder } from "./razorpay";
import { razorpayEnv } from "./env";
import type { CustomerRow, OrderItemRow, OrderRow, ProductRow } from "./mapping";
import { intInRange, isUuid, isRecord, text, type Contact } from "./validate";

export type CartLine = { product: ProductRow; quantity: number; lineTotal: number };

export class OrderError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrderError";
    this.status = status;
  }
}

export function parseCartItems(value: unknown): { productId: string; quantity: number }[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OrderError("Your cart is empty.");
  }
  if (value.length > 50) throw new OrderError("Too many different products in one order.");

  const merged = new Map<string, number>();
  for (const raw of value) {
    if (!isRecord(raw)) throw new OrderError("Invalid cart item.");
    const productId = text(raw.productId ?? raw.product_id, 64);
    const quantity = intInRange(raw.quantity ?? raw.qty, 1, 50);
    if (!isUuid(productId)) throw new OrderError("Invalid product in cart.");
    if (quantity === null) throw new OrderError("Each quantity must be between 1 and 50.");
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }

  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function priceCart(rawItems: unknown): Promise<{
  lines: CartLine[];
  subtotal: number;
  shipping: number;
  total: number;
}> {
  const requested = parseCartItems(rawItems);
  const ids = requested.map((item) => item.productId);

  const { data, error } = await db()
    .from("products")
    .select("*")
    .in("id", ids)
    .eq("is_active", true);
  if (error) throw new Error(`Could not load products: ${error.message}`);

  const products = (data ?? []) as ProductRow[];
  const lines: CartLine[] = [];

  for (const item of requested) {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) throw new OrderError("One of the products is no longer available.", 409);
    if (product.stock_quantity < item.quantity) {
      throw new OrderError(
        `Only ${product.stock_quantity} of ${product.name} left in stock.`,
        409,
      );
    }
    lines.push({
      product,
      quantity: item.quantity,
      lineTotal: product.price * item.quantity,
    });
  }

  const settings = await getStoreSettings();
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping =
    subtotal >= settings.freeShippingOver ? 0 : Math.max(0, settings.shippingFlat);
  const total = subtotal + shipping;
  if (total <= 0) throw new OrderError("Order total is invalid.");

  return { lines, subtotal, shipping, total };
}

async function insertOrder(input: {
  customerId: string;
  subtotal: number;
  shipping: number;
  total: number;
  notes: string;
}): Promise<OrderRow> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await db()
      .from("orders")
      .insert({
        customer_id: input.customerId,
        subtotal: input.subtotal,
        shipping_charge: input.shipping,
        total_amount: input.total,
        payment_status: "pending",
        order_status: "pending",
        notes: input.notes || null,
      })
      .select("*")
      .single();

    if (!error && data) return data as OrderRow;
    if (error?.code !== "23505") {
      throw new Error(`Could not create order: ${error?.message ?? "unknown error"}`);
    }
  }
  throw new Error("Could not allocate a unique order number. Please retry.");
}

export async function createPendingOrder(input: {
  contact: Contact;
  items: unknown;
}): Promise<{
  order: OrderRow;
  customer: CustomerRow;
  items: OrderItemRow[];
  lines: CartLine[];
}> {
  const { lines, subtotal, shipping, total } = await priceCart(input.items);
  const customer = await findOrCreateCustomer(input.contact);
  const order = await insertOrder({
    customerId: customer.id,
    subtotal,
    shipping,
    total,
    notes: "",
  });

  const { data: itemRows, error: itemError } = await db()
    .from("order_items")
    .insert(
      lines.map((line) => ({
        order_id: order.id,
        product_id: line.product.id,
        product_name: line.product.name,
        quantity: line.quantity,
        unit_price: line.product.price,
        total_price: line.lineTotal,
        image_url: line.product.images?.[0] ?? null,
        model_url: line.product.model_url ?? null,
      })),
    )
    .select("*");
  if (itemError) {
    // Do not leave a half-written order behind.
    await db().from("orders").delete().eq("id", order.id);
    throw new Error(`Could not create order items: ${itemError.message}`);
  }

  return {
    order,
    customer,
    items: (itemRows ?? []) as OrderItemRow[],
    lines,
  };
}

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

/**
 * Creates (or safely reuses) the Razorpay order for a pending Supabase order.
 * The amount always comes from the stored order, never from the browser.
 */
export async function createCheckoutSession(orderNumber: string, expectedCustomerCode?: string): Promise<{
  order: OrderRow;
  customer: CustomerRow;
  session: CheckoutSession;
}> {
  const { keyId } = razorpayEnv();
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  if (!data) throw new OrderError("Order not found.", 404);

  const order = data as OrderRow;
  const customer = await getCustomerById(order.customer_id);
  if (!customer) throw new OrderError("Customer record is missing.", 409);
  if (
    expectedCustomerCode &&
    customer.customer_code.toUpperCase() !== expectedCustomerCode.trim().toUpperCase()
  ) {
    throw new OrderError("Order not found.", 404);
  }
  if (order.payment_status === "paid") {
    throw new OrderError("This order has already been paid.", 409);
  }
  if (order.order_status === "cancelled") {
    throw new OrderError("This order was cancelled.", 409);
  }

  let razorpayOrderId = order.razorpay_order_id;
  if (!razorpayOrderId) {
    const settings = await getStoreSettings();
    const razorpayOrder = await createRazorpayOrder({
      amount: order.total_amount,
      receipt: order.order_number,
      notes: {
        order_number: order.order_number,
        customer_code: customer.customer_code,
        store: settings.storeName.slice(0, 80),
      },
    });

    const { data: updated, error: updateError } = await db()
      .from("orders")
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq("id", order.id)
      .is("razorpay_order_id", null)
      .select("*")
      .maybeSingle();

    if (updateError && updateError.code !== "23505") {
      throw new Error(`Could not save Razorpay order id: ${updateError.message}`);
    }

    if (updated) {
      razorpayOrderId = razorpayOrder.id;
    } else {
      // A concurrent request already attached one — read it back.
      const { data: current } = await db()
        .from("orders")
        .select("razorpay_order_id")
        .eq("id", order.id)
        .single();
      razorpayOrderId = (current?.razorpay_order_id as string | null) ?? razorpayOrder.id;
    }
  }

  const { error: paymentError } = await db()
    .from("payments")
    .upsert(
      {
        order_id: order.id,
        gateway: "razorpay",
        gateway_order_id: razorpayOrderId,
        amount: order.total_amount,
        currency: "INR",
        status: "created",
        payment_signature_verified: false,
      },
      { onConflict: "order_id" },
    );
  if (paymentError) {
    throw new Error(`Could not create payment record: ${paymentError.message}`);
  }

  return {
    order,
    customer,
    session: {
      orderNumber: order.order_number,
      customerCode: customer.customer_code,
      razorpayOrderId,
      keyId,
      amount: order.total_amount,
      currency: "INR",
      customerName: customer.full_name,
      customerEmail: customer.email ?? "",
      customerPhone: customer.phone,
    },
  };
}

export async function getOrderByNumber(orderNumber: string): Promise<{
  order: OrderRow;
  items: OrderItemRow[];
  customer: CustomerRow | null;
} | null> {
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  if (!data) return null;

  const order = data as OrderRow;
  const [{ data: items }, customer] = await Promise.all([
    db().from("order_items").select("*").eq("order_id", order.id),
    getCustomerById(order.customer_id),
  ]);
  return { order, items: (items ?? []) as OrderItemRow[], customer };
}
