import { existsSync } from 'fs';
import puppeteer, { type Browser } from 'puppeteer-core';

export class ChromiumIndisponible extends Error {
  constructor(message = 'Impression Chromium indisponible') {
    super(message);
    this.name = 'ChromiumIndisponible';
  }
}

function chromeLocaux(): string[] {
  const env = process.env.CHROME_PATH?.trim();
  const candidats =
    process.platform === 'win32'
      ? [
          env,
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : process.platform === 'darwin'
        ? [env, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : [env, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return [...new Set(candidats.filter((p): p is string => Boolean(p && existsSync(p))))];
}

async function imprimerAvec(
  html: string,
  executablePath: string,
  args: string[],
  headless: boolean | 'shell',
): Promise<Uint8Array> {
  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      args: [...args, '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath,
      headless,
    });
    const page = await browser.newPage();
    await page.setViewport({
      width: Math.round((297 * 96) / 25.4),
      height: Math.round((210 * 96) / 25.4),
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return new Uint8Array(pdf);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function imprimerHtmlEnPdf(html: string): Promise<Uint8Array> {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'];
  let dernier: unknown;

  for (const executablePath of chromeLocaux()) {
    try {
      return await imprimerAvec(html, executablePath, args, true);
    } catch (err) {
      dernier = err;
    }
  }

  try {
    const chromium = await import('@sparticuz/chromium');
    chromium.default.setGraphicsMode = false;
    const executablePath = await chromium.default.executablePath();
    if (executablePath) {
      return await imprimerAvec(html, executablePath, [...chromium.default.args, ...args], 'shell');
    }
  } catch (err) {
    dernier = err;
  }

  throw new ChromiumIndisponible(dernier instanceof Error ? dernier.message : undefined);
}
