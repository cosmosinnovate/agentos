'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, Agent, InvokeResult } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  trace?: InvokeResult['trace'];
  loading?: boolean;
}

export default function PlaygroundForm() {
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get('agentId') || '';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState(initialAgentId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [invoking, setInvoking] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [context, setContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.agents.list().then(setAgents);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedAgent = agents.find((a) => a.id === selectedId);

  const sendMessage = async () => {
    if (!input.trim() || !selectedId || invoking) return;
    const userMsg = input.trim();
    setInput('');

    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setMessages((prev) => [...prev, { role: 'assistant', content: '', loading: true }]);
    setInvoking(true);

    try {
      const result = await api.agents.invoke(selectedId, { message: userMsg, context: context || undefined });
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: result.result, trace: result.trace },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `Error: ${e.message}` },
      ]);
    } finally {
      setInvoking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="page-header flex-shrink-0">
        <div>
          <h1 className="page-title">Playground</h1>
          <p className="page-subtitle">Interactively test your deployed agents</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowTrace(!showTrace)}
            className={`btn-secondary text-xs ${showTrace ? 'text-violet-400 border-violet-500/30' : ''}`}>
            {showTrace ? '◉ Trace On' : '○ Trace Off'}
          </button>
          <button onClick={() => setMessages([])} className="btn-ghost text-xs">
            Clear Chat
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: config */}
        <div className="w-64 flex-shrink-0 border-r border-gray-800 flex flex-col p-4 gap-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Select Agent</label>
            <select className="input text-sm" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setMessages([]); }}>
              <option value="">Choose an agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {selectedAgent && (
            <div className="card p-3 space-y-1.5">
              <div className="text-xs font-medium text-gray-300">{selectedAgent.name}</div>
              <div className="text-xs text-gray-500">{selectedAgent.description || 'No description'}</div>
              <div className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit
                ${selectedAgent.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                {selectedAgent.status}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">System Context (optional)</label>
            <textarea className="code-area text-xs" rows={5} placeholder="Override system prompt or provide additional context…"
              value={context} onChange={(e) => setContext(e.target.value)} />
          </div>

          <div className="text-xs text-gray-600">
            Press <kbd className="bg-gray-800 px-1 rounded">Enter</kbd> to send
            <br />
            <kbd className="bg-gray-800 px-1 rounded">Shift+Enter</kbd> for newline
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-5xl mb-4">▶</div>
                  <div className="text-gray-300 font-medium">Select an agent and send a message</div>
                  <div className="text-gray-500 text-sm mt-1">Agent responses will appear here with execution traces</div>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm
                    ${msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-tr-sm'
                      : 'bg-gray-800 text-gray-100 rounded-tl-sm'}`}>
                    {msg.loading ? (
                      <div className="flex gap-1 py-1">
                        <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                    )}
                  </div>

                  {/* Execution trace */}
                  {showTrace && msg.trace && (
                    <div className="card px-3 py-2 text-xs space-y-1 w-full">
                      <div className="text-gray-500 font-medium uppercase tracking-wider text-[10px] mb-1">Execution Trace</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <span className="text-gray-500">Provider</span><span className="text-gray-300">{msg.trace.provider}/{msg.trace.model}</span>
                        <span className="text-gray-500">Latency</span><span className="text-gray-300">{msg.trace.latencyMs}ms</span>
                        <span className="text-gray-500">Tokens</span><span className="text-gray-300">{msg.trace.totalTokens.toLocaleString()}</span>
                        <span className="text-gray-500">Cost</span><span className="text-gray-300">${msg.trace.estimatedCostUsd.toFixed(6)}</span>
                        <span className="text-gray-500">Version</span><span className="text-gray-300">v{msg.trace.version}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-gray-800 p-4">
            <div className="flex gap-3 items-end">
              <textarea
                className="input flex-1 resize-none"
                rows={2}
                placeholder={selectedId ? `Message ${selectedAgent?.name || 'agent'}…` : 'Select an agent first…'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!selectedId || invoking}
              />
              <button
                onClick={sendMessage}
                disabled={!selectedId || !input.trim() || invoking}
                className="btn-primary h-[58px] px-5 flex-shrink-0"
              >
                {invoking ? '⏳' : '↑ Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
