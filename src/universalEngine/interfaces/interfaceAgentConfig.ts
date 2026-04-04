export interface AgentIdentity {
  name?: string;
  model?: string;
}

export interface AgentData {
  id: string;
  name?: string;
  identity?: AgentIdentity;
  workspace?: string;
  bindings?: number;
  bindingsList?: any[];
}

export interface AgentConfig {
  model: string;
  thinking: string;
  tools: string[];
  browserProfile: string;
  execElevated: string;
  workspace: string;
  agentId: string;
  agentName: string;
  bindings: number;
  bindingsList: any[];
}

export interface AgentContext {
  soul: string;
  user: string;
  memory: string;
  recentMemory: string;
}