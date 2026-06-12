'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Execution, Agent } from '@/lib/api';

interface ExecutionDetailPageContentProps {
  id: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
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

function SpanRow({ span, totalDuration }: { span: any; totalDuration: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const latencyPct = totalDuration > 0 ? (span.latencyMs / totalDuration) * 100 : 0;

  const typeMap: Record<string, { label: string; bg: string; border: string; text: string; icon: string }> = {
    LLM_INFERENCE: { label: 'LLM Call', bg: 'bg-purple-950/40', border: 'border-purple-800/30', text: 'text-purple-400', icon: '🤖' },
    TOOL_EXECUTION: { label: 'Tool', bg: 'bg-blue-950/40', border: 'border-blue-800/30', text: 'text-blue-400', icon: '🔧' },
    SUB_AGENT_INVOCATION: { label: 'Sub-Agent', bg: 'bg-teal-950/40', border: 'border-teal-800/30', text: 'text-teal-400', icon: '👥' },
    default: { label: 'Operation', bg: 'bg-gray-950/40', border: 'border-gray-800/30', text: 'text-gray-400', icon: '⚡' },
  };

  const style = typeMap[span.type] || typeMap.default;

  return (
    <div className="border border-gray-800/60 rounded-xl overflow-hidden bg-gray-950/20">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-900/30 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-500 font-mono text-xs">{isOpen ? '▼' : '▶'}</span>
          <span className="text-lg leading-none">{style.icon}</span>
          <div>
            <span className="text-sm font-semibold text-white font-mono">{span.name}</span>
            <span className={`text-[10px] ml-2 font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border ${style.bg} ${style.border} ${style.text}`}>
              {style.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:w-64 flex-shrink-0">
          <div className="flex-1 bg-gray-800 h-2 rounded-full overflow-hidden relative" title={`${latencyPct.toFixed(1)}% of total execution`}>
            <div 
              className="bg-violet-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${latencyPct}%` }}
            />
          </div>
          <span className="font-mono text-xs text-gray-300 min-w-[60px] text-right font-semibold">
            {span.latencyMs}ms
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 bg-gray-950/80 border-t border-gray-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block mb-1.5">Inputs</span>
            <pre className="p-3 bg-gray-900/85 border border-gray-800 rounded-lg text-[11px] font-mono text-gray-300 overflow-x-auto max-h-[250px] whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(span.input, null, 2)}
            </pre>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block mb-1.5">Outputs</span>
            <pre className="p-3 bg-gray-900/85 border border-gray-800 rounded-lg text-[11px] font-mono text-gray-300 overflow-x-auto max-h-[250px] whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(span.output, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExecutionDetailPageContent({ id }: ExecutionDetailPageContentProps) {
  const router = useRouter();
  const [execution, setExecution] = useState<Execution | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'trace'>('overview');

  useEffect(() => {
    Promise.all([
      api.executions.get(id),
      api.agents.list()
    ])
      .then(([exec, list]) => {
        setExecution(exec);
        setAgents(list);
      })
      .catch((e) => {
        setError(e.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-gray-400 animate-pulse">Loading execution details…</div>;
  
  if (error || !execution) {
    return (
      <div className="p-8">
        <div className="card p-6 border-red-800/50 bg-red-950/20">
          <div className="text-red-400 font-semibold">Error Loading Execution Trace</div>
          <div className="text-red-300/70 text-sm mt-1">{error || 'Execution trace not found.'}</div>
          <button onClick={() => router.back()} className="btn-secondary text-xs mt-4">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const agent = agents.find((a) => a.id === execution.agentId);
  const agentName = agent?.name || `Agent [${execution.agentId.substring(0, 8)}]`;
  const totalTokens = (execution.tokensPrompt || 0) + (execution.tokensCompletion || 0);

  // Safe parsing of response payload
  let parsedResponse = execution.responsePayload;
  if (typeof parsedResponse === 'string') {
    try {
      parsedResponse = JSON.parse(parsedResponse);
    } catch {
      // Keep it as raw string
    }
  }

  const trace = parsedResponse?.trace;
  const spans = trace?.spans || [];
  const finalResultText = parsedResponse?.result || (typeof parsedResponse === 'string' ? parsedResponse : JSON.stringify(parsedResponse, null, 2));

  // Parse payloads if they are stored as JSON or stringified JSON
  const getPayloadText = (payload: any): string => {
    if (!payload) return '—';
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return payload;
      }
    }
    if (typeof payload === 'object') {
      if ('message' in payload) {
        let text = payload.message;
        if (payload.context) {
          text += `\n\n--- Context ---\n${payload.context}`;
        }
        return text;
      }
      if ('result' in payload) {
        return payload.result;
      }
      return JSON.stringify(payload, null, 2);
    }
    return String(payload);
  };

  const requestText = getPayloadText(execution.requestPayload);
  const responseText = execution.status === 'FAILED' 
    ? execution.errorMessage || 'Unknown Error' 
    : finalResultText;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1">
            ← Back
          </button>
          <span className="text-gray-700">/</span>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="page-title">Trace Details</h1>
              <StatusBadge status={execution.status} />
            </div>
            <p className="page-subtitle font-mono text-[11px] text-gray-500 mt-0.5">ID: {execution.id}</p>
          </div>
        </div>
      </div>

      <div className="page-content space-y-6">
        {/* Summary Card Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Agent</div>
            {agent ? (
              <Link href={`/agents/${agent.id}`} className="text-sm font-semibold text-violet-400 hover:underline block mt-1">
                {agent.name}
              </Link>
            ) : (
              <span className="text-sm font-medium text-white block mt-1">{agentName}</span>
            )}
          </div>
          <div className="metric-card">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Model</div>
            <span className="text-sm font-semibold text-white block mt-1 truncate" title={execution.model}>
              {execution.model || '—'}
            </span>
          </div>
          <div className="metric-card">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Latency</div>
            <span className="text-sm font-semibold text-white block mt-1">
              {execution.latencyMs ? `${execution.latencyMs}ms` : '—'}
            </span>
          </div>
          <div className="metric-card">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Tokens / Cost</div>
            <span className="text-sm font-semibold text-white block mt-1">
              {totalTokens > 0 ? `${totalTokens.toLocaleString()} (${execution.tokensPrompt} in / ${execution.tokensCompletion} out)` : '—'}
              {execution.totalCost > 0 && <span className="text-violet-400 text-xs font-medium block mt-0.5">${Number(execution.totalCost).toFixed(6)}</span>}
            </span>
          </div>
        </div>

        {/* Time details */}
        <div className="text-xs text-gray-500 bg-gray-950/20 px-4 py-2.5 rounded-lg border border-gray-850/50 flex flex-wrap gap-x-6 gap-y-1">
          <div>
            <span className="text-gray-600">Executed At:</span> <span className="text-gray-300">{new Date(execution.createdAt).toLocaleString()}</span>
          </div>
          {execution.versionId && (
            <div>
              <span className="text-gray-600">Version ID:</span> <span className="font-mono text-gray-300">{execution.versionId}</span>
            </div>
          )}
        </div>

        {/* Tabs switcher */}
        <div>
          <div className="flex gap-1 border-b border-gray-800 mb-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
                ${activeTab === 'overview' ? 'text-violet-400 border-violet-400' : 'text-gray-400 hover:text-gray-205 border-transparent'}`}
            >
              📋 Payload Overview
            </button>
            <button
              onClick={() => setActiveTab('trace')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5
                ${activeTab === 'trace' ? 'text-violet-400 border-violet-400' : 'text-gray-400 hover:text-gray-205 border-transparent'}`}
            >
              🔍 Distributed Spans Tree {spans.length > 0 && <span className="text-[10px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full">{spans.length}</span>}
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
              {/* Input */}
              <div className="flex flex-col h-full">
                <span className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📥</span> Input Prompt / Context
                </span>
                <div className="flex-1 bg-gray-950 border border-gray-800 rounded-xl p-4 font-mono text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap leading-relaxed min-h-[300px]">
                  {requestText}
                </div>
              </div>

              {/* Output */}
              <div className="flex flex-col h-full">
                <span className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  {execution.status === 'FAILED' ? (
                    <><span>⚠️</span> Error Trace</>
                  ) : (
                    <><span>📤</span> Agent Response</>
                  )}
                </span>
                <div className={`flex-1 border rounded-xl p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed min-h-[300px]
                  ${execution.status === 'FAILED'
                    ? 'bg-red-950/20 border-red-900/40 text-red-300' 
                    : 'bg-gray-950 border-gray-800 text-gray-300'}`}>
                  {responseText}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {spans.length === 0 ? (
                <div className="card p-8 text-center text-gray-500 border-dashed border-gray-800">
                  <span className="text-2xl block mb-2">🔎</span>
                  <div className="text-sm font-semibold text-gray-400">No distributed trace spans found</div>
                  <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto">
                    This execution was recorded before the tracing engine was implemented. Run a new execution to view spans.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 px-1 border-b border-gray-850 pb-2">
                    <span className="font-semibold uppercase tracking-wider">Span & Details</span>
                    <span className="font-semibold uppercase tracking-wider">Relative Latency</span>
                  </div>
                  <div className="space-y-2">
                    {spans.map((span: any, index: number) => (
                      <SpanRow 
                        key={span.spanId || index} 
                        span={span} 
                        totalDuration={execution.latencyMs || 0} 
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
