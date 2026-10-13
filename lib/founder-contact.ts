/** Contact WhatsApp de l’équipe Priimo. */
const FOUNDER_WHATSAPP_NUMBER = '33766857165';
const FOUNDER_WHATSAPP_MESSAGE = "J'ai une question à propos de Priimo.";
const FOUNDER_WHATSAPP_FORMATION_MESSAGE = "Bonjour, je n'ai pas encore été formé à Priimo.";

function whatsappHref(text: string): string {
  return `https://wa.me/${FOUNDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export const FOUNDER_WHATSAPP_HREF = whatsappHref(FOUNDER_WHATSAPP_MESSAGE);
export const FOUNDER_WHATSAPP_FORMATION_HREF = whatsappHref(FOUNDER_WHATSAPP_FORMATION_MESSAGE);
