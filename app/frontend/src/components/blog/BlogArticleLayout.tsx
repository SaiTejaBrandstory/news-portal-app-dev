import { Link } from 'react-router-dom';
import { Newspaper, ArrowLeft, Shield, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

type BlogArticleLayoutProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const BlogArticleLayout = ({
  title,
  description,
  children,
}: BlogArticleLayoutProps) => (
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
                News
              </Button>
            </Link>
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

    {/* Back to blog */}
    <div className="mx-auto max-w-4xl px-6 pt-8">
      <Link
        to="/blog/"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to blog
      </Link>
    </div>

    {/* Article */}
    <article className="mx-auto max-w-3xl px-6 py-10">
      <header className="border-b border-slate-200 pb-8 mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500 mb-3">
          Blog Article
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight text-slate-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            {description}
          </p>
        ) : null}
      </header>

      <div>{children}</div>
    </article>

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

export default BlogArticleLayout;