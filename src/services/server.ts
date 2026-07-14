/**
 * slidewind generation service — HTTP API around the deck generator.
 *
 *   POST /generate                 standard deck (web-grounded content)
 *   POST /generate {premium:true}  premium deck (+ AI photos via imagesvc)
 *   POST /generate/stream          same, but streams real progress as SSE
 *   GET  /deck/:id/editor          editable text boxes + text-less backgrounds
 *   POST /deck/:id/build           apply text edits → recompiled .pptx
 *   POST /rewrite                  AI rewrite a text snippet (magic editor)
 *   GET  /me                       current user profile + credit balance
 *   GET  /me/materials             the user's generated decks
 *   GET  /me/credits/ledger        credit transaction history
 *   POST /credits/checkout         start Click.uz payment (returns payUrl)
 *   POST /payments/click           Click Shop API prepare/complete webhook
 *   POST /admin/credits/grant      admin top-up (x-admin-key)
 *   GET  /health
 *
 * Identity comes from the auth backend's JWT (sub claim); we mirror a profile and
 * own a per-user credit ledger. Credits meter generation at 1 credit / page, with
 * a monthly freemium allowance. Generated scenes are persisted (PostgreSQL) so the
 * canvas editor survives restarts; an in-memory cache fronts the DB for speed.
 *
 * When DATABASE_URL is unset the service runs "untracked" (no credits/persistence)
 * exactly like the original prototype, so nothing breaks without a DB.
 *
 * Password accounts must confirm their email with a 6-digit code (emailed via
 * Gmail SMTP) before a login token is issued; without SMTP creds the code is
 * logged to the console (dev mode). See services/mailer.ts.
 *
 * Env: OPENAI_API_KEY, OPENAI_MODEL, OPENAI_IMAGE_MODEL, IMAGE_SERVICE_URL,
 *      DATABASE_URL, FREE_MONTHLY_CREDITS (default 20), ADMIN_TOKEN,
 *      SLIDEWIND_TOKEN (optional shared-token auth), SLIDEWIND_PORT (8081),
 *      AUTH_REQUIRED, JWT_SECRET, CORS_ORIGIN, OUT_DIR,
 *      SMTP_USER, SMTP_PASS, SMTP_FROM (email verification; see mailer.ts),
 *      GOOGLE_CLIENT_ID (Google Sign-In ID token verification).
 */

import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwtPlugin from "@fastify/jwt";
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateDeck } from "../agent/orchestrate.js";
import { runWithUsageContext } from "../agent/usageContext.js";
import { buildPptxBuffer } from "../compiler/pptx/buildPptx.js";
import { convertToPdf, hasLibreOffice } from "../compiler/pdf.js";
import { renderSlideSvgs } from "../preview/svgRenderer.js";
import { extractEditables, applyTextEdits } from "../core/deckEdit.js";
import { loadEnv } from "../agent/env.js";
import type { PPTScene } from "../core/types.js";
import { migrate } from "../db/migrate.js";
import { randomInt } from "crypto";
import {
  ensureUser,
  createUser,
  getUserByEmail,
  getUserById,
  listUsers,
  setRole,
  setEmailVerified,
  upsertGoogleUser,
  setUserPlan,
  setUserBlocked,
  setUserUnlimited,
  type UserIdentity,
  type UserRecord,
} from "../db/users.js";
import {
  createSupportMessage,
  listSupportMessages,
  replySupportMessage,
} from "../db/supportMessages.js";
import {
  getDashboardStats,
  paymentsTimeseries,
  listPayments,
  type Period,
} from "../db/adminStats.js";
import {
  usageSummary,
  usageTimeseries,
  topUsers as topApiUsers,
} from "../db/apiUsage.js";
import {
  listAllPlans,
  listActivePlans,
  getPlanBySlug,
  createPlan,
  updatePlan,
  deletePlan,
  type PlanKind,
} from "../db/plans.js";
import {
  upsertVerificationCode,
  getVerification,
  bumpAttempts,
  clearVerification,
  MAX_VERIFY_ATTEMPTS,
} from "../db/verifications.js";
import { sendVerificationCode, mailEnabled } from "./mailer.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { googleAuthConfigured, verifyGoogleIdToken } from "./googleAuth.js";
import {
  getAccount,
  charge,
  grant,
  ledger,
  setMonthlyAllowance,
  InsufficientCreditsError,
} from "../db/credits.js";
import {
  saveMaterial,
  listMaterials,
  getMaterial,
  updateMaterialScene,
} from "../db/materials.js";
import {
  createPayment,
  getPaymentByMerchantTransId,
  markPaymentPrepared,
  markPaymentPaid,
  markPaymentFailed,
  revertPaymentToPrepared,
} from "../db/payments.js";
import { identityFromJwt, identityFromHeaders } from "./identity.js";
import { chat } from "../agent/openai.js";
import {
  buildClickPayUrl,
  CLICK_PLANS,
  clickConfigured,
  getClickConfig,
  normalizeClickBody,
  verifyClickSign,
} from "./click.js";
import { randomUUID } from "crypto";
import querystring from "node:querystring";

loadEnv();

const PORT = Number(process.env.SLIDEWIND_PORT ?? 8081);
const TOKEN = process.env.SLIDEWIND_TOKEN ?? "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const OUT_DIR = process.env.OUT_DIR ?? "";
// Hard ceiling on slides per deck, independent of credit balance. Credits already
// cap freemium users (1 credit = 1 page); this protects generation itself from
// runaway requests (LLM limits / timeouts) for any tier. Override via MAX_PAGES.
const MAX_PAGES = Math.max(1, Number(process.env.MAX_PAGES ?? 40));
// Allowed browser origins. Comma-separated list in CORS_ORIGIN, or "*" / unset to
// reflect any origin (handy for local dev with the Vite app on :5173).
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "";
// JWT: when AUTH_REQUIRED=true, protected routes require a Bearer token signed
// with JWT_SECRET (issued by the auth backend). Left off in local dev so the
// app's mock session keeps working. SLIDEWIND_TOKEN (x-api-key) always bypasses,
// for server-to-server calls.
const JWT_SECRET = process.env.JWT_SECRET ?? "";
const JWT_ENABLED = !!JWT_SECRET;
const JWT_TTL = process.env.JWT_TTL ?? "7d";
const AUTH_REQUIRED = (process.env.AUTH_REQUIRED ?? "false").toLowerCase() === "true";
// Seed admin credentials (created/promoted on boot). See seedAdmin().
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });

