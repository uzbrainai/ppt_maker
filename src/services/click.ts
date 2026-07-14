/**
 * Click.uz Shop API helpers (payment button + prepare/complete webhooks).
 * Docs: https://docs.click.uz
 *
 * Env:
 *   CLICK_MERCHANT_ID
 *   CLICK_SERVICE_ID
 *   CLICK_SECRET_KEY
 *   CLICK_MERCHANT_USER_ID  (optional, Merchant API only)
 *   PUBLIC_WEB_URL          e.g. https://make-ppt.com
 *   PUBLIC_API_URL          e.g. https://make-ppt.com/api  (Click webhook base)
 */

import { createHash } from "crypto";

export interface ClickConfig {
  merchantId: string;
  serviceId: string;
  secretKey: string;
  merchantUserId?: string;
  webUrl: string;
  apiUrl: string;
}

export interface PlanOffer {
  id: string;
  name: string;
  /** Amount charged via Click, in UZS. */
  amountUzs: number;
  credits: number;
  plan: string;
  monthlyAllowance: number;
}

/** Paid packs available on /profile/plans (amounts are UZS for Click). */
export const CLICK_PLANS: Record<string, PlanOffer> = {
  pro: {
    id: "pro",
    name: "Pro",
    amountUzs: Number(process.env.CLICK_PRICE_PRO_UZS ?? 229_000),
    credits: 300,
    plan: "pro",
    monthlyAllowance: 300,
  },
  team: {
    id: "team",
    name: "Team",
    amountUzs: Number(process.env.CLICK_PRICE_TEAM_UZS ?? 590_000),
    credits: 1000,
    plan: "team",
    monthlyAllowance: 1000,
  },
};

export function clickConfigured(): boolean {
  return !!(
    process.env.CLICK_MERCHANT_ID &&
    process.env.CLICK_SERVICE_ID &&
    process.env.CLICK_SECRET_KEY
  );
}

export function getClickConfig(): ClickConfig | null {
  if (!clickConfigured()) return null;
  return {
    merchantId: String(process.env.CLICK_MERCHANT_ID),
    serviceId: String(process.env.CLICK_SERVICE_ID),
    secretKey: String(process.env.CLICK_SECRET_KEY),
    merchantUserId: process.env.CLICK_MERCHANT_USER_ID || undefined,
    webUrl: (process.env.PUBLIC_WEB_URL || "https://make-ppt.com").replace(/\/$/, ""),
    apiUrl: (process.env.PUBLIC_API_URL || process.env.PUBLIC_WEB_URL || "https://make-ppt.com").replace(/\/$/, ""),
  };
}

export function md5(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}

/** Prepare (action=0): 7 fields. Complete (action=1): 8 fields (+ merchant_prepare_id). */
export function verifyClickSign(params: {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  amount: string;
  action: string | number;
  sign_time: string;
  sign_string: string;
  merchant_prepare_id?: string;
  secretKey: string;
}): boolean {
  const action = String(params.action);
  const parts =
    action === "1"
      ? [
          params.click_trans_id,
          params.service_id,
          params.secretKey,
          params.merchant_trans_id,
          String(params.merchant_prepare_id ?? ""),
          params.amount,
          action,
          params.sign_time,
        ]
      : [
          params.click_trans_id,
          params.service_id,
          params.secretKey,
          params.merchant_trans_id,
          params.amount,
          action,
          params.sign_time,
        ];
  return md5(parts.join("")) === params.sign_string;
}

/** Redirect the user to Click's hosted payment page. */
export function buildClickPayUrl(cfg: ClickConfig, opts: {
  amountUzs: number;
  merchantTransId: string;
  returnUrl?: string;
}): string {
  const u = new URL("https://my.click.uz/services/pay");
  u.searchParams.set("service_id", cfg.serviceId);
  u.searchParams.set("merchant_id", cfg.merchantId);
  u.searchParams.set("amount", String(opts.amountUzs));
  u.searchParams.set("transaction_param", opts.merchantTransId);
  u.searchParams.set(
    "return_url",
    opts.returnUrl || `${cfg.webUrl}/profile/subscribed?paid=1`
  );
  return u.toString();
}

export type ClickWebhookBody = Record<string, string | undefined>;

export function normalizeClickBody(body: unknown): ClickWebhookBody {
  if (!body || typeof body !== "object") return {};
  const out: ClickWebhookBody = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (v == null) out[k] = undefined;
    else out[k] = String(v);
  }
  return out;
}
