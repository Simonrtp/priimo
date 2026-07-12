import fs from 'fs';
import path from 'path';

const CONTENT_PATH = path.join(process.cwd(), 'content/about/a-propos.md');

export function getAboutContent(): string {
  return fs.readFileSync(CONTENT_PATH, 'utf8');
}
