import { NextResponse } from 'next/server';
import { peutCapturerLeads, peutEstimer, productionOuverte, type AgencyBilling } from './acces';

export function refuserSiProductionFermee(agency: AgencyBilling | null | undefined): NextResponse | null {
  if (productionOuverte(agency)) return null;
  return NextResponse.json(
    { error: 'Cette fonction est en pause pour le moment.' },
    { status: 403 },
  );
}

export function refuserSiEstimationFermee(agency: AgencyBilling | null | undefined): NextResponse | null {
  if (peutEstimer(agency)) return null;
  return NextResponse.json(
    { error: 'L’estimation est en pause pour le moment.' },
    { status: 403 },
  );
}

export function refuserSiCaptationFermee(agency: AgencyBilling | null | undefined): NextResponse | null {
  if (peutCapturerLeads(agency)) return null;
  return NextResponse.json(
    { error: 'La captation est en pause pour le moment.' },
    { status: 403 },
  );
}
