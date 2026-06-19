// Central API client for AgentOS frontend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `API error ${res.status}`);
  }
  if (res.status === 204) {
    return {} as T;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export const api = {
  agents: {
    list: () => request<Agent[]>('/agents'),
    get: (id: string) => request<Agent>(`/agents/${id}`),
    create: (data: { name: string; description?: string; owner?: string }) =>
      request<Agent>('/agents', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/agents/${id}`, { method: 'DELETE' }),

    versions: {
      list: (agentId: string) => request<AgentVersion[]>(`/agents/${agentId}/versions`),
      create: (agentId: string, data: { definition: string; changelog?: string }) =>
        request<AgentVersion>(`/agents/${agentId}/versions`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
    },

    invoke: (agentId: string, data: { message: string; context?: string }) =>
      request<InvokeResult>(`/agents/${agentId}/invoke`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    metrics: (agentId: string) => request<AgentMetrics>(`/agents/${agentId}/metrics`),
    executions: (agentId: string) => request<Execution[]>(`/agents/${agentId}/executions`),
  },

  deployments: {
    list: () => request<Deployment[]>('/deployments'),
    deploy: (agentId: string, data: { environment?: string; versionNumber?: number }) =>
      request<Deployment>(`/agents/${agentId}/deploy`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    rollback: (agentId: string, data: { versionNumber: number; environment?: string }) =>
      request<Deployment>(`/agents/${agentId}/rollback`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    byAgent: (agentId: string) => request<Deployment[]>(`/agents/${agentId}/deployments`),
  },

  tools: {
    list: () => request<Tool[]>('/tools'),
    create: (data: { name: string; description?: string; protocol: string; endpoint: string }) =>
      request<Tool>('/tools', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/tools/${id}`, { method: 'DELETE' }),
  },

  executions: {
    list: (limit?: number) => request<Execution[]>(`/executions${limit ? `?limit=${limit}` : ''}`),
    get: (id: string) => request<Execution>(`/executions/${id}`),
    metrics: () => request<GlobalMetrics>('/executions/metrics'),
  },

  providers: {
    list: () => request<{ modelProviders: ProviderInfo[] }>('/providers'),
  },

  settings: {
    providers: {
      list: () => request<{ configured: string[] }>('/settings/providers'),
      set: (name: string, apiKey: string) =>
        request<{ success: boolean }>(`/settings/providers/${name}`, {
          method: 'POST',
          body: JSON.stringify({ apiKey }),
        }),
    },
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  description: string;
  owner: string;
  status: 'inactive' | 'active' | 'deploying' | 'failed';
  createdAt: string;
  updatedAt: string;
  versions?: AgentVersion[];
}

export interface AgentVersion {
  id: string;
  agentId: string;
  version: number;
  definition: Record<string, any>;
  status: string;
  changelog?: string;
  createdAt: string;
}

export interface Deployment {
  id: string;
  agentId: string;
  versionId: string;
  environment: string;
  deploymentStatus: string;
  endpointUrl?: string;
  cloudRunService?: string;
  errorMessage?: string;
  deployedAt: string;
}

export interface Execution {
  id: string;
  agentId: string;
  versionId: string;
  requestPayload: any;
  responsePayload: any;
  latencyMs: number;
  tokensPrompt: number;
  tokensCompletion: number;
  totalCost: number;
  status: string;
  errorMessage?: string;
  model: string;
  createdAt: string;
}

export interface InvokeResult {
  executionId: string;
  result: string;
  trace: {
    agentName: string;
    version: number;
    provider: string;
    model: string;
    latencyMs: number;
    totalTokens: number;
    estimatedCostUsd: number;
    timestamp: string;
  };
}

export interface AgentMetrics {
  agentId: string;
  totalExecutions: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  last24h: HourlyBucket[];
}

export interface GlobalMetrics {
  totalExecutions: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  last24h: HourlyBucket[];
}

export interface HourlyBucket {
  hour: string;
  label: string;
  executions: number;
  successful: number;
  avgLatency: number;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  protocol: string;
  endpoint: string;
  isActive: boolean;
  createdAt: string;
}

export interface ProviderInfo {
  name: string;
  configured: boolean;
  models: string[];
}
