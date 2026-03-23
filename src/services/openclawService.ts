import { AgentConfig } from './agentConfigService';
import { execSync, ExecSyncError } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const log = (message: string) => {
  console.log(`🤵 [OpenClaw] ${message}`);
};

export class OpenclawService {
  private static instance: OpenclawService;

  private constructor() {}

  public static getInstance(): OpenclawService {
    if (!OpenclawService.instance) {
      OpenclawService.instance = new OpenclawService();
    }
    return OpenclawService.instance;
  }

  // --- Agent Methods ---

  public async spawnAgent(agent: string): Promise<any> {
    const agentConfig = await this.getAgentConfig(agent);
    return this.executeCommand(`openclaw spawn`, agent, agentConfig);
  }

  public async agentList(): Promise<string[]> {
    try {
      const output = execSync('openclaw agents', { encoding: 'utf-8' });
      return output
        .trim()
        .split('\n')
        .filter((line) => line.trim());
    } catch (error) {
      throw new Error(`Failed to list agents: ${(error as Error).message}`);
    }
  }

  public async agentStatus(agent: string): Promise<string> {
    return this.executeCommand('openclaw session_status', agent, {});
  }

  public async listAgents(): Promise<string[]> {
    try {
      const output = execSync('openclaw agents', { encoding: 'utf-8' });
      return output
        .trim()
        .split('\n')
        .filter((line) => line.trim());
    } catch (error) {
      throw new Error(`Failed to list agents: ${(error as Error).message}`);
    }
  }

  public async listSessions(agent: string): Promise<string[]> {
    return this.executeCommand('openclaw sessions', agent, {
      kinds: ['subagent', 'acp'],
      limit: 10,
      activeMinutes: 60,
      messageLimit: 5,
    });
  }

  public async sendMessageToSession(
    agent: string,
    sessionKey: string,
    message: string
  ): Promise<void> {
    return this.executeCommand(
      `openclaw sessions_send --agentId "${agent}"`,
      sessionKey,
      { message }
    );
  }

  public async yieldSession(agent: string, sessionKey: string): Promise<void> {
    return this.executeCommand(
      `openclaw sessions_yield --agentId "${agent}"`,
      sessionKey,
      {}
    );
  }

  public async spawnSession(agent: string, sessionKey: string): Promise<void> {
    return this.executeCommand(
      `openclaw sessions_spawn --agentId "${agent}"`,
      sessionKey,
      {}
    );
  }

  public async subagentList(
    agent: string,
    recentMinutes: number = 120
  ): Promise<any[]> {
    const command = `openclaw subagents --agentId "${agent}" action=list --recentMinutes ${recentMinutes}`;
    log(`Executing: ${command}`);
    try {
      const output = execSync(command, { encoding: 'utf-8' });
      if (!output || output.trim() === '') {
        return [];
      }
      return JSON.parse(output);
    } catch (error) {
      log(`Error listing subagents: ${(error as Error).message}`);
      return [];
    }
  }

  public async subagentKill(agent: string, target: string): Promise<void> {
    const command = `openclaw subagents --agentId "${agent}" action=kill --target "${target}"`;
    log(`Executing: ${command}`);
    try {
      execSync(command, { encoding: 'utf-8' });
      log(`Subagent ${target} killed`);
    } catch (error) {
      log(`Error killing subagent: ${(error as Error).message}`);
    }
  }

  public async subagentSteer(
    agent: string,
    target: string,
    message: string
  ): Promise<void> {
    const command = `openclaw subagents --agentId "${agent}" action=steer --target "${target}" --message "${message.replace(/"/g, '\\"')}"`;
    log(`Executing: ${command}`);
    try {
      execSync(command, { encoding: 'utf-8' });
      log(`Subagent ${target} steered with message`);
    } catch (error) {
      log(`Error steering subagent: ${(error as Error).message}`);
    }
  }

  public async sessionHistory(
    agent: string,
    sessionKey: string,
    limit: number = 50,
    includeTools: boolean = false
  ): Promise<any[]> {
    const command = `openclaw sessions_history --agentId "${agent}" --sessionKey "${sessionKey}" --limit ${limit} ${includeTools ? '--includeTools' : ''}`;
    log(`Executing: ${command}`);
    try {
      const output = execSync(command, { encoding: 'utf-8' });
      if (!output || output.trim() === '') {
        return [];
      }
      return JSON.parse(output);
    } catch (error) {
      log(`Error fetching history: ${(error as Error).message}`);
      return [];
    }
  }

  public async sessionStatus(
    agent: string,
    sessionKey: string,
    model: string = 'default'
  ): Promise<any> {
    const command = `openclaw session_status --agentId "${agent}" --sessionKey "${sessionKey}" ${model ? `--model ${model}` : ''}`;
    log(`Executing: ${command}`);
    try {
      const output = execSync(command, { encoding: 'utf-8' });
      if (!output || output.trim() === '') {
        return {};
      }
      return JSON.parse(output);
    } catch (error) {
      log(`Error getting session status: ${(error as Error).message}`);
      return {};
    }
  }