// Click Shop API posts application/x-www-form-urlencoded to /payments/click.
app.addContentTypeParser(
  "application/x-www-form-urlencoded",
  { parseAs: "string" },
  (_req, body, done) => {
    try {
      done(null, querystring.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  }
);

await app.register(cors, {
  origin: CORS_ORIGIN && CORS_ORIGIN !== "*" ? CORS_ORIGIN.split(",").map((s) => s.trim()) : true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key", "x-admin-key", "x-user-id", "x-user-email", "x-user-name", "Authorization"],
});

if (AUTH_REQUIRED && !JWT_SECRET) {
  app.log.error("AUTH_REQUIRED=true but JWT_SECRET is not set — refusing to start.");
  process.exit(1);
}
// Register JWT whenever a secret is configured: needed both to *sign* tokens on
// login/register and to *verify* them on protected routes. AUTH_REQUIRED only
// controls whether a valid token is mandatory (vs. the dev header fallback).
if (JWT_ENABLED) {
  await app.register(jwtPlugin, { secret: JWT_SECRET });
  app.log.info(AUTH_REQUIRED ? "JWT auth enforced on protected routes." : "JWT auth enabled (issued + verified when present).");
}

// Apply the DB schema (no-op without DATABASE_URL).
const TRACKING = await migrate();
app.log.info(TRACKING ? "persistence + credits enabled (PostgreSQL)" : "running untracked (no DATABASE_URL)");

// ── in-memory scene cache (most-recent-N), fronting the DB ──────────────────
interface StoredDeck { scene: PPTScene; title: string; userId?: string }
const decks = new Map<string, StoredDeck>();
const MAX_DECKS = 60;
let deckSeq = 0;
function newDeckId(): string {
  deckSeq += 1;
  return `d${Date.now().toString(36)}${deckSeq.toString(36)}`;
}
function cacheDeck(id: string, entry: StoredDeck): void {
  decks.set(id, entry);
  while (decks.size > MAX_DECKS) {
    const oldest = decks.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    decks.delete(oldest);
  }
}

/** Load a deck from cache, falling back to the DB (and caching it). */
async function loadDeck(id: string): Promise<StoredDeck | null> {
  const mem = decks.get(id);
  if (mem) return mem;
  if (!TRACKING) return null;
  const m = await getMaterial(id);
  if (!m) return null;
  const entry: StoredDeck = { scene: m.scene, title: m.title, userId: m.userId };
  cacheDeck(id, entry);
  return entry;
}

// ── auth / identity ─────────────────────────────────────────────────────────
interface AuthContext { identity: UserIdentity | null; service: boolean }

// Authenticate and resolve the caller's identity. Order: shared service token →
// (if enforced) a valid JWT → (in dev) headers / a stable dev user. Sends 401 and
// returns null when AUTH_REQUIRED and no valid credential is present.
async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<AuthContext | null> {
  const service = !!TOKEN && req.headers["x-api-key"] === TOKEN;
  if (service) {
    // Server-to-server: optionally bill a user named in headers.
    return { identity: identityFromHeaders(req), service: true };
  }
  // A Bearer JWT, when present and configured, is authoritative — it carries the
  // verified identity + role. This holds regardless of AUTH_REQUIRED, so tokens
  // issued by /auth/login work even in dev.
  const hasBearer =
    typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ");
  if (JWT_ENABLED && hasBearer) {
    try {
      await req.jwtVerify(); // verifies "Authorization: Bearer <jwt>" with JWT_SECRET
      return { identity: identityFromJwt(req.user), service: false };
    } catch {
      reply.code(401).send({ error: "invalid or expired token", code: "invalid_token" });
      return null;
    }
  }
  if (AUTH_REQUIRED) {
    reply.code(401).send({ error: "unauthorized", code: "auth_required" });
    return null;
  }
  // Dev / mock mode: identify via headers, else a stable local user so tracking works.
  const identity = identityFromHeaders(req) ?? { id: "dev-user", email: "dev@local", name: "Dev User" };
  return { identity, service: false };
}

/** Strip secrets before returning a user to the client. */
function publicUser(u: UserRecord): { id: string; email: string | null; name: string | null; plan: string; role: string; emailVerified: boolean } {
  return { id: u.id, email: u.email, name: u.name, plan: u.plan, role: u.role, emailVerified: u.emailVerified };
}

/** Sign a 7-day (JWT_TTL) access token carrying id/email/name/role. */
function issueToken(u: UserRecord): string {
  return app.jwt.sign({ sub: u.id, email: u.email, name: u.name, role: u.role }, { expiresIn: JWT_TTL });
}

/**
 * Gate an admin-only route. Allows the legacy shared admin key (x-admin-key) or a
 * caller whose verified JWT carries role=admin. Sends 403 and returns false otherwise.
 */
function requireAdmin(req: FastifyRequest, reply: FastifyReply, auth: AuthContext): boolean {
  if (ADMIN_TOKEN && req.headers["x-admin-key"] === ADMIN_TOKEN) return true;
  if (auth.identity?.role === "admin") return true;
  reply.code(403).send({ error: "admin only", code: "forbidden" });
  return false;
}

app.get("/health", async () => ({
  ok: true,
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
  imageService: process.env.IMAGE_SERVICE_URL || "(in-process)",
  tracking: TRACKING,
  pdf: hasLibreOffice(),
  decks: decks.size,
}));

interface GenBody {
  topic?: string;
  theme?: string;
  mode?: "light" | "dark";
  pages?: number;
  lang?: string;
  model?: string;
  research?: boolean;
  premium?: boolean;
  imagePct?: number;
  imageQuality?: "low" | "medium" | "high" | "auto";
  /** filename stem when OUT_DIR is set */
  name?: string;
}

/** Requested page count, defaulted and clamped to [1, MAX_PAGES]. */
function clampPages(pages: number | undefined): number {
  return Math.min(MAX_PAGES, Math.max(1, Math.floor(pages ?? 10)));
}

function prefs(b: GenBody) {
  return {
    topic: b.topic!,
    theme: b.theme,
    appearance: b.mode,
    pages: clampPages(b.pages),
    language: b.lang,
    model: b.model,
    research: b.research,
    premium: b.premium,
    imagePct: b.imagePct,
    imageQuality: b.imageQuality,
  };
}

function maybeWriteOut(b: GenBody, title: string, pptx: Buffer, yaml: string): string | undefined {
  if (!OUT_DIR) return undefined;
  const stem = (b.name ?? title ?? "deck").replace(/[^\w.-]+/g, "_").slice(0, 60);
  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, `${stem}.pptx`);
  writeFileSync(file, pptx);
  writeFileSync(join(OUT_DIR, `${stem}.yaml`), yaml, "utf8");
  return file;
}

interface CreditState { balance: number; charged: number; monthlyAllowance: number; unlimited?: boolean }

/**
 * Pre-flight credit check before generating. Returns the user's balance + needed
 * credits, or null when tracking is off / no user (untracked generation). Sends
 * 402 and returns the sentinel { blocked: true } when the balance is too low.
 */
async function preflightCredits(
  identity: UserIdentity | null,
  pages: number,
  reply: FastifyReply
): Promise<{ balance: number; monthlyAllowance: number; unlimited?: boolean } | null | { blocked: true }> {
  if (!TRACKING || !identity) return null;
  await ensureUser(identity);
  // Admin toggles: `blocked` denies generation entirely; `unlimited` skips metering.
  const dbUser = await getUserById(identity.id);
  if (dbUser?.blocked) {
    reply.code(403).send({ error: "account is blocked", code: "blocked" });
    return { blocked: true };
  }
  const account = await getAccount(identity.id);
  if (dbUser?.unlimited) {
    // Return the real balance so the UI can still show it, but mark unlimited
    // so settleGeneration skips charging.
    return { balance: account.balance, monthlyAllowance: account.monthlyAllowance, unlimited: true };
  }
  if (account.balance < pages) {
    reply.code(402).send({
      error: `Not enough credits: this deck needs ${pages}, you have ${account.balance}.`,
      code: "insufficient_credits",
      balance: account.balance,
      needed: pages,
      monthlyAllowance: account.monthlyAllowance,
    });
    return { blocked: true };
  }
  return { balance: account.balance, monthlyAllowance: account.monthlyAllowance };
}

/** Charge for the slides actually produced and persist the material. Returns credit state. */
async function settleGeneration(
  identity: UserIdentity,
  deckId: string,
  scene: PPTScene,
  meta: { title: string; theme?: string; lang?: string; premium: boolean; cover?: string; yaml?: string },
  preBalance: number,
  monthlyAllowance: number,
  unlimited: boolean
): Promise<CreditState> {
  const slides = scene.slides.length;
  // Unlimited users bypass metering entirely — no ledger entry, no debit.
  if (unlimited) {
    await saveMaterial({
      id: deckId, userId: identity.id, title: meta.title, pages: slides,
      theme: meta.theme, lang: meta.lang, premium: meta.premium,
      cover: meta.cover, yaml: meta.yaml, scene,
    });
    return { balance: preBalance, charged: 0, monthlyAllowance, unlimited: true };
  }
  // Never throw post-generation: charge at most what's available (we pre-checked
  // balance >= requested pages, so this only clamps rare over-runs).
  const toCharge = Math.min(slides, preBalance);
  const balance = await charge(identity.id, toCharge, "generate", deckId);
  await saveMaterial({
    id: deckId,
    userId: identity.id,
    title: meta.title,
    pages: slides,
    theme: meta.theme,
    lang: meta.lang,
    premium: meta.premium,
    cover: meta.cover,
    yaml: meta.yaml,
    scene,
  });
  return { balance, charged: toCharge, monthlyAllowance };
}

app.post("/generate", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  const b = (req.body ?? {}) as GenBody;
  if (!b.topic) return reply.code(400).send({ error: "topic required" });

  const requestedPages = clampPages(b.pages);
  const pre = await preflightCredits(auth.identity, requestedPages, reply);
  if (pre && "blocked" in pre) return; // 402 already sent

  try {
    const { scene, yaml, content, sources, warnings } = await runWithUsageContext(
      { userId: auth.identity?.id },
      () => generateDeck(prefs(b), { onProgress: (m) => req.log.info(m) }),
    );
    const pptx = await buildPptxBuffer(scene, { title: content.deckTitle });
    const previews = renderSlideSvgs(scene);
    const file = maybeWriteOut(b, content.deckTitle, pptx, yaml);
    const deckId = newDeckId();
    cacheDeck(deckId, { scene, title: content.deckTitle, userId: auth.identity?.id });

    let credits: CreditState | undefined;
    if (pre && "balance" in pre && auth.identity) {
      credits = await settleGeneration(
        auth.identity,
        deckId,
        scene,
        { title: content.deckTitle, theme: b.theme, lang: b.lang, premium: !!b.premium, cover: previews[0], yaml },
        pre.balance,
        pre.monthlyAllowance,
        !!pre.unlimited
      );
    }

    return {
      deckId,
      title: content.deckTitle,
      slides: scene.slides.length,
      premium: !!b.premium,
      sources,
      warnings: warnings.all().length,
      file,
      credits,
      pptxBase64: pptx.toString("base64"),
      previews,
      yaml,
    };
  } catch (e) {
    req.log.error(e);
    return reply.code(502).send({ error: e instanceof Error ? e.message : String(e) });
  }
});

