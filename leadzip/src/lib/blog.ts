import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog')

export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string
  author: string
  category: string
  keywords: string[]
  readingTime: string
  cover: string
  excerpt: string
}

export interface Post extends PostMeta {
  html: string
}

export function getAllPostSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
}

function parsePost(slug: string): Post | null {
  const fp = path.join(BLOG_DIR, `${slug}.md`)
  if (!fs.existsSync(fp)) return null
  const raw = fs.readFileSync(fp, 'utf8')
  const { data, content } = matter(raw)
  const html = marked.parse(content, { async: false }) as string
  const d = data as Record<string, unknown>
  return {
    slug: (d.slug as string) || slug,
    title: (d.title as string) ?? slug,
    description: (d.description as string) ?? '',
    date: (d.date as string) ?? '',
    author: (d.author as string) ?? 'LeadZipp Team',
    category: (d.category as string) ?? 'Guides',
    keywords: (d.keywords as string[]) ?? [],
    readingTime: (d.readingTime as string) ?? '',
    cover: (d.cover as string) ?? '',
    excerpt: (d.excerpt as string) ?? (d.description as string) ?? '',
    html,
  }
}

export function getPost(slug: string): Post | null {
  return parsePost(slug)
}

export function getAllPosts(): Post[] {
  return getAllPostSlugs()
    .map(parsePost)
    .filter((p): p is Post => p !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00Z' : ''))
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
