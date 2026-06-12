'use client';

import { useEffect, useState } from 'react';
import { api, Tool, ProviderInfo } from '@/lib/api';

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', protocol: 'MCP', endpoint: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.tools.list(), api.providers.list()])
      .then(([t, p]) => { setTools(t); setProviders(p.modelProviders); })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!form.name || !form.endpoint) { setError('Name and endpoint are required'); return; }
    setSaving(true);
    setError('');
    try {
      const tool = await api.tools.create(form);
      setTools((prev) => [...prev, tool]);
      setShowAdd(false);
      setForm({ name: '', description: '', protocol: 'MCP', endpoint: '' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove tool "${name}"?`)) return;
    await api.tools.delete(id);
    setTools((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tools</h1>
          <p className="page-subtitle">{tools.length} tools registered</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
          {showAdd ? '✕ Cancel' : '+ Add Tool'}
        </button>
      </div>

      <div className="page-content">
        {/* Add tool form */}
        {showAdd && (
          <div className="card p-5 space-y-4 border-violet-800/30 bg-violet-950/10">
            <div className="font-medium text-gray-100">Register New Tool</div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name *</label>
                <input className="input" placeholder="web-search" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Protocol</label>
                <select className="input" value={form.protocol}
                  onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
                  <option value="MCP">MCP</option>
                  <option value="REST">REST</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Endpoint URL *</label>
                <input className="input" placeholder="https://tools.example.com/mcp/web-search" value={form.endpoint}
                  onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <input className="input" placeholder="What does this tool do?" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <button onClick={handleAdd} disabled={saving} className="btn-primary">
              {saving ? 'Registering…' : 'Register Tool'}
            </button>
          </div>
        )}

        {/* Model Providers Status */}
        <div className="card p-5">
          <div className="font-medium text-gray-100 mb-3">Model Provider Status</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {providers.map((p) => (
              <div key={p.name} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm
                ${p.configured ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-gray-800/50 border-gray-700/50'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.configured ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                <span className={`font-medium ${p.configured ? 'text-emerald-400' : 'text-gray-500'}`}>{p.name}</span>
                {!p.configured && <span className="text-[10px] text-gray-600 ml-auto">not configured</span>}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-3">
            Configure credentials in <code className="bg-gray-800 px-1 rounded">backend/.env</code> to enable providers.
          </div>
        </div>

        {/* Tools table */}
        {loading ? (
          <div className="text-gray-500 animate-pulse">Loading tools…</div>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>Name</th><th>Protocol</th><th>Endpoint</th><th>Description</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {tools.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium text-gray-100">{t.name}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded font-mono
                        ${t.protocol === 'MCP' ? 'bg-violet-500/15 text-violet-400' : 'bg-blue-500/15 text-blue-400'}`}>
                        {t.protocol}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-gray-400 max-w-[200px] truncate">{t.endpoint}</td>
                    <td className="text-sm text-gray-400 max-w-xs truncate">{t.description || '—'}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive ? 'badge-active' : 'badge-inactive'}`}>
                        {t.isActive ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => handleDelete(t.id, t.name)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                        Remove
                      </button>
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
