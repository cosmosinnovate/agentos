'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

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
  const [definition, setDefinition] = useState(YAML_TEMPLATE);
  const [changelog, setChangelog] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [agentId, setAgentId] = useState<string | null>(editId);

  useEffect(() => {
    if (editId) {
      api.agents.get(editId).then((a) => {
        setName(a.name);
        setDescription(a.description || '');
        setOwner(a.owner || '');
        setStep('definition'); // Go straight to definition tab when editing
      });
    }
  }, [editId]);

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

            <div className="card p-4 bg-gray-900/50 border-gray-800/50">
              <div className="text-xs text-gray-400 leading-relaxed">
                <span className="font-semibold text-gray-300">Model providers:</span> mock · openai · anthropic · vertex · bedrock · azure-openai
                <br />
                <span className="font-semibold text-gray-300">Deployment targets:</span> local · gcp · aws · azure
                <br />
                Configure credentials in <code className="bg-gray-800 px-1 rounded">backend/.env</code> to use real providers.
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Changelog (optional)</label>
              <input className="input" placeholder="What changed in this version?" value={changelog}
                onChange={(e) => setChangelog(e.target.value)} />
            </div>

            <div className="flex gap-3">
              {!editId && <button onClick={() => setStep('info')} className="btn-secondary">← Back</button>}
              <button onClick={handleSaveDefinition} disabled={saving || !definition.trim()} className="btn-primary">
                {saving ? 'Saving…' : editId ? 'Save New Version' : 'Save & View Agent →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
