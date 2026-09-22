'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  adressesProposeesPourContact,
  bienDepuisItem,
  contactDepuisItem,
  type AdresseProposee,
  type RattacherItem,
} from '@/lib/notes/rattacher-catalogue';

export function useAdressesProposees(contactId: string | null): AdresseProposee[] {
  const [catalogue, setCatalogue] = useState<{
    contact: RattacherItem[];
    bien: RattacherItem[];
  }>({ contact: [], bien: [] });

  useEffect(() => {
    if (!contactId) {
      setCatalogue({ contact: [], bien: [] });
      return;
    }
    let cancel = false;
    void fetch('/api/dashboard/rattacher')
      .then((r) => r.json())
      .then((data: { contact?: RattacherItem[]; bien?: RattacherItem[] }) => {
        if (cancel) return;
        setCatalogue({ contact: data.contact ?? [], bien: data.bien ?? [] });
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [contactId]);

  return useMemo(() => {
    if (!contactId) return [];
    const item = catalogue.contact.find((c) => c.id === contactId);
    if (!item) return [];
    return adressesProposeesPourContact(
      contactDepuisItem(item),
      catalogue.bien.map(bienDepuisItem),
    );
  }, [catalogue, contactId]);
}