// Streaming variant: emits `progress` events as the orchestrator works, then a
// final `done` event with the full result (or `error`). Consumed by the web app
// to drive a real progress UI.
app.post("/generate/stream", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  const b = (req.body ?? {}) as GenBody;
  if (!b.topic) return reply.code(400).send({ error: "topic required" });

  // Credit pre-check happens before we hijack the reply, so a 402 is a clean JSON
  // response the client already handles.
  const requestedPages = clampPages(b.pages);
  const pre = await preflightCredits(auth.identity, requestedPages, reply);
  if (pre && "blocked" in pre) return;

  reply.hijack();
  const raw = reply.raw;
  raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": (req.headers.origin as string) ?? "*",
    "X-Accel-Buffering": "no",
  });
  const send = (event: string, data: unknown) => {
    if (!raw.writableEnded) raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  send("progress", { message: "Starting…" });

  try {
    const { scene, yaml, content, sources, warnings } = await runWithUsageContext(
      { userId: auth.identity?.id },
      () => generateDeck(prefs(b), {
        onProgress: (m) => { req.log.info(m); send("progress", { message: m }); },
      }),
    );
    const pptx = await buildPptxBuffer(scene, { title: content.deckTitle });
    const previews = renderSlideSvgs(scene);
    maybeWriteOut(b, content.deckTitle, pptx, yaml);
    const deckId = newDeckId();
    cacheDeck(deckId, { scene, title: content.deckTitle, userId: auth.identity?.id });

    let credits: CreditState | undefined;
    if (pre && "balance" in pre && auth.identity) {
      credits = await settleGeneration(
        auth.identity,
        deckId,
        scene,
        { title: content.deckTitle, theme: b.theme, lang: b.lang, premium: !!b.premium, cover: previews[0], yaml },
        pre.balance,
        pre.monthlyAllowance,
        !!pre.unlimited
      );
    }

    send("done", {
      deckId,
      title: content.deckTitle,
      slides: scene.slides.length,
      premium: !!b.premium,
      sources,
      warnings: warnings.all().length,
      credits,
      pptxBase64: pptx.toString("base64"),
      previews,
    });
  } catch (e) {
    req.log.error(e);
    send("error", { error: e instanceof Error ? e.message : String(e) });
  } finally {
    raw.end();
  }
});