  public async sessionStop(
    agent: string,
    sessionKey: string,
    reason: string = 'Completed'
  ): Promise<void> {
    const command = `openclaw sessions_stop --agentId "${agent}" --sessionKey "${sessionKey}" --reason "${reason.replace(/"/g, '\\"')}"`;
    log(`Executing: ${command}`);
    try {
      execSync(command, { encoding: 'utf-8' });
      log(`Session stopped: ${reason}`);
    } catch (error) {
      log(`Error stopping session: ${(error as Error).message}`);
    }
  }

  public async sessionRestart(
    agent: string,
    sessionKey: string,
    reason: string = 'Restarting'
  ): Promise<void> {
    const command = `openclaw sessions_restart --agentId "${agent}" --sessionKey "${sessionKey}" --reason "${reason.replace(/"/g, '\\"')}"`;
    log(`Executing: ${command}`);
    try {
      execSync(command, { encoding: 'utf-8' });
      log(`Session restarted: ${reason}`);
    } catch (error) {
      log(`Error restarting session: ${(error as Error).message}`);
    }
  }

  public async sessionRestartAgent(
    agent: string,
    sessionKey: string,
    reason: string = 'Restarting agent'
  ): Promise<void> {
    const command = `openclaw sessions_restart_agent --agentId "${agent}" --sessionKey "${sessionKey}" --reason "${reason.replace(/"/g, '\\"')}"`;
    log(`Executing: ${command}`);
    try {
      execSync(command, { encoding: 'utf-8' });
      log(`Agent restarted: ${reason}`);
    } catch (error) {
      log(`Error restarting agent: ${(error as Error).message}`);
    }
  }

  // --- Model Methods ---

  public async listModels(): Promise<string[]> {
    try {
      const output = execSync('openclaw models', { encoding: 'utf-8' });
      return output
        .trim()
        .split('\n')
        .filter((line) => line.trim());
    } catch (error) {
      throw new Error(`Failed to list models: ${(error as Error).message}`);
    }
  }

  public async setAgentModel(agent: string, model: string): Promise<void> {
    const command = `openclaw agents_set_model --agentId "${agent}" --model "${model}"`;
    log(`Executing: ${command}`);
    try {
      const result = execSync(command, { encoding: 'utf-8' });
      log(result);
    } catch (error) {
      log(`Error setting model: ${(error as Error).message}`);
    }
  }

  public async getAgentModel(agent: string): Promise<string | null> {
    try {
      const output = execSync(`openclaw agents_get_model --agentId "${agent}"`, {
        encoding: 'utf-8',
      });
      if (!output || output.trim() === '') return null;
      return output.trim();
    } catch (error) {
      log(`Error getting model: ${(error as Error).message}`);
      return null;
    }
  }

  // --- Command Helper ---

  private async executeCommand(
    command: string,
    key: string,
    options: Record<string, unknown> = {}
  ): Promise<string> {
    try {
      const args = [command, `--key "${key}"`];

      for (const [key, value] of Object.entries(options)) {
        if (value !== undefined && value !== null) {
          args.push(`--${key} ${String(value)}`);
        }
      }

      log(`Executing: openclaw ${args.join(' ')}`);

      const result = execSync(`openclaw ${args.join(' ')}`, {
        encoding: 'utf-8',
        env: process.env,
        stdio: ['inherit', 'pipe', 'inherit'],
      });

      return result || '';
    } catch (error) {
      if (error instanceof ExecSyncError) {
        log(`Command failed: ${error.message}`);
        log(`Output: ${error.output?.toString() || ''}`);
      } else {
        log(`Error: ${(error as Error).message}`);
      }
      throw error;
    }
  }

  // --- Environment Configuration ---

  private getOpenClawEnv(): Record<string, string> {
    const env: Record<string, string> = {};

    // Add environment variables from process
    for (const key of Object.keys(process.env)) {
      if (!key.startsWith('OPENCLAW_')) continue;
      env[key] = process.env[key] || '';
    }

    return env;
  }

  // --- Agent Config Service (Simplified) ---

  private async getAgentConfig(agent: string): Promise<AgentConfig> {
    try {
      const models = await this.listModels();
      const defaultModel = models[0] || 'openclaw-model';

      const workspace = process.env.OPENCLAW_WORKSPACE || '';
      const tools = ['browser', 'web_search'];

      return {
        id: agent,
        name: agent,
        model: defaultModel,
        workspace,
        tools,
        environment: this.getOpenClawEnv(),
      };
    } catch (error) {
      throw new Error(`Failed to get config for agent ${agent}`);
    }
  }

  // --- Logging ---

  public async log(message: string): Promise<void> {
    log(message);
  }
}
