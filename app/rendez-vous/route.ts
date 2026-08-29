import { NextResponse } from 'next/server';
import { getCalendlyBookingUrl } from '@/lib/calendly-server';

/** Redirection opaque vers Calendly — l’URL publique ne contient pas de nom. */
export function GET() {
  return NextResponse.redirect(getCalendlyBookingUrl(), 302);
}