// Enforce that the caller owns the deck (service-token calls bypass). Sends the
// appropriate error and returns null when access is denied or the deck is gone.
async function loadOwnedDeck(
  id: string,
  auth: AuthContext,
  reply: FastifyReply
): Promise<StoredDeck | null> {
  const d = await loadDeck(id);
  if (!d) {
    reply.code(404).send({ error: "deck not found (it may have expired — regenerate)" });
    return null;
  }
  if (!auth.service && d.userId && auth.identity && d.userId !== auth.identity.id) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return d;
}

// Editor data: text-less slide backgrounds + the editable text boxes to overlay.
app.get("/deck/:id/editor", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  const { id } = req.params as { id: string };
  const d = await loadOwnedDeck(id, auth, reply);
  if (!d) return;
  return {
    title: d.title,
    size: d.scene.size,
    backgrounds: renderSlideSvgs(d.scene, { omitText: true }),
    slides: extractEditables(d.scene),
  };
});

// Apply text edits and recompile the real .pptx (+ refreshed previews).
app.post("/deck/:id/build", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  const { id } = req.params as { id: string };
  const d = await loadOwnedDeck(id, auth, reply);
  if (!d) return;
  const body = (req.body ?? {}) as { edits?: Record<string, string> };
  try {
    if (body.edits) applyTextEdits(d.scene, body.edits); // persist edits onto the stored scene
    const pptx = await buildPptxBuffer(d.scene, { title: d.title });
    const previews = renderSlideSvgs(d.scene);
    if (TRACKING && d.userId) await updateMaterialScene(id, d.scene, d.title);
    return { title: d.title, slides: d.scene.slides.length, pptxBase64: pptx.toString("base64"), previews };
  } catch (e) {
    req.log.error(e);
    return reply.code(502).send({ error: e instanceof Error ? e.message : String(e) });
  }
});

// Rewrite a text snippet for the magic editor (AI assist). Auth required; no deck mutation.
app.post("/rewrite", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  const body = (req.body ?? {}) as { text?: string; instruction?: string };
  const text = (body.text || "").trim();
  const instruction = (body.instruction || "").trim();
  if (!text) return reply.code(400).send({ error: "text required" });
  if (!instruction) return reply.code(400).send({ error: "instruction required" });
  try {
    const out = await chat({
      system:
        "You rewrite PowerPoint slide text. Return ONLY the rewritten text — no quotes, no markdown, no preamble. Keep a similar length unless asked otherwise. Preserve bullet structure when the input uses line breaks.",
      user: `Instruction: ${instruction}\n\nOriginal text:\n${text}`,
      temperature: 0.4,
      maxTokens: 600,
      timeoutMs: 45_000,
    });
    return { text: out.trim() };
  } catch (e) {
    req.log.error(e);
    return reply.code(502).send({ error: e instanceof Error ? e.message : String(e) });
  }
});

