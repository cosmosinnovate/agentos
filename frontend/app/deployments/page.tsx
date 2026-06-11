'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Deployment } from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'badge-active', FAILED: 'badge-failed',
    IN_PROGRESS: 'badge-deploying', PENDING: 'badge-pending', ROLLED_BACK: 'badge-inactive',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'badge-inactive'}`}>{status}</span>;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ACTIVE' | 'FAILED'>('all');

  useEffect(() => {
    api.deployments.list().then(setDeployments).finally(() => setLoading(false));
  }, []);

  const filtered = deployments.filter((d) => filter === 'all' || d.deploymentStatus === filter);
  const active = deployments.filter((d) => d.deploymentStatus === 'ACTIVE').length;
  const failed = deployments.filter((d) => d.deploymentStatus === 'FAILED').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Deployments</h1>
          <p className="page-subtitle">{deployments.length} total · {active} active · {failed} failed</p>
        </div>
      </div>

      <div className="page-content">
        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'ACTIVE', 'FAILED'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                ${filter === f ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200'}`}>
              {f === 'all' ? `All (${deployments.length})` : f === 'ACTIVE' ? `Active (${active})` : `Failed (${failed})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-gray-500 animate-pulse">Loading deployments…</div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">⚡</div>
            <div className="text-gray-300 font-medium">No deployments yet</div>
            <div className="text-gray-500 text-sm mt-1">Deploy an agent to see it here</div>
            <Link href="/agents" className="btn-primary mt-4 inline-flex">Go to Agents →</Link>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Agent ID</th>
                  <th>Environment</th>
                  <th>Status</th>
                  <th>Endpoint</th>
                  <th>Service</th>
                  <th>Deployed At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/agents/${d.agentId}`} className="font-mono text-xs text-violet-400 hover:text-violet-300">
                        {d.agentId.substring(0, 8)}…
                      </Link>
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium
                        ${d.environment === 'production' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                        {d.environment}
                      </span>
                    </td>
                    <td><StatusBadge status={d.deploymentStatus} /></td>
                    <td>
                      {d.endpointUrl ? (
                        <a href={d.endpointUrl} target="_blank" rel="noreferrer"
                          className="text-xs text-violet-400 hover:text-violet-300 font-mono truncate max-w-[200px] block">
                          {d.endpointUrl}
                        </a>
                      ) : <span className="text-gray-600 text-xs">{d.errorMessage ? '⚠ ' + d.errorMessage.substring(0, 40) : '—'}</span>}
                    </td>
                    <td className="text-xs font-mono text-gray-500">{d.cloudRunService || '—'}</td>
                    <td className="text-xs text-gray-500">{new Date(d.deployedAt).toLocaleString()}</td>
                    <td>
                      <Link href={`/agents/${d.agentId}`} className="text-xs text-violet-400 hover:text-violet-300">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
