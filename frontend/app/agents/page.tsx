'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Agent } from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'badge-active',
    inactive: 'badge-inactive',
    deploying: 'badge-deploying',
    failed: 'badge-failed',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'badge-inactive'}`}>{status}</span>;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Custom modal states
  const [deleteAgent, setDeleteAgent] = useState<{ id: string; name: string } | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState('');
  const [deletingError, setDeletingError] = useState('');

  useEffect(() => {
    api.agents.list()
      .then(setAgents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase()) ||
           a.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const confirmDelete = async () => {
    if (!deleteAgent) return;
    setDeleting(deleteAgent.id);
    setDeletingError('');
    try {
      await api.agents.delete(deleteAgent.id);
      setAgents((prev) => prev.filter((a) => a.id !== deleteAgent.id));
      setDeleteAgent(null);
      setConfirmNameInput('');
    } catch (e: any) {
      setDeletingError(e.message || 'Failed to delete agent');
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
        {error && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

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
                      <Link href={`/agents/${agent.id}`} className="font-semibold text-gray-100 hover:text-violet-400 transition-colors truncate">
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
                    onClick={() => {
                      setDeleteAgent({ id: agent.id, name: agent.name });
                      setConfirmNameInput('');
                      setDeletingError('');
                    }}
                    className="btn-danger text-xs py-1.5"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Beautiful Custom Glassmorphic Confirmation Modal */}
      {deleteAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-gray-950/70 transition-all duration-300">
          <div className="card max-w-md w-full p-6 space-y-4 border-red-500/20 bg-gray-900/90 shadow-2xl relative border">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <span>⚠️</span> Delete Agent
            </h3>
            
            <p className="text-sm text-gray-300 leading-relaxed">
              This action <strong className="text-red-400">cannot be undone</strong>. This will permanently delete the agent 
              <span className="text-gray-100 font-semibold px-1.5 py-0.5 mx-1 bg-gray-800 rounded font-mono">"{deleteAgent.name}"</span> 
              along with all of its version history, executions, traces, and tear down all active container deployments.
            </p>

            {deletingError && (
              <div className="text-xs text-red-400 bg-red-950/20 border border-red-500/20 p-3 rounded-lg leading-relaxed">
                {deletingError}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs text-gray-400 font-medium">
                To confirm, type the agent's name <strong className="text-gray-200">"{deleteAgent.name}"</strong> below:
              </label>
              <input
                type="text"
                className="input w-full font-mono text-sm"
                placeholder="Type agent name to verify"
                value={confirmNameInput}
                onChange={(e) => setConfirmNameInput(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteAgent(null)}
                className="btn-secondary text-sm py-2 px-4"
                disabled={deleting === deleteAgent.id}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={confirmNameInput !== deleteAgent.name || deleting === deleteAgent.id}
                className={`text-sm py-2 px-4 rounded-lg font-medium text-white transition-all
                  ${confirmNameInput === deleteAgent.name && deleting !== deleteAgent.id
                    ? 'bg-red-600 hover:bg-red-500 cursor-pointer shadow-lg shadow-red-600/10'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50'
                  }`}
              >
                {deleting === deleteAgent.id ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