// Export the deck as a PDF. Applies any pending text edits (like /build), then
// renders the real .pptx and converts it with LibreOffice. Returns base64 PDF.
// 501 when LibreOffice isn't installed, so the client can fall back to .pptx.
app.post("/deck/:id/pdf", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  if (!hasLibreOffice()) {
    return reply.code(501).send({
      error: "PDF export is unavailable on this server (LibreOffice not installed).",
      code: "pdf_unavailable",
    });
  }
  const { id } = req.params as { id: string };
  const d = await loadOwnedDeck(id, auth, reply);
  if (!d) return;
  const body = (req.body ?? {}) as { edits?: Record<string, string> };
  const work = mkdtempSync(join(tmpdir(), "sw-pdf-"));
  try {
    if (body.edits) applyTextEdits(d.scene, body.edits); // keep parity with /build
    const pptx = await buildPptxBuffer(d.scene, { title: d.title });
    if (TRACKING && d.userId && body.edits) await updateMaterialScene(id, d.scene, d.title);
    const pptxPath = join(work, "deck.pptx");
    writeFileSync(pptxPath, pptx);
    const pdfPath = await convertToPdf(pptxPath, work);
    const pdf = readFileSync(pdfPath);
    return { title: d.title, slides: d.scene.slides.length, pdfBase64: pdf.toString("base64") };
  } catch (e) {
    req.log.error(e);
    return reply.code(502).send({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

// ── account / credits / materials ───────────────────────────────────────────

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Guard shared by the auth routes: real accounts need both a JWT secret (to sign
// tokens) and a database (to store them).
function authPreconditions(reply: FastifyReply): boolean {
  if (!JWT_ENABLED) {
    reply.code(501).send({ error: "auth is not configured (set JWT_SECRET)", code: "auth_unconfigured" });
    return false;
  }
  if (!TRACKING) {
    reply.code(503).send({ error: "auth requires a database (set DATABASE_URL)", code: "no_database" });
    return false;
  }
  return true;
}

// Generate a fresh 6-digit code and email it to the user, storing its hash.
async function issueVerificationCode(userId: string, email: string): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await upsertVerificationCode(userId, await hashPassword(code));
  await sendVerificationCode(email, code);
}

// Register a new password account. The account starts unverified: we email a
// 6-digit code and issue NO token until the user confirms it via /auth/verify.
// This proves the mailbox is real and owned by the registrant.
app.post("/auth/register", async (req, reply) => {
  if (!authPreconditions(reply)) return;
  const b = (req.body ?? {}) as { email?: string; password?: string; name?: string };
  const email = (b.email ?? "").trim().toLowerCase();
  const password = b.password ?? "";
  if (!EMAIL_RE.test(email)) {
    return reply.code(400).send({ error: "a valid email is required", code: "invalid_email" });
  }
  if (password.length < 8) {
    return reply.code(400).send({ error: "password must be at least 8 characters", code: "weak_password" });
  }
  const existing = await getUserByEmail(email);
  if (existing) {
    // A verified account blocks re-registration; an abandoned unverified one is
    // resumed by re-sending a code (login still uses the original password).
    if (existing.emailVerified) {
      return reply.code(409).send({ error: "an account with this email already exists", code: "email_taken" });
    }
    await issueVerificationCode(existing.id, email);
    return { status: "verification_sent", email, delivery: mailEnabled() ? "email" : "dev-log" };
  }
  const name = (b.name ?? "").trim() || email.split("@")[0];
  const user = await createUser({ email, name, passwordHash: await hashPassword(password) });
  await issueVerificationCode(user.id, email);
  return { status: "verification_sent", email, delivery: mailEnabled() ? "email" : "dev-log" };
});

// Confirm a registration code → activates the account and returns { token, user }.
app.post("/auth/verify", async (req, reply) => {
  if (!authPreconditions(reply)) return;
  const b = (req.body ?? {}) as { email?: string; code?: string };
  const email = (b.email ?? "").trim().toLowerCase();
  const code = (b.code ?? "").trim();
  const user = await getUserByEmail(email);
  if (!user) {
    return reply.code(400).send({ error: "no pending registration for this email", code: "no_pending" });
  }
  if (user.emailVerified) {
    return reply.code(409).send({ error: "email is already verified", code: "already_verified" });
  }
  const pending = await getVerification(user.id);
  if (!pending || pending.expired) {
    return reply.code(400).send({ error: "the code has expired — request a new one", code: "code_expired" });
  }
  if (pending.attempts >= MAX_VERIFY_ATTEMPTS) {
    await clearVerification(user.id);
    return reply.code(429).send({ error: "too many attempts — request a new code", code: "too_many_attempts" });
  }
  const ok = await verifyPassword(code, pending.codeHash);
  if (!ok) {
    const attempts = await bumpAttempts(user.id);
    const remaining = Math.max(0, MAX_VERIFY_ATTEMPTS - attempts);
    return reply.code(400).send({ error: "incorrect code", code: "code_incorrect", attemptsRemaining: remaining });
  }
  await setEmailVerified(user.id);
  await clearVerification(user.id);
  const verified = { ...user, emailVerified: true };
  return { token: issueToken(verified), user: publicUser(verified) };
});

// Resend a verification code to an unverified account. Always returns a generic
// success so it can't be used to probe which emails are registered.
app.post("/auth/resend", async (req, reply) => {
  if (!authPreconditions(reply)) return;
  const b = (req.body ?? {}) as { email?: string };
  const email = (b.email ?? "").trim().toLowerCase();
  const user = EMAIL_RE.test(email) ? await getUserByEmail(email) : null;
  if (user && !user.emailVerified) {
    await issueVerificationCode(user.id, email);
  }
  return { status: "verification_sent", email };
});

// Log in with email + password → returns { token, user }. Unverified accounts
// are refused until they confirm their email (a fresh code is sent).
app.post("/auth/login", async (req, reply) => {
  if (!authPreconditions(reply)) return;
  const b = (req.body ?? {}) as { email?: string; password?: string };
  const email = (b.email ?? "").trim().toLowerCase();
  const user = await getUserByEmail(email);
  if (!user) {
    return reply.code(401).send({ error: "invalid email or password", code: "invalid_credentials" });
  }
  if (!user.passwordHash) {
    return reply.code(400).send({
      error: "this account uses Google sign-in — continue with Google",
      code: "google_only",
    });
  }
  const ok = await verifyPassword(b.password ?? "", user.passwordHash);
  if (!ok) {
    return reply.code(401).send({ error: "invalid email or password", code: "invalid_credentials" });
  }
  if (!user.emailVerified) {
    await issueVerificationCode(user.id, email);
    return reply.code(403).send({
      error: "please verify your email — we sent you a new code",
      code: "email_unverified",
      email,
    });
  }
  return { token: issueToken(user), user: publicUser(user) };
});

// Google Sign-In: browser sends the GIS ID token; we verify it, upsert the user
// (email already verified by Google), and return a slidewind JWT session.
app.post("/auth/google", async (req, reply) => {
  if (!authPreconditions(reply)) return;
  if (!googleAuthConfigured()) {
    return reply.code(501).send({ error: "Google sign-in is not configured (set GOOGLE_CLIENT_ID)", code: "google_unconfigured" });
  }
  const b = (req.body ?? {}) as { idToken?: string; credential?: string };
  const idToken = (b.idToken || b.credential || "").trim();
  try {
    const profile = await verifyGoogleIdToken(idToken);
    const user = await upsertGoogleUser({ email: profile.email, name: profile.name });
    return { token: issueToken(user), user: publicUser(user) };
  } catch (e) {
    const err = e as Error & { code?: string; status?: number };
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 401;
    return reply.code(status).send({ error: err.message || "Google sign-in failed", code: err.code || "google_failed" });
  }
});

app.get("/auth/providers", async () => ({
  google: googleAuthConfigured(),
}));

app.get("/me", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  if (!TRACKING || !auth.identity) {
    return { tracking: false, user: auth.identity, credits: null };
  }
  const user = await ensureUser(auth.identity);
  const account = await getAccount(auth.identity.id);
  return {
    tracking: true,
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role, unlimited: user.unlimited, blocked: user.blocked },
    credits: { balance: account.balance, monthlyAllowance: account.monthlyAllowance, period: account.period, unlimited: user.unlimited },
  };
});

app.get("/me/materials", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  if (!TRACKING || !auth.identity) return { materials: [] };
  await ensureUser(auth.identity);
  const materials = await listMaterials(auth.identity.id);
  return { materials };
});

app.get("/me/credits/ledger", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  if (!TRACKING || !auth.identity) return { entries: [] };
  await ensureUser(auth.identity);
  const entries = await ledger(auth.identity.id);
  return { entries };
});

