import { Link } from 'react-router-dom';
import { useSessionsStore } from '../store/useSessionsStore';

export default function DashboardPage() {
  const activeSession = useSessionsStore((s) => s.activeSession);
  return <div className="max-w-3xl mx-auto px-4 py-12"><h1 className="text-2xl font-semibold">Industrial Maintenance Copilot</h1><p className="mt-2 text-sm text-text-muted">Choose a task to begin{activeSession ? ` in ${activeSession.title || 'the active session'}` : ''}.</p><div className="mt-7 flex flex-wrap gap-3"><Link to="/ask" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">Ask a Question</Link><Link to="/workflow" className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-hover">Report an Equipment Issue</Link></div></div>;
}
