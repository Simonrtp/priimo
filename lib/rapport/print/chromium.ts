import { existsSync } from 'fs';
import puppeteer from 'puppeteer-core';

export class ChromiumIndisponible extends Error {
  constructor(message = 'Impression Chromium indisponible') {
    super(message);
    this.name = 'ChromiumIndisponible';
  }
}

function chromeLocal(): string | null {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidats =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return candidats.find((p) => existsSync(p)) ?? null;
}

export async function imprimerHtmlEnPdf(html: string): Promise<Uint8Array> {
  const local = chromeLocal();
  let executablePath = local;
  let args: string[] = ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'];

  let headless: boolean | 'shell' = true;
  if (!executablePath) {
    try {
      const chromium = await import('@sparticuz/chromium');
      chromium.default.setGraphicsMode = false;
      executablePath = await chromium.default.executablePath();
      args = [...chromium.default.args, '--font-render-hinting=none'];
      headless = 'shell';
    } catch {
      throw new ChromiumIndisponible();
    }
  }
  if (!executablePath) throw new ChromiumIndisponible();

  const browser = await puppeteer.launch({
    args,
    executablePath,
    headless,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 45_000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