// Start a Click.uz checkout for a paid pack (pro / team). Returns a payUrl to
// redirect the browser to https://my.click.uz/services/pay?...
app.post("/credits/checkout", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  if (!TRACKING) {
    return reply.code(409).send({ ok: false, status: "unavailable", message: "Payments require DATABASE_URL." });
  }
  if (!clickConfigured()) {
    return reply.code(503).send({
      ok: false,
      status: "not_configured",
      message: "Click.uz is not configured (set CLICK_MERCHANT_ID, CLICK_SERVICE_ID, CLICK_SECRET_KEY).",
    });
  }
  const cfg = getClickConfig()!;
  const body = (req.body ?? {}) as { credits?: number; pack?: string; slug?: string; billing?: string };
  const wanted = String(body.slug ?? body.pack ?? "").toLowerCase().replace(/\s+/g, "");
  const yearly = String(body.billing ?? "").toLowerCase() === "yearly";
  // Prefer DB-configured plans (admin-editable). Fall back to the built-in CLICK_PLANS
  // catalog for backward compatibility when the plans table is empty.
  let offer: { id: string; amountUzs: number; credits: number; plan: string; monthlyAllowance: number } | null = null;
  const dbPlan = wanted ? await getPlanBySlug(wanted) : null;
  if (dbPlan && dbPlan.isActive) {
    if (yearly && dbPlan.kind === "subscription") {
      // Yearly billing: 12 months at a discount, grant 12x credits upfront.
      const discount = Math.max(0, Math.min(100, dbPlan.yearlyDiscountPct)) / 100;
      const yearlyPrice = Math.round(dbPlan.priceUzs * 12 * (1 - discount));
      offer = {
        id: `${dbPlan.slug}-yearly`,
        amountUzs: yearlyPrice,
        credits: dbPlan.credits * 12,
        plan: dbPlan.slug,
        monthlyAllowance: dbPlan.monthlyAllowance ?? dbPlan.credits,
      };
    } else {
      offer = {
        id: dbPlan.slug,
        amountUzs: dbPlan.priceUzs,
        credits: dbPlan.credits,
        plan: dbPlan.kind === "subscription" ? dbPlan.slug : "token",
        monthlyAllowance: dbPlan.monthlyAllowance ?? dbPlan.credits,
      };
    }
  } else {
    const fallback =
      CLICK_PLANS[wanted] ||
      Object.values(CLICK_PLANS).find((p) => p.credits === body.credits) ||
      null;
    if (fallback) {
      offer = {
        id: fallback.id,
        amountUzs: fallback.amountUzs,
        credits: fallback.credits,
        plan: fallback.plan,
        monthlyAllowance: fallback.monthlyAllowance,
      };
    }
  }
  if (!offer || offer.amountUzs <= 0) {
    return reply.code(400).send({
      ok: false,
      status: "invalid_pack",
      message: "Unknown or free pack.",
    });
  }
  if (!auth.identity?.id) {
    return reply.code(401).send({ ok: false, status: "auth_required", message: "Sign in to purchase a plan." });
  }
  await ensureUser(auth.identity);
  const merchantTransId = `sw_${randomUUID().replace(/-/g, "")}`;
  await createPayment({
    merchantTransId,
    userId: auth.identity.id,
    pack: offer.id,
    amountUzs: offer.amountUzs,
    credits: offer.credits,
    plan: offer.plan,
    monthlyAllowance: offer.monthlyAllowance,
  });
  const payUrl = buildClickPayUrl(cfg, {
    amountUzs: offer.amountUzs,
    merchantTransId,
    returnUrl: `${cfg.webUrl}/profile/subscribed?paid=1`,
  });
  return {
    ok: true,
    status: "redirect",
    payUrl,
    pack: offer.id,
    amountUzs: offer.amountUzs,
    merchantTransId,
  };
});

// Public: active plans (subscription tiers + token packs) for the pricing UI.
app.get("/plans", async (_req, reply) => {
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  return { plans: await listActivePlans() };
});

/**
 * Click Shop API — single Prepare + Complete endpoint.
 * In the Click merchant cabinet set both URLs to:
 *   {PUBLIC_API_URL}/payments/click
 * (e.g. https://make-ppt.com/api/payments/click)
 *
 * action=0 prepare → return merchant_prepare_id
 * action=1 complete → grant credits + set plan (idempotent)
 */
app.post("/payments/click", async (req, reply) => {
  const cfg = getClickConfig();
  if (!cfg || !TRACKING) {
    return reply.code(503).send({ error: -8, error_note: "Click not configured" });
  }

  const p = normalizeClickBody(req.body);
  const action = String(p.action ?? "");
  const clickTransId = p.click_trans_id ?? "";
  const serviceId = p.service_id ?? "";
  const merchantTransId = p.merchant_trans_id ?? "";
  const amount = p.amount ?? "";
  const signTime = p.sign_time ?? "";
  const signString = p.sign_string ?? "";
  const merchantPrepareId = p.merchant_prepare_id;
  const clickPaydocId = p.click_paydoc_id;
  const clickError = Number(p.error ?? 0);

  const okSign = verifyClickSign({
    click_trans_id: clickTransId,
    service_id: serviceId,
    merchant_trans_id: merchantTransId,
    amount,
    action,
    sign_time: signTime,
    sign_string: signString,
    merchant_prepare_id: merchantPrepareId,
    secretKey: cfg.secretKey,
  });
  if (!okSign) {
    req.log.warn({ merchantTransId, action }, "click sign check failed");
    return { error: -1, error_note: "SIGN CHECK FAILED" };
  }
  if (serviceId !== cfg.serviceId) {
    return { error: -8, error_note: "Incorrect service_id" };
  }

  const payment = await getPaymentByMerchantTransId(merchantTransId);
  if (!payment) {
    return { error: -6, error_note: "Transaction does not exist" };
  }

  // Amount may arrive as "229000.00" — compare numerically.
  if (Math.abs(Number(amount) - payment.amountUzs) > 0.01) {
    return { error: -2, error_note: "Incorrect parameter amount" };
  }

  if (action === "0") {
    if (payment.status === "paid") {
      return {
        click_trans_id: Number(clickTransId) || clickTransId,
        merchant_trans_id: merchantTransId,
        merchant_prepare_id: payment.id,
        error: -4,
        error_note: "Already paid",
      };
    }
    await markPaymentPrepared(merchantTransId, clickTransId, clickPaydocId);
    return {
      click_trans_id: Number(clickTransId) || clickTransId,
      merchant_trans_id: merchantTransId,
      merchant_prepare_id: payment.id,
      error: 0,
      error_note: "Success",
    };
  }

  if (action === "1") {
    // Click cancelled / failed the payment on their side.
    if (clickError < 0) {
      await markPaymentFailed(merchantTransId, clickError);
      return {
        click_trans_id: Number(clickTransId) || clickTransId,
        merchant_trans_id: merchantTransId,
        merchant_confirm_id: payment.id,
        error: clickError,
        error_note: p.error_note || "Payment cancelled",
      };
    }
    if (merchantPrepareId && String(merchantPrepareId) !== String(payment.id)) {
      return { error: -8, error_note: "Incorrect merchant_prepare_id" };
    }
    if (payment.status === "paid") {
      return {
        click_trans_id: Number(clickTransId) || clickTransId,
        merchant_trans_id: merchantTransId,
        merchant_confirm_id: payment.id,
        error: -4,
        error_note: "Already paid",
      };
    }
    const updated = await markPaymentPaid(merchantTransId, clickTransId, clickPaydocId);
    if (!updated) {
      // Race: another complete already marked paid.
      return {
        click_trans_id: Number(clickTransId) || clickTransId,
        merchant_trans_id: merchantTransId,
        merchant_confirm_id: payment.id,
        error: -4,
        error_note: "Already paid",
      };
    }
    try {
      // Always grant the credits. For subscription plans (plan != 'token') we also
      // update the user's monthly allowance and plan label; token packs are pure
      // one-off top-ups and don't touch the recurring plan.
      await grant(payment.userId, payment.credits, `click:${payment.pack}`);
      if (payment.plan && payment.plan !== "token") {
        await setMonthlyAllowance(payment.userId, payment.monthlyAllowance);
        await setUserPlan(payment.userId, payment.plan);
      }
    } catch (err) {
      req.log.error({ err, merchantTransId }, "click complete fulfillment failed");
      await revertPaymentToPrepared(merchantTransId);
      return { error: -7, error_note: "Failed to update user" };
    }
    return {
      click_trans_id: Number(clickTransId) || clickTransId,
      merchant_trans_id: merchantTransId,
      merchant_confirm_id: payment.id,
      error: 0,
      error_note: "Success",
    };
  }

  return { error: -3, error_note: "Action not found" };
});

