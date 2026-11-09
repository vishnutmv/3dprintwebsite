/**
 * Customer identity: reuse an existing row when the verified email/phone
 * matches, otherwise create one with a unique random customer code.
 */

import { db } from "./supabase";
import type { CustomerRow } from "./mapping";
import { phoneDigits, type Contact } from "./validate";

const SELECT = "*";

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function findOrCreateCustomer(contact: Contact): Promise<CustomerRow> {
  const phone = phoneDigits(contact.phone);
  const email = contact.email.toLowerCase();

  const lookup = async (): Promise<CustomerRow | null> => {
    const { data, error } = await db()
      .from("customers")
      .select(SELECT)
      .or(`email.eq.${email},phone.eq.${phone}`)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Customer lookup failed: ${error.message}`);
    return (data as CustomerRow | null) ?? null;
  };

  const existing = await lookup();
  if (existing) {
    const { data, error } = await db()
      .from("customers")
      .update({
        full_name: contact.name,
        email,
        phone,
        delivery_address: contact.address,
        city: contact.city,
        state: contact.state,
        postal_code: contact.postalCode,
        marketing_opt_in: contact.marketingOptIn,
      })
      .eq("id", existing.id)
      .select(SELECT)
      .single();
    if (error) throw new Error(`Customer update failed: ${error.message}`);
    return data as CustomerRow;
  }

  const base = {
    full_name: contact.name,
    email,
    phone,
    delivery_address: contact.address,
    city: contact.city,
    state: contact.state,
    postal_code: contact.postalCode,
    marketing_opt_in: contact.marketingOptIn,
  };

  // The database generates customer_code; retry on a rare collision or a
  // concurrent insert of the same identity.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await db()
      .from("customers")
      .insert(base)
      .select(SELECT)
      .single();

    if (!error && data) return data as CustomerRow;
    if (error && !isUniqueViolation(error)) {
      throw new Error(`Customer creation failed: ${error.message}`);
    }
    const raced = await lookup();
    if (raced) return raced;
  }

  throw new Error("Could not allocate a unique customer code. Please retry.");
}

export async function getCustomerById(id: string): Promise<CustomerRow | null> {
  const { data, error } = await db().from("customers").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`Customer lookup failed: ${error.message}`);
  return (data as CustomerRow | null) ?? null;
}

export async function getCustomerByCode(code: string): Promise<CustomerRow | null> {
  const { data, error } = await db()
    .from("customers")
    .select(SELECT)
    .eq("customer_code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(`Customer lookup failed: ${error.message}`);
  return (data as CustomerRow | null) ?? null;
}
