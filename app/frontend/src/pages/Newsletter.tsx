import { useState, useEffect, useCallback } from 'react';
import { client } from '@/lib/api';
import { toast } from 'sonner';
import {
  Mail, BarChart3, Users, FileText, Send, Clock, FlaskConical,
  Settings, RefreshCw, Loader2, Plus, Trash2, Search, X, Save,
  Eye, Download, Upload, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, MousePointerClick, MailOpen, UserPlus, ArrowRight,
  Zap, Beaker, Trophy, ChevronDown, ChevronUp, Copy, MailX,
} from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';



interface DashboardStats {
  total_subscribers: number;
  active_subscribers: number;
  pending_subscribers: number;
  unsubscribed_count: number;
  bounced_count: number;
  total_sent: number;
  total_pending: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  active_templates: number;
}

interface Subscriber {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  email_verified: boolean | null;
  timezone: string | null;
  preferred_send_time: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface NewsletterTemplate {
  id: number;
  name: string;
  template_key: string;
  description: string | null;
  html_content: string | null;
  preview_style: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

interface QueueItem {
  id: number;
  subscriber_id: number;
  subject: string | null;
  template_key: string | null;
  article_ids: string | null;
  scheduled_date: string | null;
  status: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  ab_test_id: number | null;
  ab_variant: string | null;
  created_at: string | null;
}

interface PublishedArticle {
  id: number;
  title: string;
  summary: string;
  category: string;
  published_at: string;
  slug: string;
}

interface Campaign {
  subject: string;
  template_key: string;
  scheduled_date: string;
  total_recipients: number;
  sent: number;
  opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
}

interface ABTestResult {
  ab_test_id: number;
  variants: {
    A: { sent: number; opened: number; clicked: number; open_rate: number; click_rate: number };
    B: { sent: number; opened: number; clicked: number; open_rate: number; click_rate: number };
  };
  winner: string;
  total_recipients: number;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    unsubscribed: 'bg-slate-100 text-slate-600 border-slate-200',
    bounced: 'bg-red-100 text-red-700 border-red-200',
    sent: 'bg-blue-100 text-blue-700 border-blue-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
    skipped_duplicate: 'bg-orange-100 text-orange-700 border-orange-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <Badge variant="outline" className={`text-xs capitalize ${styles[status] || 'bg-slate-50 text-slate-500'}`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

function StatCard({ icon: Icon, label, value, color, subtext }: {
  icon: React.ElementType; label: string; value: string | number; color: string; subtext?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <p className="text-xs text-slate-500">{label}</p>
            {subtext && <p className="text-[10px] text-slate-400">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NewsletterEngine() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [abTests, setAbTests] = useState<ABTestResult[]>([]);
  const [publishedArticles, setPublishedArticles] = useState<PublishedArticle[]>([]);
  const [loading, setLoading] = useState(false);

  // Subscriber filters
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('all');

  // Compose state
  const [composeSubject, setComposeSubject] = useState('');
  const [composeTemplate, setComposeTemplate] = useState('');
  const [composeArticleIds, setComposeArticleIds] = useState<Set<number>>(new Set());
  const [composeDate, setComposeDate] = useState(new Date().toISOString().split('T')[0]);
  const [composing, setComposing] = useState(false);

  // A/B Test state
  const [abSubjectA, setAbSubjectA] = useState('');
  const [abSubjectB, setAbSubjectB] = useState('');
  const [abTemplateA, setAbTemplateA] = useState('');
  const [abTemplateB, setAbTemplateB] = useState('');
  const [abArticleIds, setAbArticleIds] = useState<Set<number>>(new Set());
  const [abDate, setAbDate] = useState(new Date().toISOString().split('T')[0]);
  const [abPercent, setAbPercent] = useState('20');
  const [creatingAb, setCreatingAb] = useState(false);

  // Add subscriber dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newSubEmail, setNewSubEmail] = useState('');
  const [newSubFirst, setNewSubFirst] = useState('');
  const [newSubLast, setNewSubLast] = useState('');
  const [addingSub, setAddingSub] = useState(false);

  // Template preview
  const [previewTemplate, setPreviewTemplate] = useState<NewsletterTemplate | null>(null);

  // Processing queue
  const [processing, setProcessing] = useState(false);

  // Bulk import
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const resp = await client.apiCall.invoke({ url: '/api/v1/newsletter/dashboard', method: 'GET' });
      setStats(resp.data);
    } catch (err) {
      console.error('Dashboard error:', err);
    }
  }, []);

  const loadSubscribers = useCallback(async () => {
    try {
      const resp = await client.entities.subscribers.query({ query: {}, sort: '-created_at', limit: 200 });
      setSubscribers(resp.data?.items || []);
    } catch (err) {
      console.error('Subscribers error:', err);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const resp = await client.entities.newsletter_templates.query({ query: {}, sort: 'template_key', limit: 20 });
      setTemplates(resp.data?.items || []);
    } catch (err) {
      console.error('Templates error:', err);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const resp = await client.entities.newsletter_queue.query({ query: {}, sort: '-created_at', limit: 100 });
      setQueueItems(resp.data?.items || []);
    } catch (err) {
      console.error('Queue error:', err);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const resp = await client.apiCall.invoke({ url: '/api/v1/newsletter/recent-campaigns', method: 'GET' });
      setCampaigns(resp.data || []);
    } catch (err) {
      console.error('Campaigns error:', err);
    }
  }, []);

  const loadAbTests = useCallback(async () => {
    try {
      const resp = await client.apiCall.invoke({ url: '/api/v1/newsletter/ab-tests', method: 'GET' });
      setAbTests(resp.data || []);
    } catch (err) {
      console.error('AB tests error:', err);
    }
  }, []);

  const loadPublishedArticles = useCallback(async () => {
    try {
      const resp = await client.apiCall.invoke({ url: '/api/v1/newsletter/published-articles', method: 'GET' });
      setPublishedArticles(resp.data || []);
    } catch (err) {
      console.error('Articles error:', err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadDashboard(), loadSubscribers(), loadTemplates(),
      loadQueue(), loadCampaigns(), loadAbTests(), loadPublishedArticles(),
    ]);
    setLoading(false);
  }, [loadDashboard, loadSubscribers, loadTemplates, loadQueue, loadCampaigns, loadAbTests, loadPublishedArticles]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---- Handlers ----
  const handleAddSubscriber = async () => {
    if (!newSubEmail.trim() || !newSubEmail.includes('@')) {
      toast.error('Valid email is required');
      return;
    }
    setAddingSub(true);
    try {
      const resp = await client.apiCall.invoke({
        url: '/api/v1/newsletter/subscribe',
        method: 'POST',
        data: { email: newSubEmail.trim(), first_name: newSubFirst.trim(), last_name: newSubLast.trim() },
      });
      toast.success(resp.data?.message || 'Subscriber added');
      setAddDialogOpen(false);
      setNewSubEmail(''); setNewSubFirst(''); setNewSubLast('');
      await loadSubscribers();
      await loadDashboard();
    } catch {
      toast.error('Failed to add subscriber');
    } finally {
      setAddingSub(false);
    }
  };

  const handleDeleteSubscriber = async (id: number) => {
    try {
      await client.entities.subscribers.delete({ id: String(id) });
      toast.success('Subscriber removed');
      await loadSubscribers();
      await loadDashboard();
    } catch {
      toast.error('Failed to delete subscriber');
    }
  };

  const handleUpdateSubscriberStatus = async (id: number, newStatus: string) => {
    try {
      await client.entities.subscribers.update({
        id: String(id),
        data: { status: newStatus, updated_at: new Date().toISOString() },
      });
      toast.success(`Status updated to ${newStatus}`);
      await loadSubscribers();
      await loadDashboard();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleToggleTemplate = async (tpl: NewsletterTemplate) => {
    try {
      await client.entities.newsletter_templates.update({
        id: String(tpl.id),
        data: { is_active: !tpl.is_active },
      });
      toast.success(`Template ${!tpl.is_active ? 'activated' : 'deactivated'}`);
      await loadTemplates();
    } catch {
      toast.error('Failed to update template');
    }
  };

  const handleCompose = async () => {
    if (!composeSubject.trim()) { toast.error('Subject is required'); return; }
    if (!composeTemplate) { toast.error('Select a template'); return; }
    if (composeArticleIds.size === 0) { toast.error('Select at least one article'); return; }

    setComposing(true);
    try {
      const resp = await client.apiCall.invoke({
        url: '/api/v1/newsletter/compose',
        method: 'POST',
        data: {
          subject: composeSubject.trim(),
          template_key: composeTemplate,
          article_ids: Array.from(composeArticleIds),
          scheduled_date: composeDate,
        },
      });
      toast.success(resp.data?.message || 'Newsletter queued');
      setComposeSubject(''); setComposeArticleIds(new Set());
      await loadQueue();
      await loadDashboard();
    } catch {
      toast.error('Failed to compose newsletter');
    } finally {
      setComposing(false);
    }
  };

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const resp = await client.apiCall.invoke({
        url: '/api/v1/newsletter/process-queue',
        method: 'POST',
        data: { batch_size: 50 },
      });
      const r = resp.data;
      toast.success(`Processed: ${r.sent} sent, ${r.failed} failed`);
      await loadQueue();
      await loadDashboard();
      await loadCampaigns();
    } catch {
      toast.error('Failed to process queue');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateAbTest = async () => {
    if (!abSubjectA.trim() || !abSubjectB.trim()) { toast.error('Both subjects required'); return; }
    if (!abTemplateA || !abTemplateB) { toast.error('Both templates required'); return; }
    if (abArticleIds.size === 0) { toast.error('Select at least one article'); return; }

    setCreatingAb(true);
    try {
      const resp = await client.apiCall.invoke({
        url: '/api/v1/newsletter/ab-test',
        method: 'POST',
        data: {
          subject_a: abSubjectA.trim(),
          subject_b: abSubjectB.trim(),
          template_key_a: abTemplateA,
          template_key_b: abTemplateB,
          article_ids: Array.from(abArticleIds),
          scheduled_date: abDate,
          test_percentage: parseInt(abPercent),
        },
      });
      toast.success(resp.data?.message || 'A/B test created');
      setAbSubjectA(''); setAbSubjectB(''); setAbArticleIds(new Set());
      await loadQueue();
      await loadAbTests();
    } catch {
      toast.error('Failed to create A/B test');
    } finally {
      setCreatingAb(false);
    }
  };

  const handleBulkImport = async () => {
    const lines = importText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) { toast.error('No data to import'); return; }

    setImporting(true);
    try {
      const subs = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return { email: parts[0] || '', first_name: parts[1] || '', last_name: parts[2] || '', timezone: 'America/New_York' };
      });
      const resp = await client.apiCall.invoke({
        url: '/api/v1/newsletter/bulk-import',
        method: 'POST',
        data: { subscribers: subs },
      });
      const r = resp.data;
      toast.success(`Imported: ${r.imported}, Skipped: ${r.skipped}`);
      setImportDialogOpen(false);
      setImportText('');
      await loadSubscribers();
      await loadDashboard();
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleExportSubscribers = async () => {
    try {
      const resp = await client.apiCall.invoke({ url: '/api/v1/newsletter/export-subscribers', method: 'GET' });
      const data = resp.data || [];
      const csv = ['email,first_name,last_name,status,timezone,created_at',
        ...data.map((s: Record<string, string>) => `${s.email},${s.first_name},${s.last_name},${s.status},${s.timezone},${s.created_at}`)
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'subscribers_export.csv'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported subscribers');
    } catch {
      toast.error('Export failed');
    }
  };

  const toggleComposeArticle = (id: number) => {
    setComposeArticleIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAbArticle = (id: number) => {
    setAbArticleIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // Filter subscribers
  const filteredSubs = subscribers.filter(s => {
    const q = subSearch.toLowerCase().trim();
    if (q) {
      const searchable = [s.email, s.first_name || '', s.last_name || ''].join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    if (subStatusFilter !== 'all' && s.status !== subStatusFilter) return false;
    return true;
  });

  const activeTemplates = templates.filter(t => t.is_active);
  const pendingQueueCount = queueItems.filter(q => q.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Mock Email Service</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Emails are simulated — no real emails are sent. Queue processing generates mock open/click tracking data for demonstration purposes.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border shadow-sm flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-1" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-1" /> Subscribers
          </TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-1" /> Templates
          </TabsTrigger>
          <TabsTrigger value="compose" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <Send className="w-4 h-4 mr-1" /> Compose
          </TabsTrigger>
          <TabsTrigger value="queue" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <Clock className="w-4 h-4 mr-1" /> Queue {pendingQueueCount > 0 && <Badge className="ml-1 bg-amber-500 text-white text-[10px] px-1.5">{pendingQueueCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="ab-testing" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <FlaskConical className="w-4 h-4 mr-1" /> A/B Testing
          </TabsTrigger>
        </TabsList>

        {/* ============ Dashboard ============ */}
        <TabsContent value="dashboard">
          <div className="space-y-6">
            {loading || !stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Active Subscribers" value={stats.active_subscribers} color="bg-emerald-100 text-emerald-600" subtext={`${stats.total_subscribers} total`} />
                  <StatCard icon={MailOpen} label="Open Rate" value={`${stats.open_rate}%`} color="bg-blue-100 text-blue-600" subtext={`${stats.total_sent} sent`} />
                  <StatCard icon={MousePointerClick} label="Click Rate" value={`${stats.click_rate}%`} color="bg-violet-100 text-violet-600" />
                  <StatCard icon={MailX} label="Bounce Rate" value={`${stats.bounce_rate}%`} color="bg-red-100 text-red-600" subtext={`${stats.bounced_count} bounced`} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard icon={UserPlus} label="Pending" value={stats.pending_subscribers} color="bg-amber-100 text-amber-600" />
                  <StatCard icon={Clock} label="In Queue" value={stats.total_pending} color="bg-orange-100 text-orange-600" />
                  <StatCard icon={Send} label="Total Sent" value={stats.total_sent} color="bg-sky-100 text-sky-600" />
                  <StatCard icon={FileText} label="Active Templates" value={stats.active_templates} color="bg-indigo-100 text-indigo-600" />
                </div>
              </>
            )}

            {/* Recent Campaigns */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Recent Campaigns</CardTitle>
                  <CardDescription>Latest newsletter sends and their performance</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => { loadCampaigns(); loadDashboard(); }}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Mail className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">No campaigns yet. Compose and send your first newsletter!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {campaigns.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{c.subject}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-400">{c.scheduled_date}</span>
                            <Badge variant="outline" className="text-[10px]">{c.template_key}</Badge>
                            <span className="text-xs text-slate-500">{c.total_recipients} recipients</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm shrink-0">
                          <div className="text-center">
                            <div className="font-semibold text-blue-600">{c.open_rate}%</div>
                            <div className="text-[10px] text-slate-400">Opens</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-violet-600">{c.click_rate}%</div>
                            <div className="text-[10px] text-slate-400">Clicks</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-slate-700">{c.sent}</div>
                            <div className="text-[10px] text-slate-400">Sent</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ Subscribers ============ */}
        <TabsContent value="subscribers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-600" /> Subscriber Management
                </CardTitle>
                <CardDescription>Manage your newsletter subscribers. {subscribers.length} total.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-1" /> Import
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportSubscribers}>
                  <Download className="w-4 h-4 mr-1" /> Export
                </Button>
                <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search subscribers..." value={subSearch} onChange={e => setSubSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                </div>
                <Select value={subStatusFilter} onValueChange={setSubStatusFilter}>
                  <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              {filteredSubs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>{subscribers.length === 0 ? 'No subscribers yet.' : 'No subscribers match filters.'}</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 border-b text-left">
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[200px]">Email</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Name</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Status</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Verified</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Timezone</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Joined</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSubs.map(sub => (
                          <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2.5 font-medium text-slate-900">{sub.email}</td>
                            <td className="px-3 py-2.5 text-slate-600">{[sub.first_name, sub.last_name].filter(Boolean).join(' ') || '—'}</td>
                            <td className="px-3 py-2.5"><StatusBadge status={sub.status} /></td>
                            <td className="px-3 py-2.5 text-center">
                              {sub.email_verified ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">{sub.timezone || '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">{sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                {sub.status === 'active' && (
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleUpdateSubscriberStatus(sub.id, 'unsubscribed')}>
                                    Unsub
                                  </Button>
                                )}
                                {sub.status === 'unsubscribed' && (
                                  <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => handleUpdateSubscriberStatus(sub.id, 'active')}>
                                    Reactivate
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDeleteSubscriber(sub.id)}>
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-slate-50 border-t px-4 py-2 text-xs text-slate-500">
                    Showing {filteredSubs.length} of {subscribers.length} subscribers
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Templates ============ */}
        <TabsContent value="templates">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Newsletter Templates</h3>
                <p className="text-sm text-slate-500">{templates.length} templates available, {activeTemplates.length} active</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(tpl => (
                <Card key={tpl.id} className={`transition-all ${tpl.is_active ? 'border-emerald-200 shadow-sm' : 'opacity-60 border-slate-200'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{tpl.name}</CardTitle>
                      <Badge variant="outline" className={`text-[10px] ${tpl.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500'}`}>
                        {tpl.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">{tpl.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{tpl.preview_style}</Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">{tpl.template_key}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setPreviewTemplate(tpl)}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                      </Button>
                      <Button
                        variant={tpl.is_active ? 'outline' : 'default'}
                        size="sm"
                        className={`flex-1 text-xs ${!tpl.is_active ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                        onClick={() => handleToggleTemplate(tpl)}
                      >
                        {tpl.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ============ Compose ============ */}
        <TabsContent value="compose">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-500" /> Compose Newsletter
              </CardTitle>
              <CardDescription>Select articles, choose a template, and queue your newsletter for sending.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold">Subject Line <span className="text-red-500">*</span></Label>
                  <Input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Your Daily News Digest" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold">Template <span className="text-red-500">*</span></Label>
                  <Select value={composeTemplate} onValueChange={setComposeTemplate}>
                    <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                    <SelectContent>
                      {activeTemplates.map(t => (
                        <SelectItem key={t.template_key} value={t.template_key}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Scheduled Date</Label>
                <Input type="date" value={composeDate} onChange={e => setComposeDate(e.target.value)} className="max-w-xs" />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="font-semibold">Select Articles ({composeArticleIds.size} selected)</Label>
                {publishedArticles.length === 0 ? (
                  <p className="text-sm text-slate-500">No published articles available.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                    {publishedArticles.map(article => (
                      <label key={article.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={composeArticleIds.has(article.id)}
                          onCheckedChange={() => toggleComposeArticle(article.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{article.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] capitalize">{article.category}</Badge>
                            <span className="text-[10px] text-slate-400">{article.published_at ? new Date(article.published_at).toLocaleDateString() : ''}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setComposeSubject(''); setComposeArticleIds(new Set()); }}>
                  <X className="w-4 h-4 mr-1" /> Clear
                </Button>
                <Button
                  onClick={handleCompose}
                  disabled={composing || !composeSubject.trim() || !composeTemplate || composeArticleIds.size === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  {composing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Queuing...</> : <><Send className="w-4 h-4 mr-2" /> Queue Newsletter</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Queue ============ */}
        <TabsContent value="queue">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" /> Newsletter Queue
                </CardTitle>
                <CardDescription>{pendingQueueCount} pending, {queueItems.length} total items</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={loadQueue}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                </Button>
                {pendingQueueCount > 0 && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleProcessQueue} disabled={processing}>
                    {processing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processing...</> : <><Zap className="w-4 h-4 mr-1" /> Process Queue</>}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {queueItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Queue is empty. Compose a newsletter to add items.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 border-b text-left">
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[200px]">Subject</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Status</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Template</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Scheduled</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Sent At</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Opened</th>
                          <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Clicked</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {queueItems.slice(0, 50).map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-slate-900 truncate max-w-[250px]">{item.subject || '—'}</p>
                              {item.ab_variant && <Badge variant="outline" className="text-[10px] mt-0.5">Variant {item.ab_variant}</Badge>}
                            </td>
                            <td className="px-3 py-2.5"><StatusBadge status={item.status || 'pending'} /></td>
                            <td className="px-3 py-2.5"><Badge variant="outline" className="text-[10px] font-mono">{item.template_key}</Badge></td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">{item.scheduled_date || '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">{item.sent_at ? new Date(item.sent_at).toLocaleString() : '—'}</td>
                            <td className="px-3 py-2.5 text-center">
                              {item.opened_at ? <MailOpen className="w-4 h-4 text-blue-500 mx-auto" /> : <span className="text-xs text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {item.clicked_at ? <MousePointerClick className="w-4 h-4 text-violet-500 mx-auto" /> : <span className="text-xs text-slate-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-slate-50 border-t px-4 py-2 text-xs text-slate-500">
                    Showing {Math.min(50, queueItems.length)} of {queueItems.length} items
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ A/B Testing ============ */}
        <TabsContent value="ab-testing">
          <div className="space-y-6">
            {/* Create A/B Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-purple-500" /> Create A/B Test
                </CardTitle>
                <CardDescription>Split test subject lines and templates to optimize engagement.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 p-4 border rounded-lg bg-blue-50/30">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 text-white">A</Badge>
                      <span className="font-semibold text-sm">Variant A</span>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Subject Line</Label>
                      <Input value={abSubjectA} onChange={e => setAbSubjectA(e.target.value)} placeholder="Subject for variant A" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Template</Label>
                      <Select value={abTemplateA} onValueChange={setAbTemplateA}>
                        <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                        <SelectContent>
                          {activeTemplates.map(t => <SelectItem key={t.template_key} value={t.template_key}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-4 p-4 border rounded-lg bg-purple-50/30">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-600 text-white">B</Badge>
                      <span className="font-semibold text-sm">Variant B</span>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Subject Line</Label>
                      <Input value={abSubjectB} onChange={e => setAbSubjectB(e.target.value)} placeholder="Subject for variant B" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Template</Label>
                      <Select value={abTemplateB} onValueChange={setAbTemplateB}>
                        <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                        <SelectContent>
                          {activeTemplates.map(t => <SelectItem key={t.template_key} value={t.template_key}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-semibold">Scheduled Date</Label>
                    <Input type="date" value={abDate} onChange={e => setAbDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">Test Percentage</Label>
                    <Select value={abPercent} onValueChange={setAbPercent}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10% of subscribers</SelectItem>
                        <SelectItem value="20">20% of subscribers</SelectItem>
                        <SelectItem value="30">30% of subscribers</SelectItem>
                        <SelectItem value="50">50% of subscribers</SelectItem>
                        <SelectItem value="100">100% of subscribers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="font-semibold">Select Articles ({abArticleIds.size} selected)</Label>
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {publishedArticles.map(article => (
                      <label key={article.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                        <Checkbox checked={abArticleIds.has(article.id)} onCheckedChange={() => toggleAbArticle(article.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{article.title}</p>
                          <Badge variant="outline" className="text-[10px] capitalize mt-0.5">{article.category}</Badge>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleCreateAbTest}
                    disabled={creatingAb || !abSubjectA.trim() || !abSubjectB.trim() || !abTemplateA || !abTemplateB || abArticleIds.size === 0}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    size="lg"
                  >
                    {creatingAb ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <><Beaker className="w-4 h-4 mr-2" /> Create A/B Test</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* A/B Test Results */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">A/B Test Results</CardTitle>
                <CardDescription>Compare variant performance across your tests.</CardDescription>
              </CardHeader>
              <CardContent>
                {abTests.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FlaskConical className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">No A/B tests yet. Create one above to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {abTests.map((test) => (
                      <div key={test.ab_test_id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-mono">Test #{test.ab_test_id}</Badge>
                            <span className="text-xs text-slate-500">{test.total_recipients} recipients</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-semibold">Winner: Variant {test.winner}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className={`p-3 rounded-lg border ${test.winner === 'A' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-blue-600 text-white text-xs">A</Badge>
                              {test.winner === 'A' && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <div className="text-lg font-bold text-slate-900">{test.variants.A.sent}</div>
                                <div className="text-[10px] text-slate-500">Sent</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-blue-600">{test.variants.A.open_rate}%</div>
                                <div className="text-[10px] text-slate-500">Open Rate</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-violet-600">{test.variants.A.click_rate}%</div>
                                <div className="text-[10px] text-slate-500">Click Rate</div>
                              </div>
                            </div>
                          </div>
                          <div className={`p-3 rounded-lg border ${test.winner === 'B' ? 'border-purple-300 bg-purple-50' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-purple-600 text-white text-xs">B</Badge>
                              {test.winner === 'B' && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <div className="text-lg font-bold text-slate-900">{test.variants.B.sent}</div>
                                <div className="text-[10px] text-slate-500">Sent</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-blue-600">{test.variants.B.open_rate}%</div>
                                <div className="text-[10px] text-slate-500">Open Rate</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-violet-600">{test.variants.B.click_rate}%</div>
                                <div className="text-[10px] text-slate-500">Click Rate</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Subscriber Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Subscriber</DialogTitle>
            <DialogDescription>Add a new subscriber to your newsletter list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-semibold">Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={newSubEmail} onChange={e => setNewSubEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={newSubFirst} onChange={e => setNewSubFirst(e.target.value)} placeholder="First" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={newSubLast} onChange={e => setNewSubLast(e.target.value)} placeholder="Last" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSubscriber} disabled={addingSub || !newSubEmail.trim()} className="bg-slate-900 hover:bg-slate-800 text-white">
              {addingSub ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Add</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Subscribers</DialogTitle>
            <DialogDescription>Paste subscriber data, one per line: email, first_name, last_name</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={"john@example.com, John, Doe\njane@example.com, Jane, Smith"}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-400">{importText.trim().split('\n').filter(l => l.trim()).length} rows detected</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkImport} disabled={importing || !importText.trim()} className="bg-slate-900 hover:bg-slate-800 text-white">
              {importing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importing...</> : <><Upload className="w-4 h-4 mr-1" /> Import</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {previewTemplate && (
            <>
              <DialogHeader>
                <DialogTitle>{previewTemplate.name} — Preview</DialogTitle>
                <DialogDescription>{previewTemplate.description}</DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <div className="border rounded-lg overflow-hidden bg-white">
                  <div
                    className="p-4"
                    dangerouslySetInnerHTML={{
                      __html: (previewTemplate.html_content || '')
                        .replace(/\{\{newsletter_title\}\}/g, 'NewsPortal Daily Digest')
                        .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
                        .replace(/\{\{total_articles\}\}/g, '5')
                        .replace(/\{\{unsubscribe_url\}\}/g, '#')
                        .replace(/\{\{#articles\}\}[\s\S]*?\{\{\/articles\}\}/g, '<div style="padding:15px 0;border-bottom:1px solid #eee"><h3 style="margin:0 0 8px 0">Sample Article Title</h3><p style="margin:0;color:#666;font-size:14px">This is a preview of how articles will appear in this template layout.</p></div>')
                        .replace(/\{\{#hero\}\}[\s\S]*?\{\{\/hero\}\}/g, '<div style="padding:20px 0"><h2 style="margin:0 0 12px 0">Featured Story Headline</h2><p style="color:#555">This is the hero article that will be prominently featured at the top of the newsletter.</p></div>')
                        .replace(/\{\{#categories\}\}[\s\S]*?\{\{\/categories\}\}/g, '<div style="padding:20px 0"><h3 style="text-transform:uppercase;letter-spacing:1px;color:#666;font-size:14px">Technology</h3><div style="padding:15px 0"><h4 style="margin:0 0 8px 0">Category Article Example</h4><p style="margin:0;color:#666;font-size:14px">Articles organized by category for easy browsing.</p></div></div>')
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}