import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

// === BETA SIGNUP API ===
// Accepts a JSON POST from `BetaForm`. Validates the payload server-side,
// logs the inscription, and (optionally):
//  - writes one JSON file per signup to Vercel Blob when `BETA_BLOB_STORE`
//    is enabled and `BLOB_READ_WRITE_TOKEN` is set (see .env.example);
//  - forwards to `BETA_WEBHOOK_URL` (Slack, Discord, Make, n8n, Zapier, …).
//
// Why an API route?
//  - Form submissions never touch a third-party from the browser, so we
//    can later swap the storage backend without breaking the client.
//  - Server-side validation is the source of truth (a malicious client
//    could bypass the form's own validation).
//  - Vercel logs the request automatically — visible in the dashboard.

// Force the Node.js runtime so we have access to `fetch` with full TLS
// and reasonable timeouts. (Edge runtime would also work but isn't
// required here.)
export const runtime = "nodejs";

// Don't cache the route — every submission is a unique side-effect.
export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(?:\+33|0)[1-9](?:\d{2}){4}$/;

type BetaPayload = {
  prenom: string;
  email: string;
  telephone: string;
  nomAgence: string;
};

type ValidationErrors = Partial<Record<keyof BetaPayload, string>>;

function validate(payload: Partial<BetaPayload>): ValidationErrors {
  const errors: ValidationErrors = {};

  const prenom = (payload.prenom ?? "").trim();
  if (!prenom) errors.prenom = "Prénom requis.";
  else if (prenom.length < 2) errors.prenom = "Prénom trop court.";
  else if (prenom.length > 80) errors.prenom = "Prénom trop long.";

  const email = (payload.email ?? "").trim();
  if (!email) errors.email = "Email requis.";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Format d'email invalide.";
  else if (email.length > 254) errors.email = "Email trop long.";

  const telephone = (payload.telephone ?? "").replace(/\s+/g, "");
  if (!telephone) errors.telephone = "Téléphone requis.";
  else if (!PHONE_REGEX.test(telephone)) errors.telephone = "Format de téléphone invalide.";

  const nomAgence = (payload.nomAgence ?? "").trim();
  if (!nomAgence) errors.nomAgence = "Nom de l'agence requis.";
  else if (nomAgence.length < 2) errors.nomAgence = "Nom d'agence trop court.";
  else if (nomAgence.length > 120) errors.nomAgence = "Nom d'agence trop long.";

  return errors;
}

function clientIp(req: Request): string {
  // Vercel sets `x-forwarded-for` — take the first IP in the chain.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Optional durable trace on Vercel: one JSON blob per successful signup
 * under `beta-signups/YYYY-MM-DD/<random>.json`. Works on Vercel when Blob
 * is enabled for the project (token is injected automatically). Never fails
 * the HTTP response for the visitor.
 */
async function persistSignupBlob(payload: BetaPayload, ip: string): Promise<void> {
  if (process.env.BETA_BLOB_STORE !== "1") return;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.warn("[beta] BETA_BLOB_STORE=1 but BLOB_READ_WRITE_TOKEN is missing.");
    return;
  }

  const record = {
    source: "priimo-landing",
    receivedAt: new Date().toISOString(),
    ip,
    ...payload,
  };

  const day = new Date().toISOString().slice(0, 10);
  const id = randomBytes(16).toString("hex");
  const pathname = `beta-signups/${day}/${id}.json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    await put(pathname, JSON.stringify(record), {
      access: "public",
      token,
      contentType: "application/json",
      addRandomSuffix: false,
      abortSignal: controller.signal,
    });
  } catch (err) {
    console.error("[beta] blob persist failed:", err);
  } finally {
    clearTimeout(timeout);
  }
}

async function forwardToWebhook(payload: BetaPayload, ip: string): Promise<void> {
  const webhookUrl = process.env.BETA_WEBHOOK_URL;
  if (!webhookUrl) return;

  try { new URL(webhookUrl); } catch {
    console.warn("[beta] BETA_WEBHOOK_URL is not a valid URL — skipping webhook.");
    return;
  }

  // Soft timeout: we don't want a slow webhook to block the user-facing
  // response for more than ~3s. Failures here are logged but never fail
  // the user's submission — we already have the data in our own logs.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "priimo-landing",
        receivedAt: new Date().toISOString(),
        ip,
        ...payload,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    // Logged on the server (Vercel dashboard) but never surfaced to the user.
    console.error("[beta] webhook forwarding failed:", err);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  // --- 1. Parse + bound the body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const payload = body as Partial<BetaPayload>;

  // --- 2. Validate server-side ---
  const errors = validate(payload);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Validation failed.", fields: errors },
      { status: 400 }
    );
  }

  // From here on, all fields are present and well-shaped.
  const clean: BetaPayload = {
    prenom: payload.prenom!.trim(),
    email: payload.email!.trim().toLowerCase(),
    telephone: payload.telephone!.replace(/\s+/g, ""),
    nomAgence: payload.nomAgence!.trim(),
  };

  const ip = clientIp(req);

  // --- 3. Optional parallel side-effects (never block each other > timeout) ---
  await Promise.all([forwardToWebhook(clean, ip), persistSignupBlob(clean, ip)]);

  return NextResponse.json({ ok: true });
}

// Block any non-POST verb explicitly so they don't fall through to a 404
// HTML page (which would confuse fetch consumers).
export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
