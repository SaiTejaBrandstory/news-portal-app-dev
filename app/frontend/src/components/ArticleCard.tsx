import { Link } from 'react-router-dom';
import { Calendar, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useArticleImage } from '@/hooks/useArticleImage';

interface ArticleCardProps {
  id: number;
  title: string;
  summary: string;
  content?: string;
  category: string;
  image_url: string;
  source_name: string;
  slug: string;
  tags?: string | null;
  published_at: string | null;
  created_at: string | null;
  featured?: boolean;
}

/** Extract a clean plain-text preview from content or summary — strips HTML and bullet markers. */
function getPreviewText(content?: string, summary?: string, maxLen = 130): string {
  const raw = content || summary || '';
  return raw
    .replace(/<[^>]+>/g, ' ')            // strip HTML tags
    .replace(/^[\s•\-*►▸\d+\.\)]+/gm, '') // strip bullet/number prefixes per line
    .replace(/\n+/g, ' ')                // flatten newlines
    .replace(/\s{2,}/g, ' ')             // collapse spaces
    .trim()
    .slice(0, maxLen)
    .replace(/\s+\S*$/, '…');            // trim to last full word + ellipsis
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

const FALLBACK_IMAGE = 'https://mgx-backend-cdn.metadl.com/generate/images/910092/2026-04-16/mxdrcziaafaa/hero-news-banner.png';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
}

export default function ArticleCard({
  title,
  summary,
  content,
  category,
  image_url,
  source_name,
  slug,
  tags,
  published_at,
  created_at,
  featured = false,
}: ArticleCardProps) {
  const colorClass = categoryColors[category] || categoryColors.general;
  const displayDate = published_at || created_at;
  const resolvedImage = useArticleImage(image_url || null, FALLBACK_IMAGE);
  const tagList = parseTags(tags);
  const previewText = getPreviewText(content, summary);

  if (featured) {
    return (
      <Link to={`/article/${slug}`} className="group block">
        <article className="relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="relative h-72 sm:h-80 overflow-hidden">
            <img
              src={resolvedImage}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge variant="outline" className={`${colorClass} border text-xs font-semibold uppercase tracking-wider`}>
                  <Tag className="w-3 h-3 mr-1" />
                  {category}
                </Badge>
                {tagList.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="bg-white/10 text-white/90 border-white/20 text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2 line-clamp-2">
                {title}
              </h2>
              <p className="text-white/80 text-sm line-clamp-3 mb-3">{previewText}</p>
              <div className="flex items-center gap-3 text-white/60 text-xs">
                {displayDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(displayDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link to={`/article/${slug}`} className="group block">
      <article className="overflow-hidden rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
        <div className="relative h-48 overflow-hidden">
          <img
            src={resolvedImage}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute top-3 left-3">
            <Badge variant="outline" className={`${colorClass} border text-xs font-semibold uppercase tracking-wider backdrop-blur-sm`}>
              {category}
            </Badge>
          </div>
        </div>
        <div className="p-5 flex flex-col flex-1">
          <h3 className="text-lg font-bold text-slate-900 leading-snug mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {title}
          </h3>
          <p className="text-slate-500 text-sm line-clamp-3 mb-3 flex-1">{previewText}</p>
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {tagList.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
                  {tag}
                </Badge>
              ))}
              {tagList.length > 3 && (
                <Badge variant="outline" className="text-xs bg-slate-50 text-slate-400 border-slate-200">
                  +{tagList.length - 3}
                </Badge>
              )}
            </div>
          )}
          <div className="flex items-center justify-end text-xs text-slate-400">
            {displayDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(displayDate)}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}