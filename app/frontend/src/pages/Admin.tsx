import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useSeoHead } from '@/hooks/useSeoHead';
import { AUTH_EXPIRED_EVENT } from '@/lib/api';
import { client } from '@/lib/api';
import { fetchWithRetry } from '@/lib/retry';
import { toast } from 'sonner';
import { batchResolveImageUrls } from '@/hooks/useArticleImage';
import {
  Newspaper, Settings, RefreshCw, Eye, EyeOff, Trash2, ArrowLeft,
  Loader2, Download, ToggleLeft, ToggleRight, LogIn, ChevronDown,
  ExternalLink, Pencil, Save, X, Upload, ImageIcon, AlertCircle,
  Globe, Plus, Check, XCircle, Search, FileEdit, Tag, CalendarIcon,
  Users, Mail, Layers,
} from 'lucide-react';
import AuthorsManagement from './Authors';
import NewsletterEngine from './Newsletter';
import RichTextEditor, { sanitizeHTML } from '@/components/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';



/** Cast the unknown return of client.apiCall.invoke to access .data safely. */
function invokeData<T = Record<string, unknown>>(response: unknown): T {
  return (response as { data: T }).data;
}

const IMAGE_BUCKET = 'article-images';
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const DEFAULT_CATEGORY_NAMES = new Set([
  'general',
  'technology',
  'business',
  'world',
  'science',
  'health',
  'sports',
  'entertainment',
]);

interface Article {
  id: number;
  article_code: string | null;
  title: string;
  original_title: string | null;
  original_content: string | null;
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

interface SettingItem {
  id: number;
  setting_key: string;
  setting_value: string;
  description: string | null;
}

interface UserData {
  id: string;
  email: string;
  name?: string;
}

interface EditFormData {
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  published_at: string;
}

interface ScrapedPreview {
  url: string;
  original_title: string;
  original_content: string;
  rewritten_title: string;
  rewritten_summary: string;
  rewritten_content: string;
  source_name: string;
  image_url: string | null;
  error: string | null;
  approved: boolean;
}

interface CategoryItem {
  id: number;
  name: string;
  label: string;
}

/** Parse comma-separated tags string into array */
function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
}

/** Join tags array into comma-separated string */
function joinTags(tags: string[]): string {
  return tags.join(', ');
}

/** Format datetime string to date input value (YYYY-MM-DD) */
function toDateInputValue(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/** Check if a string is a full URL (http/https) vs an object_key */
function isFullUrl(str: string | null | undefined): boolean {
  if (!str) return false;
  return str.startsWith('http://') || str.startsWith('https://');
}

/** Tags Input Component */
function TagsInput({
  tags,
  onTagsChange,
  placeholder = 'Type a tag and press Enter',
}: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onTagsChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-white min-h-[42px] cursor-text focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, index) => (
        <Badge
          key={`${tag}-${index}`}
          variant="secondary"
          className="flex items-center gap-1 bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200 transition-colors"
        >
          <Tag className="w-3 h-3" />
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(index);
            }}
            className="ml-0.5 hover:text-red-600 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) addTag(inputValue);
        }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent placeholder:text-slate-400"
      />
    </div>
  );
}

