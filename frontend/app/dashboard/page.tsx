'use client';

import { useEffect, useState } from 'react';
import { api, GlobalMetrics, Agent, Execution } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="metric-card">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${accent || 'text-gray-100'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniChart({ data }: { data: { label: string; executions: number }[] }) {
  const max = Math.max(...data.map((d) => d.executions), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
          <div
            className="w-full rounded-sm bg-violet-500/30 group-hover:bg-violet-500/60 transition-colors"
            style={{ height: `${Math.max((d.executions / max) * 100, 4)}%` }}
          />
          {i % 6 === 0 && (
            <span className="text-[9px] text-gray-600 absolute -bottom-4">{d.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'badge-active',
    inactive: 'badge-inactive',
    deploying: 'badge-deploying',
    failed: 'badge-failed',
    SUCCESS: 'badge-active',
    FAILED: 'badge-failed',
    RUNNING: 'badge-deploying',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'badge-inactive'}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.executions.metrics(),
      api.agents.list(),
      api.executions.list(10),
    ])
      .then(([m, a, e]) => {
        setMetrics(m);
        setAgents(a);
        setExecutions(e);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400 animate-pulse">Loading dashboard…</div>;
  if (error) return (
    <div className="p-8">
      <div className="card p-6 border-red-800/50 bg-red-950/20">
        <div className="text-red-400 font-semibold">Cannot connect to AgentOS backend</div>
        <div className="text-red-300/70 text-sm mt-1">{error}</div>
        <div className="text-gray-500 text-sm mt-3">Make sure the backend is running: <code className="bg-gray-800 px-1 rounded text-xs">cd backend && npm run start:dev</code></div>
      </div>
    </div>
  );

  const activeAgents = agents.filter((a) => a.status === 'active').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time observability across all agents</p>
        </div>
        <Link href="/agents/new" className="btn-primary">
          + New Agent
        </Link>
      </div>

      <div className="page-content">
        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Active Agents" value={activeAgents} sub={`${agents.length} total`} accent="text-emerald-400" />
          <MetricCard label="Total Executions" value={metrics?.totalExecutions ?? 0} sub="All time" />
          <MetricCard label="Success Rate" value={`${metrics?.successRate ?? 0}%`} sub="Last 1000 runs" accent={(metrics?.successRate ?? 0) > 90 ? 'text-emerald-400' : 'text-yellow-400'} />
          <MetricCard label="Avg Latency" value={`${metrics?.avgLatencyMs ?? 0}ms`} sub="Per execution" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Execution chart */}
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-gray-100">Executions (24h)</div>
                <div className="text-xs text-gray-500 mt-0.5">{metrics?.totalExecutions ?? 0} total</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-violet-400">${(metrics?.totalCostUsd ?? 0).toFixed(4)}</div>
                <div className="text-xs text-gray-500">estimated cost</div>
              </div>
            </div>
            {metrics?.last24h && <MiniChart data={metrics.last24h} />}
          </div>

          {/* Cost & tokens */}
          <div className="card p-5 space-y-4">
            <div className="font-semibold text-gray-100">Token Usage</div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total tokens</span>
                <span className="text-gray-100 font-medium">{(metrics?.totalTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Est. cost</span>
                <span className="text-gray-100 font-medium">${(metrics?.totalCostUsd ?? 0).toFixed(6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Avg latency</span>
                <span className="text-gray-100 font-medium">{metrics?.avgLatencyMs ?? 0}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Success rate</span>
                <span className={`font-medium ${(metrics?.successRate ?? 0) >= 90 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {metrics?.successRate ?? 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Agents table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-100">Agents</h2>
            <Link href="/agents" className="text-sm text-violet-400 hover:text-violet-300">View all →</Link>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-gray-500 py-8">No agents yet. <Link href="/agents/new" className="text-violet-400 hover:underline">Create your first agent →</Link></td></tr>
                ) : (
                  agents.slice(0, 5).map((a) => (
                    <tr key={a.id}>
                      <td><Link href={`/agents/${a.id}`} className="font-medium text-gray-100 hover:text-violet-400 transition-colors">{a.name}</Link></td>
                      <td><StatusBadge status={a.status} /></td>
                      <td className="text-gray-400 text-xs">{a.owner}</td>
                      <td className="text-gray-500 text-xs">{new Date(a.createdAt).toLocaleDateString()}</td>
                      <td><Link href={`/agents/${a.id}`} className="text-xs text-violet-400 hover:text-violet-300">View →</Link></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent executions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-100">Recent Executions</h2>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Model</th>
                  <th>Latency</th>
                  <th>Tokens</th>
                  <th>Cost</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {executions.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-500 py-8">No executions yet. Try invoking an agent from the <Link href="/playground" className="text-violet-400 hover:underline">Playground</Link>.</td></tr>
                ) : (
                  executions.map((e) => {
                    const agentName = agents.find((a) => a.id === e.agentId)?.name || `${e.agentId.substring(0, 8)}…`;
                    return (
                      <tr 
                        key={e.id} 
                        onClick={() => router.push(`/executions/${e.id}`)}
                        className="cursor-pointer hover:bg-gray-850/60 transition-colors"
                      >
                        <td className="font-semibold text-violet-400 hover:text-violet-300 transition-colors">{agentName}</td>
                        <td><StatusBadge status={e.status} /></td>
                        <td className="text-xs text-gray-400">{e.model || '—'}</td>
                        <td className="text-xs">{e.latencyMs}ms</td>
                        <td className="text-xs">{(e.tokensPrompt + e.tokensCompletion).toLocaleString()}</td>
                        <td className="text-xs">${Number(e.totalCost || 0).toFixed(6)}</td>
                        <td className="text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
