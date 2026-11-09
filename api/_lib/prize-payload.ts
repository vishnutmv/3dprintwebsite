import { intInRange, text } from "./validate";
import { mediaUrls } from "./media";

export const PRIZE_TYPES = ["bumper", "mega", "regular", "consolation", "voucher"];
export const PRIZE_STATUSES = ["open", "awarded", "claimed"];

export type PrizeValues = {
  title?: string;
  description?: string;
  prize_type?: string;
  voucher_code?: string | null;
  worth?: number;
  sponsor?: string;
  cycle?: string;
  media_urls?: string[];
  is_active?: boolean;
  status?: string;
};

export function parsePrizePayload(
  body: Record<string, unknown>,
  partial: boolean,
): { values: PrizeValues } | { error: string } {
  const values: PrizeValues = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

  if (has("title") || !partial) {
    const title = text(body.title, 160);
    if (title.length < 2) return { error: "Prize title is required." };
    values.title = title;
  }

  if (has("description")) values.description = text(body.description, 2000);

  if (has("prizeType") || has("prize_type")) {
    const type = text(has("prizeType") ? body.prizeType : body.prize_type, 30);
    if (!PRIZE_TYPES.includes(type)) return { error: "Unknown prize type." };
    values.prize_type = type;
  }

  if (has("voucherCode") || has("voucher_code")) {
    const raw = text(has("voucherCode") ? body.voucherCode : body.voucher_code, 40).toUpperCase();
    if (!raw) {
      values.voucher_code = null;
    } else {
      if (!/^[A-Z0-9-]{4,40}$/.test(raw)) {
        return { error: "Voucher code may only contain A–Z, 0–9 and hyphens (4–40 chars)." };
      }
      values.voucher_code = raw;
    }
  }

  if (has("worth")) {
    const worth = intInRange(body.worth, 0, 100_000_000);
    if (worth === null) return { error: "Prize value must be a whole number in paise." };
    values.worth = worth;
  }

  if (has("sponsor")) values.sponsor = text(body.sponsor, 160);
  if (has("cycle")) values.cycle = text(body.cycle, 60);

  if (has("mediaUrls") || has("media_urls")) {
    const urls = mediaUrls(has("mediaUrls") ? body.mediaUrls : body.media_urls);
    if (!urls) return { error: "Media must be up to 12 valid http(s) URLs." };
    values.media_urls = urls;
  }

  if (has("active") || has("isActive")) {
    values.is_active = Boolean(has("active") ? body.active : body.isActive);
  }

  if (has("status")) {
    const status = text(body.status, 20);
    if (!PRIZE_STATUSES.includes(status)) return { error: "Unknown prize status." };
    values.status = status;
  }

  if (partial && Object.keys(values).length === 0) return { error: "Nothing to update." };

  return { values };
}
