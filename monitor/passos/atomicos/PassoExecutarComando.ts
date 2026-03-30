// monitor/passos/atomicos/PassoExecutarComando.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Executa comandos de Terminal (Build/Test)
// Ideal para CI/CD dentro da própria pipeline do Agente.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';

export interface ExecutarComandoInput {
  comando: string;
  diretorioDeTrabalho: string;
  timeoutMs?: number;
}

export interface ExecutarComandoOutput {
  sucesso: boolean;
  stdout: string;
  stderr: string;
  mensagemErro?: string;
}

export interface ServicoTerminal {
  executar(comando: string, opcoes: { cwd: string; timeout: number }): Promise<{ stdout: string; stderr: string }>;
}

export interface DependenciasExecutarComando extends DependenciasBase {
  terminal: ServicoTerminal;
}

export class PassoExecutarComando extends PassoBase<ExecutarComandoInput, ExecutarComandoOutput> {
  readonly nome = 'Executar Comando de Terminal';
  private readonly terminal: ServicoTerminal;

  constructor(deps: DependenciasExecutarComando) {
    super(deps);
    this.terminal = deps.terminal;
  }

  protected async processar(input: ExecutarComandoInput): Promise<ExecutarComandoOutput> {
    await this.logger.info(`🖥️ Executando: "${input.comando}" em ${input.diretorioDeTrabalho}`);

    try {
      const timeout = input.timeoutMs || 120_000; // 2 minutos padrão para builds
      
      const { stdout, stderr } = await this.terminal.executar(input.comando, {
        cwd: input.diretorioDeTrabalho,
        timeout,
      });

      await this.logger.info(`✅ Comando concluído. Saída: ${stdout.length} bytes.`);
      
      return {
        sucesso: true,
        stdout,
        stderr,
      };
    } catch (error: any) {
      // Quando o comando falha no exit code (ex: jest falha nos testes)
      await this.logger.erro(`❌ Comando falhou (Exit code != 0): ${error.message}`);
      
      return {
        sucesso: false,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        mensagemErro: error.message,
      };
    }
  }
}

