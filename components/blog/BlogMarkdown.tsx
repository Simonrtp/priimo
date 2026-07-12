'use client';

import Link from 'next/link';
import { Children, isValidElement, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BlogCallout from './BlogCallout';
import BlogNote from './BlogNote';
import { parseBlogBlocks } from '@/lib/blog/markdown';
import { countH2InMarkdown } from '@/lib/blog/toc';
import type { TocItem } from '@/lib/blog/toc';

type BlogMarkdownProps = {
  source: string;
  headings: TocItem[];
};

function childText(children: React.ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (isValidElement<{ children?: React.ReactNode }>(child)) return childText(child.props.children);
      return '';
    })
    .join('')
    .trim();
}

function createMarkdownComponents(headings: TocItem[]) {
  let h2Index = 0;

  return {
    h2: ({ children }: { children?: React.ReactNode }) => {
      const item = headings[h2Index];
      h2Index += 1;
      return (
        <h2 id={item?.id} className="blog-prose-h2 blog-scroll-anchor">
          {children}
        </h2>
      );
    },
    h3: ({ children }: { children?: React.ReactNode }) => {
      const isSources = childText(children) === 'Sources';
      return (
        <h3 className={isSources ? 'blog-prose-h3 blog-prose-h3-sources' : 'blog-prose-h3'}>
          {children}
        </h3>
      );
    },
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="blog-prose-p">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="blog-prose-ul">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="blog-prose-ol">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="blog-prose-li">{children}</li>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="blog-prose-blockquote">{children}</blockquote>
    ),
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      const isExternal =
        !href ||
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:');

      if (isExternal) {
        return (
          <a
            href={href}
            className="blog-prose-link"
            target={href?.startsWith('http') ? '_blank' : undefined}
            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {children}
          </a>
        );
      }

      return (
        <Link href={href} className="blog-prose-link">
          {children}
        </Link>
      );
    },
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-gray-950">{children}</strong>
    ),
  };
}

function MarkdownChunk({ content, headings }: { content: string; headings: TocItem[] }) {
  const components = useMemo(() => createMarkdownComponents(headings), [headings]);

  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </Markdown>
  );
}

export default function BlogMarkdown({ source, headings }: BlogMarkdownProps) {
  const blocks = parseBlogBlocks(source);
  let headingOffset = 0;

  return (
    <div className="blog-prose">
      {blocks.map((block, index) => {
        if (block.type === 'priimo') {
          return (
            <BlogCallout key={`priimo-${index}`}>
              <MarkdownChunk content={block.content} headings={[]} />
            </BlogCallout>
          );
        }
        if (block.type === 'note') {
          return (
            <BlogNote key={`note-${index}`}>
              <MarkdownChunk content={block.content} headings={[]} />
            </BlogNote>
          );
        }

        const count = countH2InMarkdown(block.content);
        const chunkHeadings = headings.slice(headingOffset, headingOffset + count);
        headingOffset += count;

        return (
          <MarkdownChunk key={`md-${index}`} content={block.content} headings={chunkHeadings} />
        );
      })}
    </div>
  );
}
