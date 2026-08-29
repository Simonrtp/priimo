/**
 * Destination Calendly réelle — import serveur uniquement
 * (ne pas importer depuis un composant client).
 */
export function getCalendlyBookingUrl(): string {
  return (
    process.env.CALENDLY_BOOKING_URL?.trim() ||
    process.env.NEXT_PUBLIC_CALENDLY_URL?.trim() ||
    'https://calendly.com/simon-ropiot44/nouvelle-reunion'
  );
}
