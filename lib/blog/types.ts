export interface BlogPostFrontMatter {
  title: string;
  description: string;
  slug: string;
  date: string;
  readingTime: number;
  tags: string[];
  author: string;
  authorImage?: string;
  ogImage?: string;
  draft?: boolean;
}

export interface BlogPost extends BlogPostFrontMatter {
  content: string;
}

export type BlogPostSummary = BlogPostFrontMatter;

export type MarkdownBlock =
  | { type: 'markdown'; content: string }
  | { type: 'priimo'; content: string }
  | { type: 'note'; content: string };