// Admin: list all users with their credit balance (for the admin panel).
app.get("/admin/users", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled (no DATABASE_URL)" });
  return { users: await listUsers() };
});

// ── admin panel API ─────────────────────────────────────────────────────────

// Admin: list every plan (active + inactive).
app.get("/admin/plans", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  return { plans: await listAllPlans() };
});

// Admin: create a new plan.
app.post("/admin/plans", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const b = (req.body ?? {}) as {
    slug?: string; name?: string; kind?: PlanKind; priceUzs?: number; credits?: number;
    monthlyAllowance?: number | null; blurb?: string | null; features?: string[];
    isActive?: boolean; isPopular?: boolean; sortOrder?: number; yearlyDiscountPct?: number;
  };
  const slug = String(b.slug ?? "").trim().toLowerCase();
  const name = String(b.name ?? "").trim();
  if (!slug || !name) return reply.code(400).send({ error: "slug and name are required" });
  const kind: PlanKind = b.kind === "token" ? "token" : "subscription";
  try {
    const plan = await createPlan({
      slug, name, kind,
      priceUzs: Math.max(0, Number(b.priceUzs ?? 0)),
      credits: Math.max(0, Math.floor(Number(b.credits ?? 0))),
      monthlyAllowance: kind === "subscription" ? Math.max(0, Math.floor(Number(b.monthlyAllowance ?? b.credits ?? 0))) : null,
      blurb: b.blurb ?? null,
      features: Array.isArray(b.features) ? b.features.map((f) => String(f)).slice(0, 20) : [],
      isActive: b.isActive !== false,
      isPopular: !!b.isPopular,
      sortOrder: Math.max(0, Math.floor(Number(b.sortOrder ?? 0))),
      yearlyDiscountPct: Math.max(0, Math.min(100, Math.floor(Number(b.yearlyDiscountPct ?? 0)))),
    });
    return { plan };
  } catch (e) {
    req.log.error(e);
    return reply.code(400).send({ error: e instanceof Error ? e.message : "create failed" });
  }
});

// Admin: update an existing plan.
app.patch("/admin/plans/:id", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const id = Number((req.params as { id?: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: Parameters<typeof updatePlan>[1] = {};
  if (typeof b.slug === "string") patch.slug = b.slug.trim().toLowerCase();
  if (typeof b.name === "string") patch.name = b.name.trim();
  if (b.kind === "token" || b.kind === "subscription") patch.kind = b.kind;
  if (typeof b.priceUzs === "number") patch.priceUzs = Math.max(0, b.priceUzs);
  if (typeof b.credits === "number") patch.credits = Math.max(0, Math.floor(b.credits));
  if (b.monthlyAllowance === null || typeof b.monthlyAllowance === "number") {
    patch.monthlyAllowance = b.monthlyAllowance === null ? null : Math.max(0, Math.floor(b.monthlyAllowance as number));
  }
  if (typeof b.blurb === "string" || b.blurb === null) patch.blurb = b.blurb as string | null;
  if (Array.isArray(b.features)) patch.features = b.features.map((f) => String(f)).slice(0, 20);
  if (typeof b.isActive === "boolean") patch.isActive = b.isActive;
  if (typeof b.isPopular === "boolean") patch.isPopular = b.isPopular;
  if (typeof b.sortOrder === "number") patch.sortOrder = Math.max(0, Math.floor(b.sortOrder));
  if (typeof b.yearlyDiscountPct === "number") {
    patch.yearlyDiscountPct = Math.max(0, Math.min(100, Math.floor(b.yearlyDiscountPct)));
  }
  const plan = await updatePlan(id, patch);
  if (!plan) return reply.code(404).send({ error: "not found" });
  return { plan };
});

// Admin: delete a plan (hard delete — active/inactive toggle exists for soft).
app.delete("/admin/plans/:id", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const id = Number((req.params as { id?: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
  await deletePlan(id);
  return { ok: true };
});


// Public: submit a support message (auth optional — anonymous users can too).
app.post("/support/messages", async (req, reply) => {
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled (no DATABASE_URL)" });
  const auth = await authenticate(req, reply);
  if (!auth) return;
  const body = (req.body ?? {}) as { name?: string; email?: string; body?: string; message?: string };
  const text = (body.body ?? body.message ?? "").trim();
  if (!text) return reply.code(400).send({ error: "body is required" });
  const msg = await createSupportMessage({
    userId: auth.identity?.id ?? null,
    name: body.name ?? auth.identity?.name ?? null,
    email: body.email ?? auth.identity?.email ?? null,
    body: text.slice(0, 4000),
  });
  return { message: msg };
});

// Dashboard aggregates.
app.get("/admin/stats", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  return { stats: await getDashboardStats() };
});

// Payments timeseries.
app.get("/admin/stats/payments", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const q = (req.query ?? {}) as { period?: string };
  const p = (q.period ?? "month").toLowerCase() as Period;
  if (!["day", "week", "month", "quarter", "year"].includes(p)) {
    return reply.code(400).send({ error: "period must be day|week|month|quarter|year" });
  }
  return { period: p, points: await paymentsTimeseries(p) };
});

// External API usage: totals + per-provider + per-model rollup over the window.
app.get("/admin/api-usage/summary", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const q = (req.query ?? {}) as { period?: string };
  const p = (q.period ?? "month").toLowerCase() as Period;
  if (!["day", "week", "month", "quarter", "year"].includes(p)) {
    return reply.code(400).send({ error: "period must be day|week|month|quarter|year" });
  }
  return { period: p, ...(await usageSummary(p)) };
});

// External API usage timeseries by provider (calls / tokens / cost per bucket).
app.get("/admin/api-usage/timeseries", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const q = (req.query ?? {}) as { period?: string };
  const p = (q.period ?? "month").toLowerCase() as Period;
  if (!["day", "week", "month", "quarter", "year"].includes(p)) {
    return reply.code(400).send({ error: "period must be day|week|month|quarter|year" });
  }
  return { period: p, points: await usageTimeseries(p) };
});

