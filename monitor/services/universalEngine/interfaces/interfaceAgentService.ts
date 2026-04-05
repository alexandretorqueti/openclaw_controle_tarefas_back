
// ============================================================================
// INTERFACES
// ============================================================================

export interface AgentIdentity {
  name: string;
  emoji: string;
  avatar: string;
  model: string;
}

export interface Agent {
  id: string;
  name: string;
  identity: AgentIdentity;
  bindings: number;
  bindingsList: any[];
  workspace: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentIdentityUpdate {
  name?: string;
  emoji?: string;
  avatar?: string;
  model?: string;
  workspace?: string;
}

export interface CommandError extends Error {
  stderr?: string;
  code?: number | null;
}