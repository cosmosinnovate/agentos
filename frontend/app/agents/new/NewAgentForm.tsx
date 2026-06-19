'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import YAML from 'yaml';

const YAML_TEMPLATE = `apiVersion: agentos/v1
kind: Agent
metadata:
  name: my-agent
spec:
  model:
    provider: mock        # mock | openai | anthropic | vertex | bedrock | azure-openai
    name: mock-model      # e.g. gpt-4o, claude-3-5-sonnet-20241022, gemini-2.5-pro

  deployment:
    provider: local       # local | gcp | aws | azure
    region: us-east-1

  tools:
    - web-search
    - weather

  permissions:
    - read-data

  scaling:
    minReplicas: 1
    maxReplicas: 10
`;

export default function NewAgentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [step, setStep] = useState<'info' | 'definition'>('info');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [definition, setDefinition] = useState('');
  const [changelog, setChangelog] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [agentId, setAgentId] = useState<string | null>(editId);

  // API Key Settings
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [missingApiKey, setMissingApiKey] = useState('');
  const [inputApiKey, setInputApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);

  useEffect(() => {
    if (editId) {
      api.agents.get(editId).then((a) => {
        setName(a.name);
        setDescription(a.description || '');
        setOwner(a.owner || '');
        setStep('definition'); // Go straight to definition tab when editing
      });

      api.agents.versions.list(editId).then((versions) => {
        if (versions.length > 0) {
          const latestVersion = versions[0];
          try {
            const yamlStr = YAML.stringify(latestVersion.definition);
            setDefinition(yamlStr);
          } catch (err) {
            console.error('Failed to stringify definition JSON to YAML', err);
          }
        }
      }).catch(() => {});
    }
    
    // Fetch configured providers
    api.settings.providers.list().then((res) => {
      setConfiguredProviders(res.configured);
    }).catch(() => {});
  }, [editId]);

  // Check YAML for provider
  useEffect(() => {
    if (step === 'definition') {
      const match = definition.match(/provider:\s*([a-zA-Z0-9-]+)/);
      if (match && match[1]) {
        const provider = match[1];
        if (['openai', 'anthropic', 'gemini'].includes(provider) && !configuredProviders.includes(provider)) {
          setMissingApiKey(provider);
        } else {
          setMissingApiKey('');
        }
      }
    }
  }, [definition, step, configuredProviders]);

  const handleSaveApiKey = async () => {
    if (!inputApiKey) return;
    setSavingApiKey(true);
    try {
      await api.settings.providers.set(missingApiKey, inputApiKey);
      setConfiguredProviders((prev) => [...prev, missingApiKey]);
      setMissingApiKey('');
      setInputApiKey('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!name.trim()) { setError('Agent name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (!agentId) {
        const agent = await api.agents.create({ name: name.trim(), description, owner });
        setAgentId(agent.id);
      }
      setStep('definition');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDefinition = async () => {
    if (!agentId) return;
    setSaving(true);
    setError('');
    try {
      await api.agents.versions.create(agentId, { definition, changelog });
      router.push(`/agents/${agentId}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{editId ? 'New Version' : 'New Agent'}</h1>
          <p className="page-subtitle">
            {step === 'info' ? 'Step 1: Basic information' : 'Step 2: Agent definition (YAML)'}
          </p>
        </div>
      </div>

      <div className="page-content max-w-3xl">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-2">
          {['info', 'definition'].map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 text-sm ${step === s ? 'text-violet-400 font-medium' : 'text-gray-500'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${step === s ? 'bg-violet-500 text-white' : agentId && i === 1 ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-600'}`}>
                  {i + 1}
                </span>
                {s === 'info' ? 'Info' : 'Definition'}
              </div>
              {i === 0 && <div className="w-12 h-px bg-gray-800" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {step === 'info' && (
          <div className="card p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Agent Name *</label>
              <input className="input" placeholder="research-agent" value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
              <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
              <input className="input" placeholder="What does this agent do?" value={description}
                onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Owner</label>
              <input className="input" placeholder="your@email.com" value={owner}
                onChange={(e) => setOwner(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => router.push('/agents')} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleCreateAgent} disabled={saving || !name} className="btn-primary">
                {saving ? 'Creating…' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {step === 'definition' && (
          <div className="space-y-4">
            <div className="card">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">Agent Definition (YAML)</span>
                <span className="text-xs text-gray-500">Paste or edit your agent spec below</span>
              </div>
              <div className="p-4">
                <textarea
                  className="code-area"
                  rows={22}
                  value={definition}
                  onChange={(e) => setDefinition(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>

            <details className="card border-gray-800 bg-gray-950/20 group">
              <summary className="px-4 py-3 flex items-center justify-between cursor-pointer select-none text-sm font-medium text-gray-400 hover:text-gray-200">
                <span>💡 View YAML Configuration Reference</span>
                <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="p-4 border-t border-gray-800/60 bg-gray-950/40">
                <pre className="text-xs text-gray-400 font-mono overflow-x-auto select-all leading-normal">
                  {YAML_TEMPLATE}
                </pre>
              </div>
            </details>

            <div className="card p-4 bg-gray-900/50 border-gray-800/50">
              <div className="text-xs text-gray-400 leading-relaxed">
                <span className="font-semibold text-gray-300">Model providers:</span> mock · openai · anthropic · vertex · bedrock · azure-openai
                <br />
                <span className="font-semibold text-gray-300">Deployment targets:</span> local · gcp · aws · azure
                <br />
                Configure credentials in <code className="bg-gray-800 px-1 rounded">backend/.env</code> or securely input them below to use real providers.
              </div>
            </div>

            {missingApiKey && (
              <div className="card p-4 bg-violet-950/20 border-violet-800/50 space-y-3">
                <div className="flex items-center gap-2 text-violet-300 font-medium text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                  Setup {missingApiKey} API Key
                </div>
                <p className="text-xs text-gray-400">
                  You selected <strong>{missingApiKey}</strong> as the provider, but no API key is configured. Please provide your API key. It will be encrypted and saved securely.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={`Enter ${missingApiKey} API key`}
                    className="input flex-1"
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                  />
                  <button onClick={handleSaveApiKey} disabled={savingApiKey || !inputApiKey} className="btn-secondary">
                    {savingApiKey ? 'Saving...' : 'Save Key'}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Changelog (optional)</label>
              <input className="input" placeholder="What changed in this version?" value={changelog}
                onChange={(e) => setChangelog(e.target.value)} />
            </div>

            <div className="flex gap-3">
              {!editId && <button onClick={() => setStep('info')} className="btn-secondary">← Back</button>}
              <button 
                onClick={() => router.push(editId || agentId ? `/agents/${editId || agentId}` : '/agents')} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleSaveDefinition} disabled={saving || !!missingApiKey || !definition.trim()} className="btn-primary">
                {saving ? 'Saving…' : editId ? 'Save New Version' : 'Save & View Agent →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
