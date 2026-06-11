'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Agent, AgentVersion, Deployment } from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'badge-active', inactive: 'badge-inactive',
    deploying: 'badge-deploying', failed: 'badge-failed',
    ACTIVE: 'badge-active', FAILED: 'badge-failed',
    IN_PROGRESS: 'badge-deploying', PENDING: 'badge-pending',
    DRAFT: 'badge-draft', DEPRECATED: 'badge-inactive',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'badge-inactive'}`}>{status}</span>;
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [rollingBack, setRollingBack] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'versions' | 'deployments' | 'definition'>('versions');

  useEffect(() => {
    Promise.all([
      api.agents.get(id),
      api.agents.versions.list(id),
      api.deployments.byAgent(id),
    ]).then(([a, v, d]) => {
      setAgent(a);
      setVersions(v);
      setDeployments(d);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      await api.deployments.deploy(id, { environment: 'production' });
      const [a, d] = await Promise.all([api.agents.get(id), api.deployments.byAgent(id)]);
      setAgent(a);
      setDeployments(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeploying(false);
    }
  };

  const handleRollback = async (versionNumber: number) => {
    if (!confirm(`Roll back to v${versionNumber}?`)) return;
    setRollingBack(versionNumber);
    try {
      await api.deployments.rollback(id, { versionNumber });
      const [a, d] = await Promise.all([api.agents.get(id), api.deployments.byAgent(id)]);
      setAgent(a);
      setDeployments(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRollingBack(null);
    }
  };

  if (loading) return <div className="p-8 text-gray-400 animate-pulse">Loading agent…</div>;
  if (!agent) return <div className="p-8 text-red-400">Agent not found</div>;

  const latestVersion = versions[0];
  const activeDeployment = deployments.find((d) => d.deploymentStatus === 'ACTIVE');

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/agents" className="text-gray-500 hover:text-gray-300 text-sm">← Agents</Link>
          <span className="text-gray-700">/</span>
          <div>
            <h1 className="page-title">{agent.name}</h1>
            <p className="page-subtitle">{agent.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={agent.status} />
          <Link href={`/playground?agentId=${id}`} className="btn-secondary">▶ Test</Link>
          <Link href={`/agents/new?edit=${id}`} className="btn-secondary">Edit</Link>
          <button onClick={handleDeploy} disabled={deploying || !latestVersion} className="btn-primary">
            {deploying ? '⏳ Deploying…' : '⚡ Deploy'}
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="metric-card">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Versions</div>
            <div className="text-2xl font-bold text-white">{versions.length}</div>
          </div>
          <div className="metric-card">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Deployments</div>
            <div className="text-2xl font-bold text-white">{deployments.length}</div>
          </div>
          <div className="metric-card">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Endpoint</div>
            {activeDeployment?.endpointUrl ? (
              <a href={activeDeployment.endpointUrl} target="_blank" rel="noreferrer"
                className="text-sm text-violet-400 hover:text-violet-300 truncate mt-1 block">
                {activeDeployment.endpointUrl}
              </a>
            ) : (
              <div className="text-sm text-gray-500 mt-1">Not deployed</div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-1 border-b border-gray-800 mb-4">
            {(['versions', 'deployments', 'definition'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors
                  ${activeTab === tab ? 'text-violet-400 border-b-2 border-violet-400 -mb-px' : 'text-gray-400 hover:text-gray-200'}`}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'versions' && (
            <div className="table-container">
              <table>
                <thead><tr><th>Version</th><th>Status</th><th>Changelog</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {versions.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-gray-500 py-8">
                      No versions yet. <Link href={`/agents/new?edit=${id}`} className="text-violet-400 hover:underline">Upload a definition →</Link>
                    </td></tr>
                  ) : versions.map((v) => (
                    <tr key={v.id}>
                      <td><span className="font-mono text-violet-400 font-semibold">v{v.version}</span></td>
                      <td><StatusBadge status={v.status} /></td>
                      <td className="text-gray-400 text-xs max-w-xs truncate">{v.changelog || '—'}</td>
                      <td className="text-xs text-gray-500">{new Date(v.createdAt).toLocaleString()}</td>
                      <td>
                        <button onClick={() => handleRollback(v.version)} disabled={rollingBack === v.version}
                          className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors disabled:opacity-50">
                          {rollingBack === v.version ? 'Rolling back…' : '↩ Rollback'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'deployments' && (
            <div className="table-container">
              <table>
                <thead><tr><th>Environment</th><th>Status</th><th>Provider</th><th>Endpoint</th><th>Deployed</th></tr></thead>
                <tbody>
                  {deployments.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-gray-500 py-8">No deployments yet.</td></tr>
                  ) : deployments.map((d) => (
                    <tr key={d.id}>
                      <td><span className="text-xs bg-gray-800 px-2 py-0.5 rounded font-medium">{d.environment}</span></td>
                      <td><StatusBadge status={d.deploymentStatus} /></td>
                      <td className="text-xs text-gray-400">{d.cloudRunService ? 'cloud' : 'local'}</td>
                      <td>
                        {d.endpointUrl ? (
                          <a href={d.endpointUrl} target="_blank" rel="noreferrer"
                            className="text-xs text-violet-400 hover:text-violet-300 font-mono truncate max-w-xs block">
                            {d.endpointUrl}
                          </a>
                        ) : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className="text-xs text-gray-500">{new Date(d.deployedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'definition' && latestVersion && (
            <div className="card">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Latest definition (v{latestVersion.version})</span>
                <Link href={`/agents/new?edit=${id}`} className="text-xs text-violet-400 hover:text-violet-300">Edit →</Link>
              </div>
              <pre className="p-4 text-sm text-gray-300 font-mono overflow-x-auto">
                {JSON.stringify(latestVersion.definition, null, 2)}
              </pre>
            </div>
          )}
          {activeTab === 'definition' && !latestVersion && (
            <div className="card p-8 text-center text-gray-500">No definition uploaded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
