import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { client } from '@/lib/api';
import { useSeoHead } from '@/hooks/useSeoHead';
import { Newspaper, TrendingUp, Globe, Cpu, Heart, Gamepad2, Film, Search, ChevronRight, Shield, X, Tag, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ArticleCard from '@/components/ArticleCard';
import SubscribeWidget from '@/components/SubscribeWidget';



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
  tags: string | null;
  is_published: boolean | null;
  published_at: string | null;
  created_at: string | null;
}

interface SearchResultArticle extends Article {
  relevance_source?: string;
}

interface CategoryItem {
  id: number;
  name: string;
  label: string;
}

/** Map category name to an icon. Falls back to Layers for unknown categories. */
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  technology: Cpu,
  business: TrendingUp,
  world: Globe,
  health: Heart,
  sports: Gamepad2,
  entertainment: Film,
  science: Layers,
  general: Newspaper,
};

export default function Index() {
  useSeoHead({ canonicalPath: '/' });
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = useState<SearchResultArticle[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  // Load categories from DB
  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await client.entities.categories.query({
          query: {},
          sort: 'name',
          limit: 100,
        });
        setCategories(response.data?.items || []);
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    }
    loadCategories();
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams: Record<string, unknown> = { is_published: true };
      if (activeCategory !== 'all') {
        queryParams.category = activeCategory;
      }
      const response = await client.entities.articles.query({
        query: queryParams,
        sort: '-published_at',
        limit: 50,
      });
      setArticles(response.data?.items || []);
    } catch (err) {
      console.error('Error fetching articles:', err);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Perform search when URL has ?q= param on mount
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && q.trim()) {
      setSearchQuery(q);
      performSearch(q.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    setSearchLoading(true);
    setSearchResults(null);
    setSearchMessage('');
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/news/search',
        method: 'POST',
        data: { query: query.trim(), limit: 30 },
      });
      const result = response.data;
      setSearchResults(result.articles || []);
      setSearchMessage(result.message || `Found ${(result.articles || []).length} results`);
      setSearchParams({ q: query.trim() });
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
      setSearchMessage('Search failed. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchMessage('');
    setSearchParams({});
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      performSearch(searchQuery);
    }
  };

  const isSearchActive = searchResults !== null;

  const featuredArticle = !isSearchActive ? articles[0] : null;
  const restArticles = !isSearchActive ? articles.slice(1) : [];

  // Build category tabs from DB categories
  const categoryTabs = [
    { key: 'all', label: 'All News', icon: Newspaper },
    ...categories.map((cat) => ({
      key: cat.name,
      label: cat.label,
      icon: CATEGORY_ICONS[cat.name] || Layers,
    })),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2" onClick={clearSearch}>
              <div className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center">
                <Newspaper className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight">
                News<span className="text-red-400">Portal</span>
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search news..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-9 pr-8 w-64 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-red-400 focus:ring-red-400/20"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Link to="/blog/">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800">
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

      {/* Hero Banner - only show when not searching */}
      {!isSearchActive && (
        <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'url(https://mgx-backend-cdn.metadl.com/generate/images/910092/2026-04-16/mxdrcziaafaa/hero-news-banner.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="max-w-2xl">
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 mb-4">
                AI-Powered News
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
                Stay Informed with
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                  Intelligent News
                </span>
              </h1>
              <p className="text-lg text-slate-300 mb-6 leading-relaxed">
                Real-time news automatically curated and rewritten by AI for clarity, accuracy, and readability. Your smart news companion.
              </p>
              <div className="flex gap-3 sm:hidden">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search news..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-9 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-400"
                  />
                </div>
                <Button onClick={() => performSearch(searchQuery)} className="bg-red-500 hover:bg-red-600 text-white">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Search Results Header */}
      {isSearchActive && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Search className="w-5 h-5 text-slate-500" />
                  <h2 className="text-xl font-bold text-slate-900">Search Results</h2>
                </div>
                <p className="text-sm text-slate-500">{searchMessage}</p>
              </div>
              <Button variant="outline" size="sm" onClick={clearSearch}>
                <X className="w-4 h-4 mr-1" /> Clear Search
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs - only show when not searching */}
      {!isSearchActive && (
        <div className="bg-white border-b border-slate-200 sticky top-16 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
              {categoryTabs.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Search Results */}
        {isSearchActive ? (
          searchLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-48 rounded-xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ) : searchResults && searchResults.length === 0 ? (
            <div className="text-center py-20">
              <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-700 mb-2">No results found</h2>
              <p className="text-slate-500 mb-6">
                Try different keywords or browse by category
              </p>
              <Button onClick={clearSearch} className="bg-red-500 hover:bg-red-600 text-white">
                Browse All News
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(searchResults || []).map((article) => (
                <div key={article.id} className="relative">
                  {article.relevance_source === 'tags' && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <Badge className="bg-violet-500 text-white text-xs border-0 shadow-sm">
                        <Tag className="w-3 h-3 mr-1" />
                        Tag match
                      </Badge>
                    </div>
                  )}
                  <ArticleCard
                    id={article.id}
                    title={article.title}
                    summary={article.summary || ''}
                    category={article.category}
                    image_url={article.image_url || ''}
                    source_name={article.source_name || 'Unknown'}
                    slug={article.slug}
                    tags={article.tags}
                    published_at={article.published_at}
                    created_at={article.created_at}
                  />
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="space-y-6">
            <Skeleton className="h-80 rounded-2xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-48 rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <Newspaper className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-700 mb-2">No articles found</h2>
            <p className="text-slate-500 mb-6">
              No published articles yet. Check back soon or visit the admin panel to fetch news.
            </p>
            <Link to="/admin">
              <Button className="bg-red-500 hover:bg-red-600 text-white">
                Go to Admin Panel
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Featured Article */}
            {featuredArticle && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-bold text-slate-900">Featured Story</h2>
                </div>
                <ArticleCard
                  id={featuredArticle.id}
                  title={featuredArticle.title}
                  summary={featuredArticle.summary || ''}
                  category={featuredArticle.category}
                  image_url={featuredArticle.image_url || ''}
                  source_name={featuredArticle.source_name || 'Unknown'}
                  slug={featuredArticle.slug}
                  tags={featuredArticle.tags}
                  published_at={featuredArticle.published_at}
                  created_at={featuredArticle.created_at}
                  featured
                />
              </section>
            )}

            {/* Article Grid */}
            {restArticles.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Newspaper className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-bold text-slate-900">Latest News</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {restArticles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      id={article.id}
                      title={article.title}
                      summary={article.summary || ''}
                      category={article.category}
                      image_url={article.image_url || ''}
                      source_name={article.source_name || 'Unknown'}
                      slug={article.slug}
                      tags={article.tags}
                      published_at={article.published_at}
                      created_at={article.created_at}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Newsletter Subscribe Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SubscribeWidget />
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 mt-0">
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