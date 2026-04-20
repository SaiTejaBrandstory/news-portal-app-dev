import { useState } from 'react';
import { client } from '@/lib/api';
import { Mail, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';



export default function SubscribeWidget() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;

    setLoading(true);
    setMessage('');
    try {
      const resp = await client.apiCall.invoke({
        url: '/api/v1/newsletter/subscribe',
        method: 'POST',
        data: { email: email.trim(), first_name: '', last_name: '' },
      });
      setSuccess(true);
      setMessage(resp.data?.message || 'Successfully subscribed!');
      setEmail('');
    } catch {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-emerald-800">You're In!</h3>
        <p className="text-sm text-emerald-600 mt-1">{message}</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Stay Informed</h3>
          <p className="text-sm text-slate-400">Get the latest news delivered to your inbox</p>
        </div>
      </div>
      <form onSubmit={handleSubscribe} className="flex gap-2 mt-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          required
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="px-5 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>Subscribe <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </form>
      {message && <p className="text-xs text-red-400 mt-2">{message}</p>}
    </div>
  );
}