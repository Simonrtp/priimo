import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";

// === BETA SIGNUP API ===
// Accepts a JSON POST from `BetaForm`. Validates the payload server-side,
// logs the inscription, and (optionally):
//  - writes one private JSON blob per signup when BETA_BLOB_STORE=1;
//  - forwards to BETA_WEBHOOK_URL.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(?:\+33|0)[1-9](?:\d{2}){4}$/;

type BetaPayload = {
  prenom: string;
  email: string;
  telephone: string;
  nomAgence: string;
  turnstileToken?: string;
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

async function persistSignupBlob(
  payload: Omit<BetaPayload, "turnstileToken">,
  ip: string,
): Promise<void> {
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
      access: "private",
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

async function forwardToWebhook(
  payload: Omit<BetaPayload, "turnstileToken">,
  ip: string,
): Promise<void> {
  const webhookUrl = process.env.BETA_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    new URL(webhookUrl);
  } catch {
    console.warn("[beta] BETA_WEBHOOK_URL is not a valid URL — skipping webhook.");
    return;
  }

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
    console.error("[beta] webhook forwarding failed:", err);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(req);
  const rl = rateLimit(`beta:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

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

  const captcha = await verifyTurnstileToken(
    typeof payload.turnstileToken === "string" ? payload.turnstileToken : null,
    ip,
  );
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  const errors = validate(payload);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { error: "Validation failed.", fields: errors },
      { status: 400 },
    );
  }

  const clean = {
    prenom: payload.prenom!.trim(),
    email: payload.email!.trim().toLowerCase(),
    telephone: payload.telephone!.replace(/\s+/g, ""),
    nomAgence: payload.nomAgence!.trim(),
  };

  await Promise.all([forwardToWebhook(clean, ip), persistSignupBlob(clean, ip)]);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
