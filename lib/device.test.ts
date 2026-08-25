import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deviceFromHints, deviceFromUserAgent } from './device';

describe('deviceFromUserAgent', () => {
  it('classe un iPhone en mobile', () => {
    assert.equal(
      deviceFromUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
      'mobile',
    );
  });

  it('classe Chrome Android en mobile', () => {
    assert.equal(
      deviceFromUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      ),
      'mobile',
    );
  });

  it('classe un iPad en mobile', () => {
    assert.equal(
      deviceFromUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
      'mobile',
    );
  });

  it('classe un navigateur d’ordinateur en desktop', () => {
    assert.equal(
      deviceFromUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      ),
      'desktop',
    );
  });
});

describe('deviceFromHints', () => {
  const desktopUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

  it('suit le cookie même si l’UA est un ordinateur', () => {
    assert.equal(
      deviceFromHints({ ua: desktopUa, cookie: 'sid=abc; priimo-device=mobile' }),
      'mobile',
    );
  });

  it('suit l’en-tête Sec-CH-UA-Mobile', () => {
    assert.equal(deviceFromHints({ ua: desktopUa, chMobile: '?1' }), 'mobile');
  });
});
