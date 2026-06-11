'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Agent } from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'badge-active', inactive: 'badge-inactive',
    deploying: 'badge-deploying', failed: 'badge-failed',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'badge-inactive'}`}>{status}</span>;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    api.agents.list().then(setAgents).finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase()) ||
           a.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete agent "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await api.agents.delete(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Agents</h1>
          <p className="page-subtitle">{agents.length} agent{agents.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Link href="/agents/new" className="btn-primary">+ New Agent</Link>
      </div>

      <div className="page-content">
        <input
          className="input max-w-sm"
          placeholder="Search agents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="text-gray-500 animate-pulse">Loading agents…</div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">⬡</div>
            <div className="text-gray-300 font-medium">No agents yet</div>
            <div className="text-gray-500 text-sm mt-1">Create your first agent to get started</div>
            <Link href="/agents/new" className="btn-primary mt-4 inline-flex">+ Create Agent</Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((agent) => (
              <div key={agent.id} className="card p-5 flex items-center justify-between gap-4 hover:border-gray-700 transition-colors group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center text-lg flex-shrink-0">
                    ⬡
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/agents/${agent.id}`} className="font-semibold text-white hover:text-violet-400 transition-colors truncate">
                        {agent.name}
                      </Link>
                      <StatusBadge status={agent.status} />
                    </div>
                    {agent.description && (
                      <div className="text-sm text-gray-400 mt-0.5 truncate">{agent.description}</div>
                    )}
                    <div className="text-xs text-gray-600 mt-1">
                      by {agent.owner} · created {new Date(agent.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link href={`/playground?agentId=${agent.id}`} className="btn-secondary text-xs py-1.5">
                    ▶ Run
                  </Link>
                  <Link href={`/agents/${agent.id}`} className="btn-secondary text-xs py-1.5">
                    View
                  </Link>
                  <button
                    onClick={() => handleDelete(agent.id, agent.name)}
                    disabled={deleting === agent.id}
                    className="btn-danger text-xs py-1.5"
                  >
                    {deleting === agent.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
