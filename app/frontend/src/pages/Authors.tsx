import { useState, useEffect, useCallback, useRef } from 'react';
import { client } from '@/lib/api';
import { toast } from 'sonner';
import {
  Users, Plus, Pencil, Trash2, Search, X, Save,
  Loader2, Shield, ShieldCheck, ShieldAlert, Star,
  BarChart3, FileText, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, Globe, Twitter, Linkedin, Tag, RefreshCw,
  UserCheck, UserX, ChevronDown, ChevronUp, Eye, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';



interface Author {
  id: number;
  name: string;
  email: string;
  bio: string | null;
  photo_url: string | null;
  role: string;
  expertise_tags: string | null;
  social_twitter: string | null;
  social_linkedin: string | null;
  social_website: string | null;
  is_verified: boolean | null;
  contract_status: string | null;
  payment_rate_type: string | null;
  payment_rate_value: number | null;
  total_articles: number | null;
  total_published: number | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ContentAnalysis {
  ai_score: number;
  plagiarism_score: number;
  originality_score: number;
  readability_grade: string;
  word_count: number;
  analysis_summary: string;
  suggestions: string[];
}

interface AuditLog {
  id: number;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string | null;
}

const ROLES = [
  { value: 'admin', label: 'Admin', icon: ShieldAlert, color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'editor', label: 'Editor', icon: ShieldCheck, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'senior_writer', label: 'Senior Writer', icon: Shield, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'contributor', label: 'Contributor', icon: FileText, color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'guest', label: 'Guest', icon: Star, color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

const CONTRACT_STATUSES = [
  { value: 'active', label: 'Active', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'terminated', label: 'Terminated', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'probation', label: 'Probation', color: 'bg-orange-100 text-orange-700 border-orange-200' },
];

const PAYMENT_TYPES = [
  { value: 'per_word', label: 'Per Word' },
  { value: 'per_article', label: 'Per Article' },
  { value: 'revenue_share', label: 'Revenue Share (%)' },
  { value: 'salary', label: 'Monthly Salary' },
];

function getRoleBadge(role: string) {
  const r = ROLES.find((x) => x.value === role);
  if (!r) return <Badge variant="outline" className="text-xs capitalize">{role}</Badge>;
  const Icon = r.icon;
  return (
    <Badge variant="outline" className={`text-xs ${r.color}`}>
      <Icon className="w-3 h-3 mr-1" />{r.label}
    </Badge>
  );
}

function getContractBadge(status: string | null) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  const s = CONTRACT_STATUSES.find((x) => x.value === status);
  if (!s) return <Badge variant="outline" className="text-xs capitalize">{status}</Badge>;
  return <Badge variant="outline" className={`text-xs ${s.color}`}>{s.label}</Badge>;
}

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold">{score.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function AuthorsManagement() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterContract, setFilterContract] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<Author | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', bio: '', role: 'contributor',
    expertise_tags: '', social_twitter: '', social_linkedin: '',
    social_website: '', is_verified: false, contract_status: 'active',
    payment_rate_type: 'per_article', payment_rate_value: '',
  });

  // Content analysis
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [analysisContent, setAnalysisContent] = useState('');
  const [analysisTitle, setAnalysisTitle] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ContentAnalysis | null>(null);

  // Audit logs
  const [logsOpen, setLogsOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Detail view
  const [detailAuthor, setDetailAuthor] = useState<Author | null>(null);

  // Syncing stats
  const [syncing, setSyncing] = useState(false);

  const loadAuthors = useCallback(async () => {
    setLoading(true);
    try {
      const response = await client.entities.authors.query({
        query: {},
        sort: '-created_at',
        limit: 200,
      });
      setAuthors(response.data?.items || []);
    } catch (err) {
      console.error('Error loading authors:', err);
      toast.error('Failed to load authors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuthors();
  }, [loadAuthors]);

  const logAudit = async (action: string, entityId: string, details: string) => {
    try {
      await client.apiCall.invoke({
        url: '/api/v1/author-management/audit-log',
        method: 'POST',
        data: { action, entity_type: 'author', entity_id: entityId, details },
      });
    } catch {
      // silent fail for audit
    }
  };

  const openCreateDialog = () => {
    setEditingAuthor(null);
    setForm({
      name: '', email: '', bio: '', role: 'contributor',
      expertise_tags: '', social_twitter: '', social_linkedin: '',
      social_website: '', is_verified: false, contract_status: 'active',
      payment_rate_type: 'per_article', payment_rate_value: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (author: Author) => {
    setEditingAuthor(author);
    setForm({
      name: author.name,
      email: author.email,
      bio: author.bio || '',
      role: author.role,
      expertise_tags: author.expertise_tags || '',
      social_twitter: author.social_twitter || '',
      social_linkedin: author.social_linkedin || '',
      social_website: author.social_website || '',
      is_verified: author.is_verified || false,
      contract_status: author.contract_status || 'active',
      payment_rate_type: author.payment_rate_type || 'per_article',
      payment_rate_value: author.payment_rate_value?.toString() || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }

    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        bio: form.bio.trim() || null,
        role: form.role,
        expertise_tags: form.expertise_tags.trim() || null,
        social_twitter: form.social_twitter.trim() || null,
        social_linkedin: form.social_linkedin.trim() || null,
        social_website: form.social_website.trim() || null,
        is_verified: form.is_verified,
        contract_status: form.contract_status,
        payment_rate_type: form.payment_rate_type,
        payment_rate_value: form.payment_rate_value ? parseFloat(form.payment_rate_value) : null,
        updated_at: new Date().toISOString(),
      };

      if (editingAuthor) {
        await client.entities.authors.update({ id: String(editingAuthor.id), data });
        toast.success('Author updated successfully');
        await logAudit('update', String(editingAuthor.id), `Updated author: ${form.name}`);
      } else {
        (data as Record<string, unknown>).created_at = new Date().toISOString();
        (data as Record<string, unknown>).total_articles = 0;
        (data as Record<string, unknown>).total_published = 0;
        await client.entities.authors.create({ data });
        toast.success('Author created successfully');
        await logAudit('create', '0', `Created author: ${form.name}`);
      }

      setDialogOpen(false);
      await loadAuthors();
    } catch {
      toast.error('Failed to save author');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (author: Author) => {
    try {
      await client.entities.authors.delete({ id: String(author.id) });
      toast.success(`Author "${author.name}" deleted`);
      await logAudit('delete', String(author.id), `Deleted author: ${author.name}`);
      await loadAuthors();
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(author.id); return n; });
    } catch {
      toast.error('Failed to delete author');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await client.apiCall.invoke({
        url: '/api/v1/entities/authors/batch',
        method: 'DELETE',
        data: { ids },
      });
      toast.success(`Deleted ${ids.length} author(s)`);
      await logAudit('delete', ids.join(','), `Bulk deleted ${ids.length} authors`);
      setSelectedIds(new Set());
      await loadAuthors();
    } catch {
      toast.error('Failed to bulk delete');
    }
  };

  const handleBulkVerify = async (verified: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      const items = Array.from(selectedIds).map((id) => ({
        id,
        updates: { is_verified: verified },
      }));
      await client.apiCall.invoke({
        url: '/api/v1/entities/authors/batch',
        method: 'PUT',
        data: { items },
      });
      toast.success(`${verified ? 'Verified' : 'Unverified'} ${items.length} author(s)`);
      setSelectedIds(new Set());
      await loadAuthors();
    } catch {
      toast.error('Failed to update verification status');
    }
  };

  const handleSyncStats = async () => {
    setSyncing(true);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/author-management/sync-author-stats',
        method: 'POST',
      });
      const result = response.data;
      toast.success(`Synced stats for ${result.updated_count} authors`);
      await loadAuthors();
    } catch {
      toast.error('Failed to sync stats');
    } finally {
      setSyncing(false);
    }
  };

  const handleAnalyzeContent = async () => {
    if (!analysisContent.trim() || analysisContent.trim().length < 50) {
      toast.error('Content must be at least 50 characters');
      return;
    }
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/author-management/content-analysis',
        method: 'POST',
        data: { content: analysisContent, title: analysisTitle || null },
      });
      setAnalysisResult(response.data);
    } catch {
      toast.error('Content analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const loadAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/author-management/audit-logs',
        method: 'GET',
        data: { entity_type: 'author', limit: 50 },
      });
      setAuditLogs(response.data?.items || []);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAuthors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAuthors.map((a) => a.id)));
    }
  };

  // Filter authors
  const q = searchText.toLowerCase().trim();
  const filteredAuthors = authors.filter((a) => {
    if (q) {
      const searchable = [a.name, a.email, a.bio || '', a.expertise_tags || ''].join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    if (filterRole !== 'all' && a.role !== filterRole) return false;
    if (filterContract !== 'all' && a.contract_status !== filterContract) return false;
    return true;
  });

  // Stats
  const totalAuthors = authors.length;
  const activeAuthors = authors.filter((a) => a.contract_status === 'active').length;
  const verifiedAuthors = authors.filter((a) => a.is_verified).length;
  const totalArticlesByAuthors = authors.reduce((sum, a) => sum + (a.total_articles || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{totalAuthors}</div>
                <p className="text-xs text-slate-500">Total Authors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">{activeAuthors}</div>
                <p className="text-xs text-slate-500">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-violet-600">{verifiedAuthors}</div>
                <p className="text-xs text-slate-500">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">{totalArticlesByAuthors}</div>
                <p className="text-xs text-slate-500">Total Articles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search authors..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
                {searchText && (
                  <button onClick={() => setSearchText('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterContract} onValueChange={setFilterContract}>
                <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {CONTRACT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.size > 0 && (
                <>
                  <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleBulkVerify(true)}>
                    <UserCheck className="w-3.5 h-3.5 mr-1" /> Verify
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleBulkVerify(false)}>
                    <UserX className="w-3.5 h-3.5 mr-1" /> Unverify
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleBulkDelete}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                </>
              )}
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSyncStats} disabled={syncing}>
                {syncing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                Sync Stats
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setAnalysisDialogOpen(true); setAnalysisResult(null); setAnalysisContent(''); setAnalysisTitle(''); }}>
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Content Analysis
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setLogsOpen(true); loadAuditLogs(); }}>
                <BarChart3 className="w-3.5 h-3.5 mr-1" /> Audit Logs
              </Button>
              <Button size="sm" className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white" onClick={openCreateDialog}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Author
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authors Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-600" />
            Authors Directory
          </CardTitle>
          <CardDescription>
            Showing {filteredAuthors.length} of {authors.length} authors
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : filteredAuthors.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>{authors.length === 0 ? 'No authors yet. Click "Add Author" to get started.' : 'No authors match the current filters.'}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b text-left">
                      <th className="px-3 py-2.5 w-10">
                        <Checkbox
                          checked={selectedIds.size === filteredAuthors.length && filteredAuthors.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[180px]">Author</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Role</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Status</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Verified</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px]">Expertise</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 text-center">Articles</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Payment</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Social</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAuthors.map((author) => {
                      const tags = parseTags(author.expertise_tags);
                      const payType = PAYMENT_TYPES.find((p) => p.value === author.payment_rate_type);
                      const payLabel = payType ? payType.label : author.payment_rate_type || '—';
                      const payValue = author.payment_rate_value != null ? (
                        author.payment_rate_type === 'per_word' ? `$${author.payment_rate_value}/word` :
                        author.payment_rate_type === 'revenue_share' ? `${author.payment_rate_value}%` :
                        `$${author.payment_rate_value.toLocaleString()}`
                      ) : '—';

                      return (
                        <tr key={author.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-3 py-2.5">
                            <Checkbox
                              checked={selectedIds.has(author.id)}
                              onCheckedChange={() => toggleSelect(author.id)}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0">
                                {author.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <button
                                  onClick={() => setDetailAuthor(author)}
                                  className="font-medium text-slate-900 hover:text-blue-600 transition-colors text-left truncate block max-w-[200px]"
                                >
                                  {author.name}
                                </button>
                                <p className="text-xs text-slate-400 truncate max-w-[200px]">{author.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">{getRoleBadge(author.role)}</td>
                          <td className="px-3 py-2.5">{getContractBadge(author.contract_status)}</td>
                          <td className="px-3 py-2.5 text-center">
                            {author.is_verified ? (
                              <CheckCircle2 className="w-4 h-4 text-blue-500 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 px-1.5 py-0">
                                    {tag}
                                  </Badge>
                                ))}
                                {tags.length > 2 && (
                                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200 px-1.5 py-0">
                                    +{tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="text-sm font-semibold text-slate-900">{author.total_articles || 0}</div>
                            <div className="text-[10px] text-emerald-600">{author.total_published || 0} published</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-xs text-slate-600">{payValue}</div>
                            <div className="text-[10px] text-slate-400">{payLabel}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              {author.social_twitter && (
                                <a href={`https://x.com/${author.social_twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" title={author.social_twitter}>
                                  <Twitter className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 transition-colors" />
                                </a>
                              )}
                              {author.social_linkedin && (
                                <a href={author.social_linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn">
                                  <Linkedin className="w-3.5 h-3.5 text-slate-400 hover:text-blue-700 transition-colors" />
                                </a>
                              )}
                              {author.social_website && (
                                <a href={author.social_website} target="_blank" rel="noopener noreferrer" title="Website">
                                  <Globe className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-600 transition-colors" />
                                </a>
                              )}
                              {!author.social_twitter && !author.social_linkedin && !author.social_website && (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailAuthor(author)} title="View">
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(author)} title="Edit">
                                <Pencil className="w-3.5 h-3.5 text-blue-500" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(author)} title="Delete">
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
                Showing {filteredAuthors.length} of {authors.length} authors
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Author Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAuthor ? 'Edit Author' : 'Add New Author'}</DialogTitle>
            <DialogDescription>
              {editingAuthor ? 'Update author profile information.' : 'Create a new author profile for your portal.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold">Name <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Email <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Bio</Label>
              <Textarea value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} placeholder="Author biography..." rows={3} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold">Role <span className="text-red-500">*</span></Label>
                <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Contract Status</Label>
                <Select value={form.contract_status} onValueChange={(v) => setForm((p) => ({ ...p, contract_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold flex items-center gap-2"><Tag className="w-4 h-4" /> Expertise Tags</Label>
              <Input value={form.expertise_tags} onChange={(e) => setForm((p) => ({ ...p, expertise_tags: e.target.value }))} placeholder="technology, AI, startups (comma-separated)" />
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold">Payment Type</Label>
                <Select value={form.payment_rate_type} onValueChange={(v) => setForm((p) => ({ ...p, payment_rate_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Payment Rate</Label>
                <Input type="number" step="0.01" value={form.payment_rate_value} onChange={(e) => setForm((p) => ({ ...p, payment_rate_value: e.target.value }))} placeholder="e.g. 250" />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="font-semibold">Social Links</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 flex items-center gap-1"><Twitter className="w-3 h-3" /> Twitter/X</Label>
                  <Input value={form.social_twitter} onChange={(e) => setForm((p) => ({ ...p, social_twitter: e.target.value }))} placeholder="@handle" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 flex items-center gap-1"><Linkedin className="w-3 h-3" /> LinkedIn</Label>
                  <Input value={form.social_linkedin} onChange={(e) => setForm((p) => ({ ...p, social_linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 flex items-center gap-1"><Globe className="w-3 h-3" /> Website</Label>
                  <Input value={form.social_website} onChange={(e) => setForm((p) => ({ ...p, social_website: e.target.value }))} placeholder="https://..." />
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50">
              <Checkbox
                checked={form.is_verified}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, is_verified: checked === true }))}
              />
              <div>
                <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" /> Verified Author
                </p>
                <p className="text-xs text-slate-500">Display a verification badge on this author's profile and bylines</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
              {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-1" /> {editingAuthor ? 'Update' : 'Create'} Author</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Author Detail Dialog */}
      <Dialog open={!!detailAuthor} onOpenChange={(open) => { if (!open) setDetailAuthor(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailAuthor && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white font-bold text-xl shrink-0">
                    {detailAuthor.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      {detailAuthor.name}
                      {detailAuthor.is_verified && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
                    </DialogTitle>
                    <DialogDescription>{detailAuthor.email}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {getRoleBadge(detailAuthor.role)}
                  {getContractBadge(detailAuthor.contract_status)}
                </div>

                {detailAuthor.bio && (
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">Bio</Label>
                    <p className="text-sm text-slate-700 mt-1">{detailAuthor.bio}</p>
                  </div>
                )}

                {detailAuthor.expertise_tags && (
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">Expertise</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {parseTags(detailAuthor.expertise_tags).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs bg-violet-50 text-violet-600 border-violet-200">
                          <Tag className="w-3 h-3 mr-1" />{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-slate-900">{detailAuthor.total_articles || 0}</div>
                    <p className="text-xs text-slate-500">Total Articles</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{detailAuthor.total_published || 0}</div>
                    <p className="text-xs text-slate-500">Published</p>
                  </div>
                </div>

                {detailAuthor.payment_rate_type && (
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">Compensation</Label>
                    <p className="text-sm text-slate-700 mt-1">
                      {PAYMENT_TYPES.find((p) => p.value === detailAuthor.payment_rate_type)?.label || detailAuthor.payment_rate_type}
                      {detailAuthor.payment_rate_value != null && (
                        <span className="font-semibold ml-1">
                          {detailAuthor.payment_rate_type === 'per_word' ? `$${detailAuthor.payment_rate_value}/word` :
                           detailAuthor.payment_rate_type === 'revenue_share' ? `${detailAuthor.payment_rate_value}%` :
                           `$${detailAuthor.payment_rate_value.toLocaleString()}`}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {detailAuthor.social_twitter && (
                    <a href={`https://x.com/${detailAuthor.social_twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                      <Twitter className="w-4 h-4" /> {detailAuthor.social_twitter}
                    </a>
                  )}
                  {detailAuthor.social_linkedin && (
                    <a href={detailAuthor.social_linkedin} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
                      <Linkedin className="w-4 h-4" /> LinkedIn
                    </a>
                  )}
                  {detailAuthor.social_website && (
                    <a href={detailAuthor.social_website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-emerald-600 hover:underline">
                      <Globe className="w-4 h-4" /> Website
                    </a>
                  )}
                </div>

                <div className="text-xs text-slate-400">
                  Created: {detailAuthor.created_at ? new Date(detailAuthor.created_at).toLocaleDateString() : '—'} •
                  Updated: {detailAuthor.updated_at ? new Date(detailAuthor.updated_at).toLocaleDateString() : '—'}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setDetailAuthor(null); openEditDialog(detailAuthor); }}>
                  <Pencil className="w-4 h-4 mr-1" /> Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Content Analysis Dialog */}
      <Dialog open={analysisDialogOpen} onOpenChange={setAnalysisDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" /> AI Content Analysis
            </DialogTitle>
            <DialogDescription>
              Analyze article content for AI detection, plagiarism risk, readability, and quality scoring.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-semibold">Title (optional)</Label>
              <Input value={analysisTitle} onChange={(e) => setAnalysisTitle(e.target.value)} placeholder="Article title" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Content <span className="text-red-500">*</span></Label>
              <Textarea value={analysisContent} onChange={(e) => setAnalysisContent(e.target.value)} placeholder="Paste article content here (min 50 characters)..." rows={8} className="font-mono text-sm" />
              <p className="text-xs text-slate-400">{analysisContent.split(/\s+/).filter(Boolean).length} words</p>
            </div>

            <Button onClick={handleAnalyzeContent} disabled={analyzing || analysisContent.trim().length < 50} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
              {analyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <><Sparkles className="w-4 h-4 mr-2" /> Analyze Content</>}
            </Button>

            {analysisResult && (
              <div className="space-y-4 pt-2">
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-slate-900">{analysisResult.word_count}</div>
                    <p className="text-xs text-slate-500">Word Count</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{analysisResult.readability_grade}</div>
                    <p className="text-xs text-slate-500">Readability Grade</p>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50 rounded-lg p-4">
                  <ScoreBar label="AI Detection Score" score={analysisResult.ai_score} color={analysisResult.ai_score > 70 ? 'bg-red-500' : analysisResult.ai_score > 40 ? 'bg-amber-500' : 'bg-emerald-500'} />
                  <ScoreBar label="Plagiarism Risk" score={analysisResult.plagiarism_score} color={analysisResult.plagiarism_score > 50 ? 'bg-red-500' : analysisResult.plagiarism_score > 25 ? 'bg-amber-500' : 'bg-emerald-500'} />
                  <ScoreBar label="Originality Score" score={analysisResult.originality_score} color={analysisResult.originality_score > 70 ? 'bg-emerald-500' : analysisResult.originality_score > 40 ? 'bg-amber-500' : 'bg-red-500'} />
                </div>

                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">Analysis Summary</Label>
                  <p className="text-sm text-slate-700 mt-1">{analysisResult.analysis_summary}</p>
                </div>

                {analysisResult.suggestions.length > 0 && (
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">Suggestions</Label>
                    <ul className="mt-1 space-y-1.5">
                      {analysisResult.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-600" /> Author Audit Logs
            </DialogTitle>
            <DialogDescription>Recent actions on author profiles.</DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {logsLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No audit logs yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg bg-slate-50/50">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      log.action === 'create' ? 'bg-emerald-100' :
                      log.action === 'update' ? 'bg-blue-100' :
                      log.action === 'delete' ? 'bg-red-100' : 'bg-slate-100'
                    }`}>
                      {log.action === 'create' ? <Plus className="w-4 h-4 text-emerald-600" /> :
                       log.action === 'update' ? <Pencil className="w-4 h-4 text-blue-600" /> :
                       log.action === 'delete' ? <Trash2 className="w-4 h-4 text-red-600" /> :
                       <FileText className="w-4 h-4 text-slate-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{log.action}</Badge>
                        <span className="text-xs text-slate-400">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                        </span>
                      </div>
                      {log.details && <p className="text-sm text-slate-600 mt-0.5">{log.details}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}