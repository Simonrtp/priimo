import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarOAuthRedirectUri, oauthPublicOrigin } from './google-calendar';

function req(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers });
}

describe('oauthPublicOrigin', () => {
  it('reste sur localhost même si SITE_URL est priimo.fr', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://priimo.fr';
    try {
      assert.equal(
        oauthPublicOrigin(req('http://localhost:3000/api/dashboard/integrations/calendar/start')),
        'http://localhost:3000',
      );
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  it('renvoie le site public hors local', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://priimo.fr';
    try {
      assert.equal(
        oauthPublicOrigin(
          req('https://priimo.fr/api/dashboard/integrations/calendar/start', {
            'x-forwarded-host': 'priimo.fr',
            'x-forwarded-proto': 'https',
          }),
        ),
        'https://priimo.fr',
      );
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});

describe('calendarOAuthRedirectUri', () => {
  it('ignore un redirect localhost si la requête vient de priimo.fr', () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevRedir = process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://priimo.fr';
    process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI =
      'http://localhost:3000/api/dashboard/integrations/calendar/callback';
    try {
      assert.equal(
        calendarOAuthRedirectUri(
          req('https://priimo.fr/api/dashboard/integrations/calendar/start', {
            'x-forwarded-host': 'priimo.fr',
            'x-forwarded-proto': 'https',
          }),
        ),
        'https://priimo.fr/api/dashboard/integrations/calendar/callback',
      );
    } finally {
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
      if (prevRedir === undefined) delete process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI;
      else process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI = prevRedir;
    }
  });
});
