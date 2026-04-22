import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSeoHead } from '@/hooks/useSeoHead';
import { client } from '@/lib/api';
import DOMPurify from 'dompurify';
import { ArrowLeft, Calendar, Tag, Check, Copy, Newspaper, BookOpen, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useArticleImage } from '@/hooks/useArticleImage';



const FALLBACK_IMAGE = 'https://mgx-backend-cdn.metadl.com/generate/images/910092/2026-04-16/mxdrcziaafaa/hero-news-banner.png';

interface Article {
  id: number;
  title: string;
  summary: string | null;
  content: string;
  category: string;
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
  slug: string;
  is_published: boolean | null;
  published_at: string | null;
  created_at: string | null;
}

const categoryColors: Record<string, string> = {
  technology: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  business: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  world: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  general: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  science: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  health: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  sports: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  entertainment: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const datePart = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart} at ${timePart}`;
  } catch {
    return '';
  }
}

interface SharePanelProps { title: string; url: string; }

function SharePanel({ title, url }: SharePanelProps) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;

  const platforms = [
    {
      label: 'X / Twitter',
      href: `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`,
      color: 'hover:bg-black hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      color: 'hover:bg-[#1877f2] hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.258h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
      ),
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/shareArticle?mini=true&url=${enc(url)}&title=${enc(title)}`,
      color: 'hover:bg-[#0a66c2] hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
    },
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${enc(title + ' ' + url)}`,
      color: 'hover:bg-[#25d366] hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`,
      color: 'hover:bg-[#229ed9] hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
    },
    {
      label: 'Reddit',
      href: `https://reddit.com/submit?url=${enc(url)}&title=${enc(title)}`,
      color: 'hover:bg-[#ff4500] hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
        </svg>
      ),
    },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Share</span>
      {platforms.map((p) => (
        <a
          key={p.label}
          href={p.href}
          target="_blank"
          rel="noopener noreferrer"
          title={p.label}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 transition-all duration-150 ${p.color} shadow-sm hover:shadow-md hover:scale-110`}
        >
          {p.icon}
        </a>
      ))}
      <button
        onClick={handleCopy}
        title="Copy link"
        className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-800 hover:text-white transition-all duration-150 shadow-sm hover:shadow-md hover:scale-110"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

/** Small component to resolve and display a related article image */
function RelatedArticleImage({ imageUrl, title }: { imageUrl: string | null; title: string }) {
  const resolved = useArticleImage(imageUrl, FALLBACK_IMAGE);
  return (
    <img
      src={resolved}
      alt={title}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
    />
  );
}

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  useSeoHead({ canonicalPath: slug ? `/article/${slug}` : undefined });
  const [loading, setLoading] = useState(true);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);

  useEffect(() => {
    async function loadArticle() {
      if (!slug) return;
      setLoading(true);
      try {
        const response = await client.entities.articles.query({
          query: { slug, is_published: true },
          limit: 1,
        });
        const items = response.data?.items || [];
        if (items.length > 0) {
          setArticle(items[0]);
          // Fetch related articles
          const relatedResp = await client.entities.articles.query({
            query: { category: items[0].category, is_published: true },
            sort: '-published_at',
            limit: 4,
          });
          const related = (relatedResp.data?.items || []).filter(
            (a: Article) => a.id !== items[0].id
          );
          setRelatedArticles(related.slice(0, 3));
        }
      } catch (err) {
        console.error('Error loading article:', err);
      } finally {
        setLoading(false);
      }
    }
    loadArticle();
  }, [slug]);

  // SEO: Update document title and meta
  useEffect(() => {
    if (article) {
      document.title = `${article.title} | NewsPortal`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', article.summary || article.title);
      }
    }
    return () => {
      document.title = 'NewsPortal - AI-Powered News';
    };
  }, [article]);

  // Resolve the main article image
  const heroImage = useArticleImage(article?.image_url, '');

  /** Detect if content is HTML or plain text, sanitize accordingly */
  const isHTMLContent = useMemo(() => {
    if (!article) return false;
    return /<[a-z][\s\S]*>/i.test(article.content);
  }, [article]);

  const sanitizedHTML = useMemo(() => {
    if (!article || !isHTMLContent) return '';
    return DOMPurify.sanitize(article.content, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'a', 'blockquote',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div',
        'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'caption',
        'img', 'figure', 'figcaption', 'pre', 'code', 'hr', 'sub', 'sup',
        'video', 'source', 'audio',
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'target', 'rel', 'class', 'style', 'src', 'alt',
        'width', 'height', 'colspan', 'rowspan', 'scope', 'id', 'loading',
        'controls', 'autoplay', 'loop', 'muted', 'preload', 'poster', 'type',
      ],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });
  }, [article, isHTMLContent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <Skeleton className="h-96 rounded-2xl mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Newspaper className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-700 mb-2">Article Not Found</h1>
          <p className="text-slate-500 mb-6">The article you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Link to="/">
            <Button className="bg-red-500 hover:bg-red-600 text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const colorClass = categoryColors[article.category] || categoryColors.general;
  const displayDate = article.published_at || article.created_at;

  // Structured data for SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary || '',
    image: heroImage || '',
    datePublished: article.published_at || article.created_at || '',
    dateModified: article.published_at || article.created_at || '',
    author: {
      '@type': 'Organization',
      name: 'NewsPortal',
    },
    publisher: {
      '@type': 'Organization',
      name: 'NewsPortal',
      logo: {
        '@type': 'ImageObject',
        url: '/favicon.svg',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': window.location.href,
    },
  };

  const contentParagraphs = isHTMLContent ? [] : article.content.split('\n').filter((p) => p.trim());

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center">
                <Newspaper className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight">
                News<span className="text-red-400">Portal</span>
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/blog/">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800">
                  <BookOpen className="w-4 h-4 mr-1" />
                  Blog
                </Button>
              </Link>
              <Link to="/admin">
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white">
                  <Shield className="w-4 h-4 mr-1" />
                  Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all news
        </Link>

        {/* Article Header */}
        <header className="mb-8">
          <Badge variant="outline" className={`${colorClass} border mb-4 text-xs font-semibold uppercase tracking-wider`}>
            <Tag className="w-3 h-3 mr-1" />
            {article.category}
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-4">
            {article.title}
          </h1>
          {article.summary && (
            <p className="text-lg text-slate-600 leading-relaxed mb-4">{article.summary}</p>
          )}
          <div className="flex flex-col gap-3 text-sm text-slate-500">
            {displayDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 shrink-0" />
                {formatDate(displayDate)}
              </span>
            )}
            <SharePanel title={article.title} url={window.location.href} />
          </div>
        </header>

        {/* Featured Image - full width hero with auto-sizing */}
        {heroImage && (
          <div className="relative rounded-2xl overflow-hidden mb-8 shadow-lg">
            <img
              src={heroImage}
              alt={article.title}
              className="w-full h-auto max-h-[500px] object-cover"
            />
          </div>
        )}

        {/* Article Body */}
        {isHTMLContent ? (
          <div
            className="prose prose-lg prose-slate max-w-none article-html-content"
            dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
          />
        ) : (
          <div className="prose prose-lg prose-slate max-w-none">
            {contentParagraphs.map((paragraph, index) => (
              <p key={index} className="text-slate-700 leading-relaxed mb-4">
                {paragraph}
              </p>
            ))}
          </div>
        )}

        {/* Styles for rendered HTML content */}
        <style>{`
          .article-html-content a {
            color: #3b82f6;
            text-decoration: underline;
          }
          .article-html-content a:hover {
            color: #1d4ed8;
          }
          .article-html-content a.internal-link {
            color: #7c3aed;
          }
          .article-html-content a.external-link {
            color: #2563eb;
          }
          .article-html-content blockquote {
            border-left: 3px solid #3b82f6;
            padding-left: 16px;
            color: #64748b;
            font-style: italic;
          }
          .article-html-content table {
            border-collapse: collapse;
            width: 100%;
          }
          .article-html-content table td,
          .article-html-content table th {
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
          }
          .article-html-content table th {
            background-color: #f8fafc;
            font-weight: 600;
          }
          .article-html-content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            display: block;
          }
          .article-html-content img.responsive-img {
            width: 100%;
            max-width: 100%;
            height: auto;
            object-fit: cover;
            border-radius: 8px;
            display: block;
            margin: 12px 0;
          }
          .article-html-content video {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            display: block;
            margin: 12px 0;
            background: #000;
          }
          .article-html-content pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
          }
          .article-html-content code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
          }
          .article-html-content pre code {
            background: transparent;
            padding: 0;
          }
        `}</style>



        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <>
            <Separator className="my-10" />
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6">Related Articles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedArticles.map((related) => (
                  <Link
                    key={related.id}
                    to={`/article/${related.slug}`}
                    className="group block rounded-xl overflow-hidden bg-white shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                  >
                    <div className="h-32 overflow-hidden">
                      <RelatedArticleImage imageUrl={related.image_url} title={related.title} />
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {related.title}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </article>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <Newspaper className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                News<span className="text-red-400">Portal</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <Link to="/blog/" className="hover:text-white transition-colors">Blog</Link>
              <Link to="/admin" className="hover:text-white transition-colors">Admin</Link>
            </div>
            <p className="text-sm">
              © {new Date().getFullYear()} NewsPortal. AI-powered news curation and publishing.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}