// Top users by API cost in the window.
app.get("/admin/api-usage/top-users", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const q = (req.query ?? {}) as { period?: string; limit?: string };
  const p = (q.period ?? "month").toLowerCase() as Period;
  if (!["day", "week", "month", "quarter", "year"].includes(p)) {
    return reply.code(400).send({ error: "period must be day|week|month|quarter|year" });
  }
  const limit = q.limit ? Math.max(1, Math.min(100, Number(q.limit))) : 10;
  return { period: p, users: await topApiUsers(p, limit) };
});

// List all payments (optionally filter by status).
app.get("/admin/payments", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const q = (req.query ?? {}) as { status?: string; limit?: string };
  const limit = q.limit ? Math.max(1, Math.min(1000, Number(q.limit))) : 200;
  return { payments: await listPayments({ status: q.status, limit }) };
});

// List subscriptions (a subscription = the most recent paid payment per user).
app.get("/admin/subscriptions", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const paid = await listPayments({ status: "paid", limit: 1000 });
  const byUser = new Map<string, typeof paid[number]>();
  for (const p of paid) if (!byUser.has(p.userId)) byUser.set(p.userId, p);
  return { subscriptions: [...byUser.values()] };
});

// Support messages (list all).
app.get("/admin/support/messages", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  return { messages: await listSupportMessages() };
});

// Reply to a support message.
app.post("/admin/support/messages/:id/reply", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const id = Number((req.params as { id?: string }).id);
  if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
  const body = (req.body ?? {}) as { reply?: string };
  const text = (body.reply ?? "").trim();
  if (!text) return reply.code(400).send({ error: "reply is required" });
  const msg = await replySupportMessage(id, text.slice(0, 4000), auth.identity?.id ?? "admin");
  if (!msg) return reply.code(404).send({ error: "message not found" });
  return { message: msg };
});

// Block a user (they cannot generate).
app.post("/admin/users/:id/block", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const id = (req.params as { id?: string }).id;
  if (!id) return reply.code(400).send({ error: "id required" });
  await setUserBlocked(id, true);
  return { userId: id, blocked: true };
});

// Unblock a user.
app.post("/admin/users/:id/unblock", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const id = (req.params as { id?: string }).id;
  if (!id) return reply.code(400).send({ error: "id required" });
  await setUserBlocked(id, false);
  return { userId: id, blocked: false };
});

// Change plan for a user.
app.post("/admin/users/:id/plan", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const id = (req.params as { id?: string }).id;
  const body = (req.body ?? {}) as { plan?: string; monthlyAllowance?: number };
  if (!id || !body.plan) return reply.code(400).send({ error: "id and plan required" });
  await setUserPlan(id, body.plan);
  if (typeof body.monthlyAllowance === "number" && body.monthlyAllowance >= 0) {
    await setMonthlyAllowance(id, Math.floor(body.monthlyAllowance));
  }
  return { userId: id, plan: body.plan };
});

// Grant/revoke unlimited access.
app.post("/admin/users/:id/unlimited", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const id = (req.params as { id?: string }).id;
  const body = (req.body ?? {}) as { unlimited?: boolean };
  if (!id) return reply.code(400).send({ error: "id required" });
  const on = body.unlimited === true;
  await setUserUnlimited(id, on);
  return { userId: id, unlimited: on };
});

// Fetch a single user by id.
app.get("/admin/users/:id", async (req, reply) => {
  const auth = await authenticate(req, reply); if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled" });
  const id = (req.params as { id?: string }).id;
  if (!id) return reply.code(400).send({ error: "id required" });
  const u = await getUserById(id);
  if (!u) return reply.code(404).send({ error: "not found" });
  return { user: u };
});

// Admin top-up. Guarded by an admin JWT (role=admin) or the shared x-admin-key.
// Body: { userId, amount, reason? }.
app.post("/admin/credits/grant", async (req, reply) => {
  const auth = await authenticate(req, reply);
  if (!auth) return;
  if (!requireAdmin(req, reply, auth)) return;
  if (!TRACKING) return reply.code(409).send({ error: "tracking disabled (no DATABASE_URL)" });
  const body = (req.body ?? {}) as { userId?: string; amount?: number; reason?: string };
  if (!body.userId || !body.amount || body.amount <= 0) {
    return reply.code(400).send({ error: "userId and a positive amount are required" });
  }
  try {
    await ensureUser({ id: body.userId });
    const balance = await grant(body.userId, body.amount, body.reason ?? "admin_grant");
    return { userId: body.userId, granted: body.amount, balance };
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) });
  }
});

// Surface insufficient-credit errors raised deeper in the stack as 402s.
app.setErrorHandler((err, _req, reply) => {
  if (err instanceof InsufficientCreditsError) {
    return reply.code(402).send({
      error: err.message,
      code: "insufficient_credits",
      balance: err.balance,
      needed: err.needed,
    });
  }
  reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
});

/**
 * Ensure the seed admin account exists (and is an admin) on boot. Reads
 * ADMIN_EMAIL / ADMIN_PASSWORD. No-op without a DB, JWT, or those env vars.
 */
async function seedAdmin(): Promise<void> {
  if (!TRACKING || !JWT_ENABLED || !ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  try {
    const existing = await getUserByEmail(ADMIN_EMAIL);
    if (existing) {
      if (existing.role !== "admin") await setRole(existing.id, "admin");
      return;
    }
    await createUser({ email: ADMIN_EMAIL, name: "Admin", passwordHash: await hashPassword(ADMIN_PASSWORD), role: "admin", emailVerified: true });
    app.log.info(`seeded admin account: ${ADMIN_EMAIL}`);
  } catch (e) {
    app.log.error({ err: e }, "failed to seed admin account");
  }
}

await seedAdmin();

app
  .listen({ port: PORT, host: process.env.SLIDEWIND_HOST ?? "0.0.0.0" })
  .then(() => app.log.info(`slidewind generation service on :${PORT}`))
  .catch((e) => {
    app.log.error(e);
    process.exit(1);
  });
