import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { BlogPost, BlogPostSummary } from './types';
import { resolveAuthorImage } from './author';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

function parseReadingTime(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) return Number(match[1]);
  }
  return 5;
}

function parseFrontMatter(data: Record<string, unknown>, content: string, filename: string): BlogPost {
  const slug = typeof data.slug === 'string' ? data.slug : filename.replace(/\.md$/, '');
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];

  return {
    title: String(data.title ?? 'Sans titre'),
    description: String(data.description ?? ''),
    slug,
    date: String(data.date ?? new Date().toISOString().slice(0, 10)),
    readingTime: parseReadingTime(data.readingTime),
    tags,
    author: String(data.author ?? 'Priimo'),
    authorImage: resolveAuthorImage(
      String(data.author ?? 'Priimo'),
      typeof data.authorImage === 'string' ? data.authorImage : undefined,
    ),
    ogImage: typeof data.ogImage === 'string' ? data.ogImage : undefined,
    content,
  };
}

export function getAllPosts(): BlogPostSummary[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((file) => file.endsWith('.md'));

  const posts = files.map((filename) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8');
    const { data, content } = matter(raw);
    const post = parseFrontMatter(data as Record<string, unknown>, content, filename);
    const { content: _content, ...summary } = post;
    return summary;
  });

  return posts.sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.slug.localeCompare(b.slug);
  });
}

export function getPostBySlug(slug: string): BlogPost | null {
  if (!fs.existsSync(BLOG_DIR)) return null;

  const directPath = path.join(BLOG_DIR, `${slug}.md`);
  if (fs.existsSync(directPath)) {
    const raw = fs.readFileSync(directPath, 'utf8');
    const { data, content } = matter(raw);
    const post = parseFrontMatter(data as Record<string, unknown>, content, `${slug}.md`);
    if (post.slug !== slug) return null;
    return post;
  }

  const files = fs.readdirSync(BLOG_DIR).filter((file) => file.endsWith('.md'));
  for (const filename of files) {
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8');
    const { data, content } = matter(raw);
    const post = parseFrontMatter(data as Record<string, unknown>, content, filename);
    if (post.slug === slug) return post;
  }

  return null;
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((post) => post.slug);
}
