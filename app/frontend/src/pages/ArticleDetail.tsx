import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { client } from '@/lib/api';
import DOMPurify from 'dompurify';
import { ArrowLeft, Calendar, Tag, Share2, Newspaper, BookOpen, Shield } from 'lucide-react';
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
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
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
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            {displayDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(displayDate)}
              </span>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="flex items-center gap-1 hover:text-slate-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
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