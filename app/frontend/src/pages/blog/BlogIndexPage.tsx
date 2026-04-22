import { Link } from 'react-router-dom';
import { blogPosts, getBlogRoute } from '@/lib/blog';
import { useSeoHead } from '@/hooks/useSeoHead';
import { Newspaper, BookOpen, ArrowLeft, Shield, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const BlogIndexPage = () => {
  useSeoHead({ canonicalPath: '/blog' });
  return (
  <div className="min-h-screen bg-slate-50">
    {/* Header - matching NewsPortal theme */}
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
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800">
                <ArrowLeft className="w-4 h-4 mr-1" />
                News
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

    {/* Hero Section */}
    <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-18">
        <div className="max-w-3xl">
          <Badge className="bg-red-500/10 text-red-400 border-red-500/20 mb-4">
            <BookOpen className="w-3 h-3 mr-1" />
            Blog & Insights
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3">
            AI News & Publishing{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
              Insights
            </span>
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Deep dives into AI-powered news curation, automated publishing, and the future of intelligent journalism.
          </p>
        </div>
      </div>
    </section>

    {/* Blog Posts */}
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {blogPosts.length > 0 ? (
        <div className="grid gap-6">
          {blogPosts.map((post) => (
            <article
              key={post.slug}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Hero image if available */}
                {post.frontmatter.hero_image && (
                  <div className="sm:w-48 sm:h-32 flex-shrink-0 rounded-xl overflow-hidden">
                    <img
                      src={String(post.frontmatter.hero_image)}
                      alt={post.title}
                      className="w-full h-40 sm:h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 mb-2">
                    {post.frontmatter.date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.frontmatter.date}
                      </span>
                    )}
                    {post.frontmatter.tags?.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-xs bg-slate-50 text-slate-600 border-slate-200"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-red-600 transition-colors">
                    <Link to={getBlogRoute(post.slug)}>
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-2 mb-3">
                    {post.description}
                  </p>
                  <Link
                    to={getBlogRoute(post.slug)}
                    className="inline-flex items-center text-sm font-semibold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Read article →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">No articles yet</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Blog articles will appear here once SEO content is added to the seo/content/ directory.
          </p>
        </div>
      )}
    </main>

    {/* Footer */}
    <footer className="bg-slate-900 text-slate-400 py-12 mt-12">
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
};

export default BlogIndexPage;