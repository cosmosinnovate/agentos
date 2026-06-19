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

  // Custom modal states
  const [deleteTool, setDeleteTool] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingError, setDeletingError] = useState('');

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

  const confirmDeleteTool = async () => {
    if (!deleteTool) return;
    setDeleting(deleteTool.id);
    setDeletingError('');
    try {
      await api.tools.delete(deleteTool.id);
      setTools((prev) => prev.filter((t) => t.id !== deleteTool.id));
      setDeleteTool(null);
    } catch (e: any) {
      setDeletingError(e.message || 'Failed to delete tool');
    } finally {
      setDeleting(null);
    }
  };

  // Provider config states
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const handleSaveApiKey = async () => {
    if (!selectedProvider || !inputKey) return;
    setSavingKey(true);
    try {
      await api.settings.providers.set(selectedProvider.name, inputKey);
      const p = await api.providers.list();
      setProviders(p.modelProviders);
      setSelectedProvider(p.modelProviders.find(x => x.name === selectedProvider.name) || null);
      setInputKey('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!selectedProvider) return;
    if (!confirm(`Are you sure you want to delete the stored API key for ${selectedProvider.name}?`)) return;
    setSavingKey(true);
    try {
      await api.settings.providers.delete(selectedProvider.name);
      const p = await api.providers.list();
      setProviders(p.modelProviders);
      setSelectedProvider(p.modelProviders.find(x => x.name === selectedProvider.name) || null);
      setInputKey('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingKey(false);
    }
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
          <p className="text-xs text-gray-400 mb-3">Click on a provider below to manage its securely stored API credentials.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {providers.map((p) => (
              <div 
                key={p.name} 
                onClick={() => {
                  setSelectedProvider(p);
                  setInputKey('');
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-all
                  ${selectedProvider?.name === p.name 
                    ? 'border-violet-500 bg-violet-950/10' 
                    : p.configured 
                      ? 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40' 
                      : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                  }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.configured ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                <span className={`font-medium capitalize ${p.configured ? 'text-emerald-400' : 'text-gray-400'}`}>{p.name}</span>
                {!p.configured && <span className="text-[10px] text-gray-600 ml-auto">not configured</span>}
              </div>
            ))}
          </div>

          {selectedProvider && (
            <div className="mt-4 p-4 rounded-lg bg-gray-900/60 border border-gray-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200 flex items-center gap-1.5">
                  🔑 Credentials for <strong className="text-violet-400 capitalize">{selectedProvider.name}</strong>
                </span>
                <button onClick={() => setSelectedProvider(null)} className="text-xs text-gray-500 hover:text-gray-400">✕ Close</button>
              </div>

              {['openai', 'anthropic', 'gemini'].includes(selectedProvider.name) ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 leading-normal">
                    {selectedProvider.configured ? (
                      <>This provider is currently <strong className="text-emerald-400">configured</strong>. You can update the API key below, or remove it entirely to fall back to environment variables.</>
                    ) : (
                      <>Enter your API key below. Stored API keys are encrypted with AES-256 and saved securely in the database.</>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder={selectedProvider.configured ? "••••••••••••••••" : `Enter ${selectedProvider.name} API key`}
                      className="input flex-1 py-1.5 text-sm"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                    />
                    <button onClick={handleSaveApiKey} disabled={savingKey || !inputKey} className="btn-primary py-1.5 text-xs px-3">
                      {savingKey ? 'Saving...' : 'Save Key'}
                    </button>
                    {selectedProvider.configured && (
                      <button onClick={handleDeleteApiKey} disabled={savingKey} className="btn-secondary border-red-500/30 text-red-400 hover:bg-red-950/20 py-1.5 text-xs px-3">
                        Delete Key
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic leading-normal">
                  Credentials for this provider must be configured using environment variables in your <code className="bg-gray-850 px-1 rounded">backend/.env</code> file.
                </p>
              )}
            </div>
          )}

          <div className="text-xs text-gray-500 mt-3">
            Configure fallback credentials in <code className="bg-gray-800 px-1 rounded">backend/.env</code> to enable providers.
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
                      <button
                        onClick={() => {
                          setDeleteTool({ id: t.id, name: t.name });
                          setDeletingError('');
                        }}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
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

      {/* Beautiful Custom Glassmorphic Confirmation Modal */}
      {deleteTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-gray-950/70 transition-all duration-300">
          <div className="card max-w-md w-full p-6 space-y-4 border-red-500/20 bg-gray-900/90 shadow-2xl relative border">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <span>⚠️</span> Remove Tool
            </h3>
            
            <p className="text-sm text-gray-300 leading-relaxed">
              Are you sure you want to remove the tool 
              <span className="text-gray-100 font-semibold px-1.5 py-0.5 mx-1 bg-gray-800 rounded font-mono">"{deleteTool.name}"</span>? 
              This will unregister it from AgentOS and any agents referencing it will not be able to execute it.
            </p>

            {deletingError && (
              <div className="text-xs text-red-400 bg-red-950/20 border border-red-500/20 p-3 rounded-lg leading-relaxed">
                {deletingError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTool(null)}
                className="btn-secondary text-sm py-2 px-4"
                disabled={deleting === deleteTool.id}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTool}
                disabled={deleting === deleteTool.id}
                className={`text-sm py-2 px-4 rounded-lg font-medium text-white transition-all
                  ${deleting === deleteTool.id
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50'
                    : 'bg-red-600 hover:bg-red-500 cursor-pointer shadow-lg shadow-red-600/10'
                  }`}
              >
                {deleting === deleteTool.id ? 'Removing...' : 'Remove Tool'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
