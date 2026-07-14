/**
 * Outbound email over SMTP (nodemailer). Configure with:
 *
 *   SMTP_HOST   mail server hostname (e.g. mail.make-ppt.com; defaults to smtp.gmail.com)
 *   SMTP_PORT   465 (implicit TLS, recommended) or 587 (STARTTLS)
 *   SMTP_USER   the mailbox to authenticate as (e.g. info@make-ppt.com)
 *   SMTP_PASS   the mailbox password (or app password for Gmail)
 *   SMTP_FROM   optional display From (defaults to SMTP_USER)
 *
 * When SMTP_USER/SMTP_PASS are unset the mailer runs in dev mode: it logs the
 * message (including any verification code) instead of sending, so local flows
 * work without credentials. Check mailEnabled() before promising delivery.
 *
 * Env is read *lazily* on each call — this matters because loadEnv() runs after
 * this module is imported by the server, so any top-level snapshot would miss
 * the .env values.
 */

import nodemailer, { type Transporter } from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function readConfig(): SmtpConfig {
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    user,
    pass,
    from: process.env.SMTP_FROM || user,
  };
}

let transporter: Transporter | null = null;
let transporterKey = "";

/** True when real SMTP credentials are configured (otherwise mail is logged only). */
export function mailEnabled(): boolean {
  const c = readConfig();
  return !!(c.user && c.pass);
}

function getTransport(): Transporter {
  const c = readConfig();
  // Rebuild the transport if any relevant setting has changed (e.g. .env was
  // reloaded, or a test swapped a value).
  const key = `${c.host}|${c.port}|${c.user}`;
  if (!transporter || key !== transporterKey) {
    transporter = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: c.user, pass: c.pass },
    });
    transporterKey = key;
  }
  return transporter;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send an email. In dev mode (no SMTP creds) this logs the message and resolves
 * without sending — the caller still succeeds so local testing works. Throws
 * only when sending is configured but the transport rejects.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const c = readConfig();
  if (!c.user || !c.pass) {
    // eslint-disable-next-line no-console
    console.log(`[mailer:dev] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return;
  }
  try {
    await getTransport().sendMail({
      from: c.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (e) {
    // Log the SMTP error explicitly so failed OTP deliveries are visible in the
    // server log (the caller will still see the thrown error).
    console.error(`[mailer] send failed to=${mail.to} host=${c.host}:${c.port} user=${c.user} :: ${(e as Error).message}`);
    throw e;
  }
}

/** Compose and send the account-verification email carrying a one-time code. */
export async function sendVerificationCode(to: string, code: string): Promise<void> {
  const mins = process.env.EMAIL_CODE_TTL_MINUTES ?? "15";
  const web = (process.env.PUBLIC_WEB_URL || "https://make-ppt.com").replace(/\/$/, "");
  const logo = `${web}/logo-icon.png`;
  await sendMail({
    to,
    subject: `Your Make PPT verification code: ${code}`,
    text:
      `Welcome to Make PPT!\n\n` +
      `Your verification code is: ${code}\n\n` +
      `Enter it to activate your account. It expires in ${mins} minutes.\n\n` +
      `If you didn't create a Make PPT account, you can ignore this email.`,
    html:
      `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0c0f16">` +
      `<img src="${logo}" alt="Make PPT" width="48" height="48" style="display:block;border-radius:12px;margin-bottom:16px" />` +
      `<p style="font-size:16px;font-weight:700;margin:0 0 8px">Welcome to Make PPT</p>` +
      `<p style="margin:0 0 16px;color:#64708f">Your verification code is:</p>` +
      `<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:0 0 16px">${code}</p>` +
      `<p style="margin:0 0 12px;color:#64708f">Enter it to activate your account. It expires in ${mins} minutes.</p>` +
      `<p style="color:#8a96b4;font-size:13px;margin:0">If you didn't create a Make PPT account, you can ignore this email.</p>` +
      `</div>`,
  });
}
