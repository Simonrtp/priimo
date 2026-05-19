'use client';

import { useEffect, useState } from 'react';
import { geocodeBanQuery } from '@/lib/ban';
import { leadToAddressQuery, type LeadMapPoint } from '@/lib/lead-map';
import type { Lead } from '@/types/lead';

const GEOCODE_DELAY_MS = 80;

export function useLeadMapPoints(leads: Lead[], enabled: boolean) {
  const [points, setPoints] = useState<LeadMapPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (!enabled || leads.length === 0) {
      setPoints([]);
      setFailedCount(0);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function resolve() {
      setLoading(true);
      const resolved: LeadMapPoint[] = [];
      let failed = 0;

      for (const lead of leads) {
        if (cancelled) return;

        let lat = lead.latitude;
        let lng = lead.longitude;

        if (lat == null || lng == null) {
          const query = leadToAddressQuery(lead);
          try {
            const coords = await geocodeBanQuery(query);
            if (coords) {
              lat = coords.latitude;
              lng = coords.longitude;
            }
          } catch {
            failed += 1;
            await new Promise((r) => setTimeout(r, GEOCODE_DELAY_MS));
            continue;
          }
          await new Promise((r) => setTimeout(r, GEOCODE_DELAY_MS));
        }

        if (lat != null && lng != null) {
          resolved.push({
            leadId: lead.id,
            latitude: lat,
            longitude: lng,
            address: leadToAddressQuery(lead),
            score: lead.score,
          });
        } else {
          failed += 1;
        }
      }

      if (!cancelled) {
        setPoints(resolved);
        setFailedCount(failed);
        setLoading(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [enabled, leads]);

  return { points, loading, failedCount, mappedCount: points.length };
}