/** Reusable category Select dropdown that reads from dynamic categories */
function CategorySelect({
  value,
  onValueChange,
  categories,
  includeAll = false,
  onCreateCategory,
  onDeleteCategory,
}: {
  value: string;
  onValueChange: (val: string) => void;
  categories: CategoryItem[];
  includeAll?: boolean;
  onCreateCategory?: (label: string) => Promise<string | null>;
  onDeleteCategory?: (cat: CategoryItem) => Promise<void>;
}) {
  const CREATE_VALUE = '__create_new_category__';

  return (
    <Select
      value={value}
      onValueChange={async (val) => {
        if (val === CREATE_VALUE) {
          if (!onCreateCategory) return;
          const label = window.prompt('Enter new category name');
          if (!label) return;
          const createdValue = await onCreateCategory(label);
          if (createdValue) onValueChange(createdValue);
          return;
        }
        onValueChange(val);
      }}
    >
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All Categories</SelectItem>}
        {categories.map((cat) => (
          <SelectItem key={cat.name} value={cat.name} className="relative pr-9">
            <span className="block truncate">{cat.label}</span>
            {!DEFAULT_CATEGORY_NAMES.has(cat.name) && onDeleteCategory && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                title={`Delete ${cat.label}`}
                onMouseDown={async (e) => {
                  // Prevent selecting category item when deleting
                  e.preventDefault();
                  e.stopPropagation();
                  await onDeleteCategory(cat);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </SelectItem>
        ))}
        <SelectItem value={CREATE_VALUE}>+ Create new category</SelectItem>
      </SelectContent>
    </Select>
  );
}

export default function Admin() {
  useSeoHead({ noIndex: true });
  const [user, setUser] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchCategory, setFetchCategory] = useState('general');
  const [fetchCount, setFetchCount] = useState('5');
  const [fetchAutoPublish, setFetchAutoPublish] = useState(false);
  const [fetchStyle, setFetchStyle] = useState('professional');
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0 });

  // Dynamic categories
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({ title: '', summary: '', content: '', category: 'general', tags: [], published_at: '' });
  const [saving, setSaving] = useState(false);

  // Image upload state (shared between edit dialog and manual submit)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Thumbnail URLs cache for article list
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});

  // Web Scraper state
  const [scrapeUrls, setScrapeUrls] = useState('');
  const [scrapeCategory, setScrapeCategory] = useState('general');
  const [scrapeStyle, setScrapeStyle] = useState('professional');
  const [scrapeWordsLength, setScrapeWordsLength] = useState('medium');
  const [scrapeAutoPublish, setScrapeAutoPublish] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapePreviews, setScrapePreviews] = useState<ScrapedPreview[]>([]);
  const [approvingScrape, setApprovingScrape] = useState(false);

  // Manual Submit state
  const [manualTitle, setManualTitle] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualCategory, setManualCategory] = useState('general');
  const [manualSourceUrl, setManualSourceUrl] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [manualPublish, setManualPublish] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualImageFile, setManualImageFile] = useState<File | null>(null);
  const [manualImagePreview, setManualImagePreview] = useState<string | null>(null);
  const [manualImageError, setManualImageError] = useState<string | null>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [manualPublishedAt, setManualPublishedAt] = useState('');

  // Article filter state
  const [filterText, setFilterText] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTagInput, setFilterTagInput] = useState('');

  // Auth check — runs on mount, then every 4 minutes to catch expired tokens.
  useEffect(() => {
    async function checkAuth(isInitial = false) {
      try {
        const userData = await client.auth.me();
        if (userData?.data) {
          setUser(userData.data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        if (isInitial) setAuthLoading(false);
      }
    }

    checkAuth(true);

    // Re-validate session every 4 minutes in the background.
    const interval = setInterval(() => checkAuth(false), 4 * 60 * 1000);

    // Any API call returning 401 also triggers this immediately.
    function onSessionExpired() {
      setUser(null);
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onSessionExpired);

    return () => {
      clearInterval(interval);
      window.removeEventListener(AUTH_EXPIRED_EVENT, onSessionExpired);
    };
  }, []);

  const handleLogin = async () => {
    await client.auth.toLogin();
  };

  // Load categories from DB
  const loadCategories = useCallback(async () => {
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
  }, []);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await client.entities.articles.query({
        query: {},
        sort: '-created_at',
        limit: 100,
      });
      const items: Article[] = response.data?.items || [];
      setArticles(items);
      const published = items.filter((a) => a.is_published).length;
      setStats({
        total: items.length,
        published,
        draft: items.length - published,
      });

      // Resolve thumbnails in background with concurrency control
      // This prevents DNS overload from too many simultaneous storage requests
      batchResolveImageUrls(
        items.map((a) => ({ id: a.id, image_url: a.image_url }))
      ).then((urlMap) => {
        setThumbnailUrls(urlMap);
      }).catch((err) => {
        console.warn('Failed to resolve some thumbnails:', err);
      });
    } catch (err) {
      console.error('Error loading articles:', err);
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/news/settings',
        method: 'GET',
      });
      setSettings((invokeData<SettingItem[]>(response)) || []);
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadArticles();
      loadSettings();
      loadCategories();
    }
  }, [user, loadArticles, loadSettings, loadCategories]);

  const handleFetchNews = async () => {
    setFetching(true);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/news/fetch-and-rewrite',
        method: 'POST',
        data: {
          category: fetchCategory,
          max_articles: parseInt(fetchCount),
          auto_publish: fetchAutoPublish,
          rewrite_style: fetchStyle,
        },
      });
      const result = invokeData<{ message?: string; total_fetched: number }>(response);
      toast.success(result.message || `Fetched ${result.total_fetched} articles`);
      await loadArticles();
    } catch (err: unknown) {
      const errorMsg = (err as { data?: { detail?: string } })?.data?.detail || 'Failed to fetch news';
      toast.error(errorMsg);
    } finally {
      setFetching(false);
    }
  };

  const handleTogglePublish = async (articleId: number, currentStatus: boolean | null) => {
    try {
      await client.apiCall.invoke({
        url: '/api/v1/news/toggle-publish',
        method: 'POST',
        data: { article_id: articleId, is_published: !currentStatus },
      });
      toast.success(`Article ${!currentStatus ? 'published' : 'unpublished'}`);
      await loadArticles();
    } catch {
      toast.error('Failed to toggle publish status');
    }
  };

  const handleDeleteArticle = async (articleId: number) => {
    try {
      await client.entities.articles.delete({ id: String(articleId) });
      toast.success('Article deleted');
      await loadArticles();
    } catch {
      toast.error('Failed to delete article');
    }
  };

  // --- Category Management ---

  const createCategory = async (inputLabel: string): Promise<string | null> => {
    const trimmed = inputLabel.trim();
    if (!trimmed) { toast.error('Category name is required'); return; }

    // Generate slug from name
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) { toast.error('Invalid category name'); return; }

    // Check for duplicates
    if (categories.some((c) => c.name === slug)) {
      toast.error('Category already exists');
      return null;
    }

    setAddingCategory(true);
    try {
      await client.entities.categories.create({
        data: {
          name: slug,
          label: trimmed,
          created_at: new Date().toISOString(),
        },
      });
      toast.success(`Category "${trimmed}" added`);
      await loadCategories();
      return slug;
    } catch {
      toast.error('Failed to add category');
      return null;
    } finally {
      setAddingCategory(false);
    }
  };

  const handleAddCategory = async () => {
    const created = await createCategory(newCategoryName);
    if (created) setNewCategoryName('');
  };

  const handleDeleteCategory = async (catId: number, catName: string) => {
    // Prevent deleting built-in default categories
    if (DEFAULT_CATEGORY_NAMES.has(catName)) {
      toast.error('Cannot delete default categories');
      return;
    }
    setDeletingCategoryId(catId);
    try {
      await client.entities.categories.delete({ id: String(catId) });
      toast.success('Category deleted');
      await loadCategories();
    } catch {
      toast.error('Failed to delete category');
    } finally {
      setDeletingCategoryId(null);
    }
  };

  // --- Edit Dialog ---

  const handleOpenEdit = async (article: Article) => {
    setEditingArticle(article);
    setEditForm({
      title: article.title,
      summary: article.summary || '',
      content: article.content,
      category: article.category || 'general',
      tags: parseTags(article.tags),
      published_at: toDateInputValue(article.published_at),
    });
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageError(null);
    setRemoveImage(false);
    setExistingImageUrl(null);

    if (article.image_url) {
      if (isFullUrl(article.image_url)) {
        setExistingImageUrl(article.image_url);
      } else {
        try {
          const dlResp = await client.storage.getDownloadUrl({
            bucket_name: IMAGE_BUCKET,
            object_key: article.image_url,
          });
          if (dlResp?.data?.download_url) {
            setExistingImageUrl(dlResp.data.download_url);
          }
        } catch {
          // ignore
        }
      }
    }
    setEditDialogOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImageError(null);
    if (!file) { setImageFile(null); setImagePreviewUrl(null); return; }
    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file (JPEG, PNG, GIF, WebP).');
      setImageFile(null); setImagePreviewUrl(null); return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError(`Image size must be under ${MAX_IMAGE_SIZE_MB}MB. Selected file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      setImageFile(null); setImagePreviewUrl(null); return;
    }
    setImageFile(file);
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreviewUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setRemoveImage(true);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveEdit = async () => {
    if (!editingArticle) return;
    setSaving(true);
    try {
      let newImageUrl: string | null | undefined = undefined;
      if (imageFile) {
        setImageUploading(true);
        try {
          const ext = imageFile.name.split('.').pop() || 'jpg';
          const objectKey = `articles/${editingArticle.id}/${Date.now()}.${ext}`;
          const uploadResp = await client.storage.getUploadUrl({ bucket_name: IMAGE_BUCKET, object_key: objectKey });
          if (uploadResp?.data?.upload_url) {
            await fetchWithRetry(uploadResp.data.upload_url, { method: 'PUT', body: imageFile, headers: { 'Content-Type': imageFile.type } }, { label: 'storage.uploadImage' });
            newImageUrl = objectKey;
          } else {
            toast.error('Failed to get upload URL');
            setSaving(false); setImageUploading(false); return;
          }
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
          toast.error('Failed to upload image');
          setSaving(false); setImageUploading(false); return;
        } finally {
          setImageUploading(false);
        }
      } else if (removeImage) {
        newImageUrl = null;
      }

      const cleanEditContent = sanitizeHTML(editForm.content);
      const updateData: Record<string, unknown> = {
        title: editForm.title,
        summary: editForm.summary,
        content: cleanEditContent,
        category: editForm.category,
        tags: joinTags(editForm.tags) || null,
      };
      if (newImageUrl !== undefined) updateData.image_url = newImageUrl;
      if (editForm.published_at) {
        updateData.published_at = new Date(editForm.published_at + 'T00:00:00').toISOString();
      }

      await client.entities.articles.update({ id: String(editingArticle.id), data: updateData });
      toast.success('Article updated successfully');
      setEditDialogOpen(false);
      setEditingArticle(null);
      await loadArticles();
    } catch {
      toast.error('Failed to update article');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      await client.apiCall.invoke({ url: '/api/v1/news/settings', method: 'PUT', data: { setting_key: key, setting_value: value } });
      toast.success('Setting updated');
      await loadSettings();
    } catch {
      toast.error('Failed to update setting');
    }
  };

  // --- Web Scraper handlers ---

  const handleScrape = async () => {
    const urls = scrapeUrls.split('\n').map((u) => u.trim()).filter((u) => u.length > 0);
    if (urls.length === 0) { toast.error('Please enter at least one URL'); return; }

    setScraping(true);
    setScrapePreviews([]);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/news/scrape',
        method: 'POST',
        data: { urls, category: scrapeCategory, rewrite_style: scrapeStyle, words_length: scrapeWordsLength, auto_publish: scrapeAutoPublish },
      });
      const result = invokeData<{ articles: ScrapedPreview[]; message?: string; total_scraped: number }>(response);
      const previews: ScrapedPreview[] = (result.articles || []).map((a: ScrapedPreview) => ({ ...a, approved: !a.error }));
      setScrapePreviews(previews);
      toast.success(result.message || `Scraped ${result.total_scraped} articles`);
    } catch (err: unknown) {
      const errorMsg = (err as { data?: { detail?: string } })?.data?.detail || 'Failed to scrape URLs';
      toast.error(errorMsg);
    } finally {
      setScraping(false);
    }
  };

  const toggleScrapeApproval = (index: number) => {
    setScrapePreviews((prev) => prev.map((p, i) => (i === index ? { ...p, approved: !p.approved } : p)));
  };

  const handleApproveAndSave = async () => {
    const approved = scrapePreviews.filter((p) => p.approved && !p.error);
    if (approved.length === 0) { toast.error('No articles selected for saving'); return; }
    setApprovingScrape(true);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/news/scrape-approve',
        method: 'POST',
        data: { articles: approved.map(({ approved: _a, ...rest }) => rest), category: scrapeCategory, auto_publish: scrapeAutoPublish },
      });
      const result = invokeData<{ message?: string; total_fetched: number }>(response);
      toast.success(result.message || `Saved ${result.total_fetched} articles`);
      setScrapePreviews([]);
      setScrapeUrls('');
      await loadArticles();
    } catch (err: unknown) {
      const errorMsg = (err as { data?: { detail?: string } })?.data?.detail || 'Failed to save articles';
      toast.error(errorMsg);
    } finally {
      setApprovingScrape(false);
    }
  };

  // --- Manual Submit handlers ---

  const handleManualImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setManualImageError(null);
    if (!file) { setManualImageFile(null); setManualImagePreview(null); return; }
    if (!file.type.startsWith('image/')) {
      setManualImageError('Please select a valid image file (JPEG, PNG, GIF, WebP).');
      setManualImageFile(null); setManualImagePreview(null); return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setManualImageError(`Image size must be under ${MAX_IMAGE_SIZE_MB}MB. Selected file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      setManualImageFile(null); setManualImagePreview(null); return;
    }
    setManualImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setManualImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleManualRemoveImage = () => {
    setManualImageFile(null);
    setManualImagePreview(null);
    setManualImageError(null);
    if (manualFileInputRef.current) manualFileInputRef.current.value = '';
  };

  const handleManualSubmit = async () => {
    if (!manualTitle.trim()) { toast.error('Title is required'); return; }
    if (!manualContent.trim()) { toast.error('Content is required'); return; }

    setManualSubmitting(true);
    try {
      let uploadedImageUrl: string | null = null;

      // Upload image if selected
      if (manualImageFile) {
        const ext = manualImageFile.name.split('.').pop() || 'jpg';
        const objectKey = `articles/manual/${Date.now()}.${ext}`;
        const uploadResp = await client.storage.getUploadUrl({ bucket_name: IMAGE_BUCKET, object_key: objectKey });
        if (uploadResp?.data?.upload_url) {
          await fetchWithRetry(uploadResp.data.upload_url, { method: 'PUT', body: manualImageFile, headers: { 'Content-Type': manualImageFile.type } }, { label: 'storage.uploadManualImage' });
          uploadedImageUrl = objectKey;
        } else {
          toast.error('Failed to upload image');
          setManualSubmitting(false);
          return;
        }
      }

      const cleanContent = sanitizeHTML(manualContent.trim());
      const response = await client.apiCall.invoke({
        url: '/api/v1/news/manual-submit',
        method: 'POST',
        data: {
          title: manualTitle.trim(),
          summary: manualSummary.trim() || null,
          content: cleanContent,
          category: manualCategory,
          source_url: manualSourceUrl.trim() || null,
          author: manualAuthor.trim() || null,
          image_url: uploadedImageUrl,
          tags: joinTags(manualTags) || null,
          published_at: manualPublishedAt || null,
          is_published: manualPublish,
        },
      });

      const result = invokeData<{ message?: string }>(response);
      toast.success(result.message || 'Article created successfully');

      // Reset form
      setManualTitle('');
      setManualSummary('');
      setManualContent('');
      setManualCategory('general');
      setManualSourceUrl('');
      setManualAuthor('');
      setManualPublish(false);
      setManualImageFile(null);
      setManualImagePreview(null);
      setManualImageError(null);
      setManualTags([]);
      setManualPublishedAt('');
      if (manualFileInputRef.current) manualFileInputRef.current.value = '';

      await loadArticles();
    } catch (err: unknown) {
      const errorMsg = (err as { data?: { detail?: string } })?.data?.detail || 'Failed to create article';
      toast.error(errorMsg);
    } finally {
      setManualSubmitting(false);
    }
  };

  // Determine the preview image to show in edit dialog
  const editPreviewImage = imagePreviewUrl ? imagePreviewUrl : removeImage ? null : existingImageUrl;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Newspaper className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Admin Panel</CardTitle>
            <CardDescription>Sign in to manage your news portal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLogin} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
            <Link to="/" className="block">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Portal
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const approvedCount = scrapePreviews.filter((p) => p.approved && !p.error).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center">
                  <Newspaper className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-extrabold tracking-tight">
                  News<span className="text-red-400">Portal</span>
                </span>
              </Link>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Admin</Badge>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Portal
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800"
                onClick={async () => { await client.auth.logout(); setUser(null); }}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
              <p className="text-sm text-slate-500">Total Articles</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-emerald-600">{stats.published}</div>
              <p className="text-sm text-slate-500">Published</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-amber-600">{stats.draft}</div>
              <p className="text-sm text-slate-500">Drafts</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="fetch" className="space-y-6">
          <TabsList className="bg-white border shadow-sm flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="fetch" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <Download className="w-4 h-4 mr-1" /> Fetch News
            </TabsTrigger>
            <TabsTrigger value="scraper" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <Globe className="w-4 h-4 mr-1" /> Web Scraper
            </TabsTrigger>
            <TabsTrigger value="manual" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <FileEdit className="w-4 h-4 mr-1" /> Manual Submit
            </TabsTrigger>
            <TabsTrigger value="articles" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <Newspaper className="w-4 h-4 mr-1" /> Articles
            </TabsTrigger>
            <TabsTrigger value="authors" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-1" /> Authors
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <Mail className="w-4 h-4 mr-1" /> Newsletter
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
              <Settings className="w-4 h-4 mr-1" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* ============ Fetch News Tab ============ */}
          <TabsContent value="fetch">
            <Card>
              <CardHeader>
                <CardTitle>Fetch & Rewrite News</CardTitle>
                <CardDescription>Fetch real-time news from sources, rewrite with AI, and store in your portal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <CategorySelect value={fetchCategory} onValueChange={setFetchCategory} categories={categories} onCreateCategory={createCategory} onDeleteCategory={async (cat) => handleDeleteCategory(cat.id, cat.name)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Articles</Label>
                    <Input type="number" min="1" max="20" value={fetchCount} onChange={(e) => setFetchCount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rewrite Style</Label>
                    <Select value={fetchStyle} onValueChange={setFetchStyle}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Auto Publish</Label>
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => setFetchAutoPublish(!fetchAutoPublish)} className="text-slate-600 hover:text-slate-900 transition-colors">
                        {fetchAutoPublish ? <ToggleRight className="w-8 h-8 text-emerald-500" /> : <ToggleLeft className="w-8 h-8" />}
                      </button>
                      <span className="text-sm text-slate-600">{fetchAutoPublish ? 'Articles will be published immediately' : 'Articles saved as drafts'}</span>
                    </div>
                  </div>
                </div>
                <Separator />
                <Button onClick={handleFetchNews} disabled={fetching} className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white" size="lg">
                  {fetching ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Fetching & Rewriting...</>) : (<><RefreshCw className="w-4 h-4 mr-2" />Fetch & Rewrite News</>)}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ Web Scraper Tab ============ */}
          <TabsContent value="scraper">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" />Real-Time Web Scraper</CardTitle>
                  <CardDescription>Enter article URLs to scrape content, rewrite with AI, then preview and approve before saving</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="font-semibold">Article URLs</Label>
                    <Textarea placeholder={"Paste one URL per line:\nhttps://example.com/article-1\nhttps://example.com/article-2"} value={scrapeUrls} onChange={(e) => setScrapeUrls(e.target.value)} rows={5} className="font-mono text-sm" />
                    <p className="text-xs text-slate-400">Enter URLs, one per line.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <CategorySelect value={scrapeCategory} onValueChange={setScrapeCategory} categories={categories} onCreateCategory={createCategory} onDeleteCategory={async (cat) => handleDeleteCategory(cat.id, cat.name)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Rewrite Style</Label>
                      <Select value={scrapeStyle} onValueChange={setScrapeStyle}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Words Length</Label>
                      <Select value={scrapeWordsLength} onValueChange={setScrapeWordsLength}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">Short (~150 words)</SelectItem>
                          <SelectItem value="medium">Medium (~300 words)</SelectItem>
                          <SelectItem value="long">Long (~500 words)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Auto Publish</Label>
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => setScrapeAutoPublish(!scrapeAutoPublish)} className="text-slate-600 hover:text-slate-900 transition-colors">
                          {scrapeAutoPublish ? <ToggleRight className="w-8 h-8 text-emerald-500" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
                        <span className="text-sm text-slate-600">{scrapeAutoPublish ? 'Publish immediately' : 'Save as drafts'}</span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <Button onClick={handleScrape} disabled={scraping || !scrapeUrls.trim()} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white" size="lg">
                    {scraping ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scraping & Rewriting...</>) : (<><Search className="w-4 h-4 mr-2" />Scrape & Rewrite</>)}
                  </Button>
                </CardContent>
              </Card>

              {/* Scrape Previews */}
              {scrapePreviews.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Scraped Articles Preview</CardTitle>
                      <CardDescription>{approvedCount} of {scrapePreviews.filter((p) => !p.error).length} selected.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setScrapePreviews([])}><X className="w-4 h-4 mr-1" />Clear</Button>
                      <Button size="sm" onClick={handleApproveAndSave} disabled={approvingScrape || approvedCount === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {approvingScrape ? (<><Loader2 className="w-4 h-4 mr-1 animate-spin" />Saving...</>) : (<><Check className="w-4 h-4 mr-1" />Save {approvedCount} Article{approvedCount !== 1 ? 's' : ''}</>)}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {scrapePreviews.map((preview, index) => (
                      <div key={index} className={`border rounded-lg p-4 transition-all ${preview.error ? 'border-red-200 bg-red-50/50' : preview.approved ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50 opacity-60'}`}>
                        {preview.error ? (
                          <div className="flex items-start gap-3">
                            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-red-700 text-sm">Failed to scrape</p>
                              <p className="text-xs text-red-600 mt-1">{preview.error}</p>
                              <a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />{preview.url}</a>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className={preview.approved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}>{preview.approved ? 'Approved' : 'Rejected'}</Badge>
                                  <span className="text-xs text-slate-400">via {preview.source_name}</span>
                                </div>
                                <h4 className="font-semibold text-slate-900">{preview.rewritten_title}</h4>
                                <p className="text-sm text-slate-500 mt-1">{preview.rewritten_summary}</p>
                              </div>
                              {preview.image_url && <img src={preview.image_url} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0 hidden sm:block" />}
                            </div>
                            <Collapsible>
                              <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="text-xs text-slate-500"><ChevronDown className="w-3 h-3 mr-1" />Show full content & original</Button></CollapsibleTrigger>
                              <CollapsibleContent className="mt-2 space-y-3">
                                <div className="bg-white rounded-lg p-3 border"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">AI Rewritten</p><p className="text-sm text-slate-700 whitespace-pre-line">{preview.rewritten_content}</p></div>
                                <div className="bg-slate-100 rounded-lg p-3"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Original Content</p><p className="font-medium text-slate-700 text-sm mb-1">{preview.original_title}</p><p className="text-xs text-slate-600 line-clamp-6">{preview.original_content}</p><a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"><ExternalLink className="w-3 h-3" />View original page</a></div>
                              </CollapsibleContent>
                            </Collapsible>
                            <div className="flex items-center gap-2 pt-1 border-t">
                              <Button variant={preview.approved ? 'default' : 'outline'} size="sm" onClick={() => toggleScrapeApproval(index)} className={preview.approved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                                {preview.approved ? (<><Check className="w-3 h-3 mr-1" />Approved</>) : (<><Plus className="w-3 h-3 mr-1" />Approve</>)}
                              </Button>
                              <a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />Source</a>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ============ Manual Submit Tab ============ */}
          <TabsContent value="manual">
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-slate-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <FileEdit className="w-5 h-5 text-violet-500" />
                  Content Editor
                </CardTitle>
                <CardDescription>
                  Create and submit a new article. Use the rich text editor for content and the sidebar for metadata.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row">
                  {/* Main Content Area */}
                  <div className="flex-1 p-6 space-y-5 min-w-0">
                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="manual-title" className="font-semibold text-slate-700">
                        Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="manual-title"
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        placeholder="Enter article title"
                        className="text-lg font-medium h-12"
                      />
                    </div>

                    {/* Summary */}
                    <div className="space-y-2">
                      <Label htmlFor="manual-summary" className="font-semibold text-slate-700">Summary</Label>
                      <Textarea
                        id="manual-summary"
                        value={manualSummary}
                        onChange={(e) => setManualSummary(e.target.value)}
                        placeholder="Brief summary for preview cards and SEO (optional)"
                        rows={3}
                      />
                    </div>

                    {/* Content - Rich Text Editor (dominant element) */}
                    <div className="space-y-2">
                      <Label className="font-semibold text-slate-700">
                        Content <span className="text-red-500">*</span>
                      </Label>
                      <RichTextEditor
                        value={manualContent}
                        onChange={setManualContent}
                        placeholder="Write the full article content here..."
                        height={500}
                      />
                    </div>
                  </div>

                  {/* Sidebar - Metadata */}
                  <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/50 shrink-0">
                    <div className="p-5 space-y-5">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Article Settings
                      </h3>

                      {/* Featured Image Upload */}
                      <div className="space-y-3">
                        <Label className="font-semibold flex items-center gap-2 text-sm">
                          <ImageIcon className="w-4 h-4" /> Featured Image
                          <span className="text-xs font-normal text-slate-400">(max {MAX_IMAGE_SIZE_MB}MB)</span>
                        </Label>
                        {manualImagePreview && (
                          <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                            <img src={manualImagePreview} alt="Preview" className="w-full h-36 object-cover" />
                            <div className="absolute top-2 right-2">
                              <Button type="button" variant="secondary" size="sm" className="h-7 text-xs bg-white/90 hover:bg-white shadow-sm" onClick={handleManualRemoveImage}>
                                <X className="w-3 h-3 mr-1" /> Remove
                              </Button>
                            </div>
                            <div className="absolute bottom-2 left-2">
                              <Badge variant="secondary" className="bg-black/60 text-white text-[10px] border-0">
                                {manualImageFile?.name}
                              </Badge>
                            </div>
                          </div>
                        )}
                        {!manualImagePreview && (
                          <div
                            className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-slate-400 transition-colors cursor-pointer bg-white"
                            onClick={() => manualFileInputRef.current?.click()}
                          >
                            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                            <p className="text-xs text-slate-600 font-medium">Click to upload</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, GIF, WebP</p>
                          </div>
                        )}
                        <input ref={manualFileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleManualImageSelect} />
                        {manualImagePreview && (
                          <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={() => manualFileInputRef.current?.click()}>
                            <Upload className="w-3 h-3 mr-1" /> Replace Image
                          </Button>
                        )}
                        {manualImageError && (
                          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">
                            <AlertCircle className="w-3 h-3 shrink-0" /> {manualImageError}
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Category */}
                      <div className="space-y-2">
                        <Label className="font-semibold text-sm">
                          Category <span className="text-red-500">*</span>
                        </Label>
                        <CategorySelect value={manualCategory} onValueChange={setManualCategory} categories={categories} onCreateCategory={createCategory} onDeleteCategory={async (cat) => handleDeleteCategory(cat.id, cat.name)} />
                      </div>

                      {/* Tags */}
                      <div className="space-y-2">
                        <Label className="font-semibold flex items-center gap-2 text-sm">
                          <Tag className="w-4 h-4" /> Tags
                        </Label>
                        <TagsInput tags={manualTags} onTagsChange={setManualTags} placeholder="Add tag..." />
                        <p className="text-[10px] text-slate-400">Press Enter or comma to add.</p>
                      </div>

                      <Separator />

                      {/* Published Date */}
                      <div className="space-y-2">
                        <Label className="font-semibold flex items-center gap-2 text-sm">
                          <CalendarIcon className="w-4 h-4" /> Published Date
                        </Label>
                        <Input
                          type="date"
                          value={manualPublishedAt}
                          onChange={(e) => setManualPublishedAt(e.target.value)}
                          className="text-sm"
                        />
                      </div>

                      {/* Author */}
                      <div className="space-y-2">
                        <Label htmlFor="manual-author" className="font-semibold text-sm">Author</Label>
                        <Input id="manual-author" value={manualAuthor} onChange={(e) => setManualAuthor(e.target.value)} placeholder="Author name (optional)" className="text-sm" />
                      </div>

                      {/* Source URL */}
                      <div className="space-y-2">
                        <Label htmlFor="manual-source" className="font-semibold text-sm">Source URL</Label>
                        <Input id="manual-source" value={manualSourceUrl} onChange={(e) => setManualSourceUrl(e.target.value)} placeholder="https://example.com" className="text-sm" />
                      </div>

                      <Separator />

                      {/* Publish toggle */}
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                        <button onClick={() => setManualPublish(!manualPublish)} className="text-slate-600 hover:text-slate-900 transition-colors shrink-0">
                          {manualPublish ? <ToggleRight className="w-7 h-7 text-emerald-500" /> : <ToggleLeft className="w-7 h-7" />}
                        </button>
                        <div>
                          <p className="text-xs font-medium text-slate-900">{manualPublish ? 'Publish immediately' : 'Save as draft'}</p>
                          <p className="text-[10px] text-slate-500">{manualPublish ? 'Visible right away' : 'Hidden until published'}</p>
                        </div>
                      </div>

                      <Separator />

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <Button
                          onClick={handleManualSubmit}
                          disabled={manualSubmitting || !manualTitle.trim() || !manualContent.trim()}
                          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                        >
                          {manualSubmitting ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                          ) : (
                            <><Save className="w-4 h-4 mr-2" />Submit Article</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full text-xs"
                          onClick={() => {
                            setManualTitle(''); setManualSummary(''); setManualContent('');
                            setManualCategory('general'); setManualSourceUrl(''); setManualAuthor('');
                            setManualPublish(false); handleManualRemoveImage();
                            setManualTags([]); setManualPublishedAt('');
                          }}
                          disabled={manualSubmitting}
                        >
                          <X className="w-3 h-3 mr-1" /> Clear Form
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ Articles Tab ============ */}
          <TabsContent value="articles">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Manage Articles</CardTitle>
                  <CardDescription>View, edit, publish, or delete articles. Use filters to narrow down results.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadArticles} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Search className="w-4 h-4" /> Filters
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Search text</Label>
                      <Input
                        placeholder="Search title, code, content..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Status</Label>
                      <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | 'published' | 'draft')}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Category</Label>
                      <CategorySelect value={filterCategory} onValueChange={setFilterCategory} categories={categories} includeAll onCreateCategory={createCategory} onDeleteCategory={async (cat) => handleDeleteCategory(cat.id, cat.name)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Tags</Label>
                      <Input
                        placeholder="Filter by tag..."
                        value={filterTagInput}
                        onChange={(e) => setFilterTagInput(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Date from</Label>
                      <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Date to</Label>
                      <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-slate-700"
                        onClick={() => {
                          setFilterText('');
                          setFilterDateFrom('');
                          setFilterDateTo('');
                          setFilterStatus('all');
                          setFilterCategory('all');
                          setFilterTagInput('');
                        }}
                      >
                        <X className="w-3 h-3 mr-1" /> Clear Filters
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Articles Table */}
                {loading ? (
                  <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
                ) : (() => {
                  const q = filterText.toLowerCase().trim();
                  const tagQ = filterTagInput.toLowerCase().trim();
                  const filtered = articles.filter((a) => {
                    // Text search
                    if (q) {
                      const searchable = [a.title, a.article_code || '', a.summary || '', a.content, a.source_name || ''].join(' ').toLowerCase();
                      if (!searchable.includes(q)) return false;
                    }
                    // Status
                    if (filterStatus === 'published' && !a.is_published) return false;
                    if (filterStatus === 'draft' && a.is_published) return false;
                    // Category
                    if (filterCategory !== 'all' && a.category !== filterCategory) return false;
                    // Tags
                    if (tagQ) {
                      const aTags = (a.tags || '').toLowerCase();
                      if (!aTags.includes(tagQ)) return false;
                    }
                    // Date range
                    if (filterDateFrom) {
                      const articleDate = a.published_at || a.created_at;
                      if (!articleDate) return false;
                      if (new Date(articleDate) < new Date(filterDateFrom + 'T00:00:00')) return false;
                    }
                    if (filterDateTo) {
                      const articleDate = a.published_at || a.created_at;
                      if (!articleDate) return false;
                      if (new Date(articleDate) > new Date(filterDateTo + 'T23:59:59')) return false;
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-500">
                        <Newspaper className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>{articles.length === 0 ? 'No articles yet. Use the Fetch News tab to get started.' : 'No articles match the current filters.'}</p>
                      </div>
                    );
                  }

                  return (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-100 border-b text-left">
                              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Code</th>
                              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-14">Image</th>
                              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[200px]">Title</th>
                              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Status</th>
                              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Category</th>
                              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px]">Tags</th>
                              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Date</th>
                              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filtered.map((article, idx) => {
                              const articleTags = parseTags(article.tags);
                              const dateStr = article.published_at || article.created_at;
                              const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                              return (
                                <tr key={article.id} className="hover:bg-slate-50/80 transition-colors group">
                                  <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="px-3 py-2.5">
                                    <span className="text-xs font-mono font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                      {article.article_code || `ART-${String(article.id).padStart(3, '0')}`}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="w-10 h-10 rounded overflow-hidden bg-slate-100 shrink-0">
                                      {thumbnailUrls[article.id] ? (
                                        <img src={thumbnailUrls[article.id]} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-slate-300" /></div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <p className="font-medium text-slate-900 line-clamp-1 text-sm">{article.title}</p>
                                    {article.summary && <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{article.summary}</p>}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <Badge variant="outline" className={`text-xs ${article.is_published ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                      {article.is_published ? 'Published' : 'Draft'}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <Badge variant="outline" className="text-xs capitalize">{article.category}</Badge>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {articleTags.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {articleTags.slice(0, 2).map((tag) => (
                                          <Badge key={tag} variant="outline" className="text-[10px] bg-violet-50 text-violet-600 border-violet-200 px-1.5 py-0">
                                            {tag}
                                          </Badge>
                                        ))}
                                        {articleTags.length > 2 && (
                                          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200 px-1.5 py-0">
                                            +{articleTags.length - 2}
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-xs text-slate-500">{formattedDate}</td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center justify-end gap-0.5">
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleOpenEdit(article)} title="Edit">
                                        <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleTogglePublish(article.id, article.is_published)} title={article.is_published ? 'Unpublish' : 'Publish'}>
                                        {article.is_published ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-500" />}
                                      </Button>
                                      {article.source_url && (
                                        <a href={article.source_url} target="_blank" rel="noopener noreferrer" title="View source">
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                          </Button>
                                        </a>
                                      )}
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDeleteArticle(article.id)} title="Delete">
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="bg-slate-50 border-t px-4 py-2 text-xs text-slate-500">
                        Showing {filtered.length} of {articles.length} articles
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ Authors Tab ============ */}
          <TabsContent value="authors">
            <AuthorsManagement />
          </TabsContent>

          {/* ============ Newsletter Tab ============ */}
          <TabsContent value="newsletter">
            <NewsletterEngine />
          </TabsContent>

          {/* ============ Settings Tab ============ */}
          <TabsContent value="settings">
            <div className="space-y-6">
              {/* Category Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-blue-500" />
                    Manage Categories
                  </CardTitle>
                  <CardDescription>Add or remove categories. These categories are used across the entire portal — homepage tabs, article forms, filters, and more.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Category */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-sm font-medium">New Category</Label>
                      <Input
                        placeholder="e.g. Politics, Finance, Lifestyle..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                      />
                    </div>
                    <Button
                      onClick={handleAddCategory}
                      disabled={addingCategory || !newCategoryName.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {addingCategory ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><Plus className="w-4 h-4 mr-1" /> Add</>
                      )}
                    </Button>
                  </div>

                  <Separator />

                  {/* Category List */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Existing Categories ({categories.length})</Label>
                    {categories.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">No categories yet. Add one above.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {categories.map((cat) => (
                          <div
                            key={cat.id}
                            className="flex items-center justify-between px-3 py-2.5 border rounded-lg bg-white hover:bg-slate-50 transition-colors group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="outline" className="text-xs capitalize shrink-0">{cat.label}</Badge>
                              <span className="text-xs text-slate-400 font-mono truncate">{cat.name}</span>
                            </div>
                            {cat.name === 'general' ? (
                              <Badge variant="secondary" className="text-[10px] shrink-0">Default</Badge>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                disabled={deletingCategoryId === cat.id}
                                title="Delete category"
                              >
                                {deletingCategoryId === cat.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Publication Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Publication Settings</CardTitle>
                  <CardDescription>Control the volume and behavior of news publication</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {settings.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Settings className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>Loading settings...</p>
                    </div>
                  ) : (
                    settings.map((setting) => (
                      <div key={setting.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg">
                        <div className="flex-1">
                          <Label className="font-semibold text-slate-900">{setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Label>
                          {setting.description && <p className="text-sm text-slate-500 mt-0.5">{setting.description}</p>}
                        </div>
                        <div className="sm:w-48">
                          {setting.setting_key === 'auto_publish' ? (
                            <Select value={setting.setting_value} onValueChange={(val) => handleUpdateSetting(setting.setting_key, val)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="true">Enabled</SelectItem><SelectItem value="false">Disabled</SelectItem></SelectContent>
                            </Select>
                          ) : setting.setting_key === 'rewrite_style' ? (
                            <Select value={setting.setting_value} onValueChange={(val) => handleUpdateSetting(setting.setting_key, val)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="professional">Professional</SelectItem><SelectItem value="casual">Casual</SelectItem><SelectItem value="formal">Formal</SelectItem></SelectContent>
                            </Select>
                          ) : setting.setting_key === 'default_category' ? (
                            <CategorySelect
                              value={setting.setting_value}
                              onValueChange={(val) => handleUpdateSetting(setting.setting_key, val)}
                              categories={categories}
                              onCreateCategory={createCategory}
                              onDeleteCategory={async (cat) => handleDeleteCategory(cat.id, cat.name)}
                            />
                          ) : (
                            <Input defaultValue={setting.setting_value} onBlur={(e) => { if (e.target.value !== setting.setting_value) handleUpdateSetting(setting.setting_key, e.target.value); }} />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Full-Screen Edit Article CMS View */}
      {editDialogOpen && editingArticle && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* CMS Header */}
          <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-800"
                onClick={() => setEditDialogOpen(false)}
                disabled={saving}
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Articles
              </Button>
              <Separator orientation="vertical" className="h-6 bg-slate-700" />
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-sm">Editing Article</span>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                  {editingArticle.article_code || `ART-${String(editingArticle.id).padStart(3, '0')}`}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editingArticle.source_url && (
                <a href={editingArticle.source_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800">
                    <ExternalLink className="w-4 h-4 mr-1" /> Source
                  </Button>
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(false)}
                disabled={saving}
                className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={saving || imageUploading}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving || imageUploading ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{imageUploading ? 'Uploading...' : 'Saving...'}</>
                ) : (
                  <><Save className="w-4 h-4 mr-1" />Save Changes</>
                )}
              </Button>
            </div>
          </div>

          {/* CMS Body - Two Column Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="max-w-4xl mx-auto space-y-5">
                {/* Original Reference (collapsible) */}
                {editingArticle.original_title && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors w-full text-left">
                        <ExternalLink className="w-4 h-4" />
                        <span className="font-medium">Original Reference</span>
                        <ChevronDown className="w-4 h-4 ml-auto" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="bg-white border border-slate-200 rounded-lg p-4 mt-2 space-y-2">
                        <p className="font-medium text-slate-700 text-sm">{editingArticle.original_title}</p>
                        {editingArticle.original_content && (
                          <p className="text-xs text-slate-500 line-clamp-3">{editingArticle.original_content}</p>
                        )}
                        {editingArticle.source_url && (
                          <a href={editingArticle.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <ExternalLink className="w-3 h-3" /> Open original article →
                          </a>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="edit-title" className="font-semibold text-slate-700">Title</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Article title"
                    className="text-lg font-medium h-12 bg-white"
                  />
                </div>

                {/* Summary */}
                <div className="space-y-2">
                  <Label htmlFor="edit-summary" className="font-semibold text-slate-700">Summary</Label>
                  <Textarea
                    id="edit-summary"
                    value={editForm.summary}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, summary: e.target.value }))}
                    placeholder="Brief summary for preview cards and SEO"
                    rows={3}
                    className="bg-white"
                  />
                </div>

                {/* Content - Rich Text Editor (dominant element) */}
                <div className="space-y-2">
                  <Label className="font-semibold text-slate-700">Content</Label>
                  <RichTextEditor
                    value={editForm.content}
                    onChange={(content) => setEditForm((prev) => ({ ...prev, content }))}
                    placeholder="Write the full article content here..."
                    height={550}
                  />
                </div>
              </div>
            </div>

            {/* Sidebar - Metadata */}
            <div className="w-80 xl:w-96 border-l border-slate-200 bg-white overflow-y-auto shrink-0">
              <div className="p-5 space-y-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Article Settings
                </h3>

                {/* Featured Image */}
                <div className="space-y-3">
                  <Label className="font-semibold flex items-center gap-2 text-sm">
                    <ImageIcon className="w-4 h-4" /> Featured Image
                    <span className="text-xs font-normal text-slate-400">(max {MAX_IMAGE_SIZE_MB}MB)</span>
                  </Label>
                  {editPreviewImage && (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={editPreviewImage} alt="Article preview" className="w-full h-40 object-cover" />
                      <div className="absolute top-2 right-2">
                        <Button type="button" variant="secondary" size="sm" className="h-7 text-xs bg-white/90 hover:bg-white shadow-sm" onClick={handleRemoveImage}>
                          <X className="w-3 h-3 mr-1" />Remove
                        </Button>
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="secondary" className="bg-black/60 text-white text-[10px] border-0">
                          {imageFile ? `New: ${imageFile.name}` : 'Current image'}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {!editPreviewImage && (
                    <div
                      className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-slate-400 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-600 font-medium">Click to upload</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, GIF, WebP</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageSelect} />
                  {editPreviewImage && (
                    <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-3 h-3 mr-1" /> Replace Image
                    </Button>
                  )}
                  {imageError && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {imageError}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Category */}
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-2 text-sm">
                    <Layers className="w-4 h-4" /> Category
                  </Label>
                  <CategorySelect
                    value={editForm.category}
                    onValueChange={(val) => setEditForm((prev) => ({ ...prev, category: val }))}
                    categories={categories}
                    onCreateCategory={createCategory}
                    onDeleteCategory={async (cat) => handleDeleteCategory(cat.id, cat.name)}
                  />
                </div>

                <Separator />

                {/* Tags */}
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-2 text-sm">
                    <Tag className="w-4 h-4" /> Tags
                  </Label>
                  <TagsInput
                    tags={editForm.tags}
                    onTagsChange={(newTags) => setEditForm((prev) => ({ ...prev, tags: newTags }))}
                    placeholder="Add tag..."
                  />
                  <p className="text-[10px] text-slate-400">Press Enter or comma to add.</p>
                </div>

                <Separator />

                {/* Published Date */}
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-2 text-sm">
                    <CalendarIcon className="w-4 h-4" /> Published Date
                  </Label>
                  <Input
                    type="date"
                    value={editForm.published_at}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, published_at: e.target.value }))}
                    className="text-sm"
                  />
                </div>

                <Separator />

                {/* Article Info */}
                <div className="space-y-3">
                  <Label className="font-semibold text-sm text-slate-700">Article Info</Label>
                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <Badge variant="outline" className={`text-[10px] ${editingArticle.is_published ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {editingArticle.is_published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Category</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{editingArticle.category}</Badge>
                    </div>
                    {editingArticle.source_name && (
                      <div className="flex justify-between">
                        <span>Source</span>
                        <span className="text-slate-700 font-medium">{editingArticle.source_name}</span>
                      </div>
                    )}
                    {editingArticle.created_at && (
                      <div className="flex justify-between">
                        <span>Created</span>
                        <span className="text-slate-700">{new Date(editingArticle.created_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Quick Actions */}
                <div className="space-y-2">
                  <Label className="font-semibold text-sm text-slate-700">Quick Actions</Label>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => {
                        handleTogglePublish(editingArticle.id, editingArticle.is_published);
                        setEditDialogOpen(false);
                      }}
                    >
                      {editingArticle.is_published ? (
                        <><EyeOff className="w-3 h-3 mr-2 text-amber-500" /> Unpublish Article</>
                      ) : (
                        <><Eye className="w-3 h-3 mr-2 text-emerald-500" /> Publish Article</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        handleDeleteArticle(editingArticle.id);
                        setEditDialogOpen(false);
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-2" /> Delete Article
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}