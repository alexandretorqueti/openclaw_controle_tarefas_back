// monitor/passos/macro/FaseProgramador.ts
// ─────────────────────────────────────────────────────
// Macro Passo: FASE PROGRAMADOR
// O orquestrador usa isso para gerenciar o loop do desenvolvedor.
// Ele lê o plano do arquiteto, pede pro Programador codar e
// valida se ele marcou como concluído no JSON de saída.
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import { PassoBase } from '../PassoBase';
import type { TarefaCompleta } from '../../interfaces';

import { PassoChamarIA } from '../atomicos/PassoChamarIA';
import type { ServicoOpenClaw } from '../atomicos/PassoChamarIA';

import { PassoExtrairValidarJSON } from '../atomicos/PassoExtrairValidarJSON';
import type { FabricaJSONValidator } from '../atomicos/PassoExtrairValidarJSON';

export interface FaseProgramadorInput {
  tarefaAtual: TarefaCompleta;
  planoArquiteto: string | undefined;
}

export interface FaseProgramadorOutput {
  sucesso: boolean;
  mensagemFinal?: string;
  errosCriticos?: string;
  rawOutput?: string;
  toolCall?: Record<string, any>;
  toolResult?: Record<string, any>;
}

export interface DependenciasFaseProgramador {
  logger: Logger;
  openClaw: ServicoOpenClaw;
  jsonValidator: FabricaJSONValidator<any>;
}

export class MacroFaseProgramador extends PassoBase<FaseProgramadorInput, FaseProgramadorOutput> {
  readonly nome = 'Fase Programador (Codificação)';
  private readonly openClaw: ServicoOpenClaw;
  private readonly jsonValidator: FabricaJSONValidator<any>;

  constructor(deps: DependenciasFaseProgramador) {
    super(deps);
    this.openClaw = deps.openClaw;
    this.jsonValidator = deps.jsonValidator;
  }

  protected async processar(input: FaseProgramadorInput): Promise<FaseProgramadorOutput> {
    await this.logger.info(`👨‍💻 Fase Programador iniciada para a tarefa [${input.tarefaAtual.id}].`);

    let codigoAprovado = false;
    let tentativa = 1;
    
    // Prompt inicial injetado no Orquestrador
    let promptAtual = input.planoArquiteto || "Plano Indisponível";
    
    // Variáveis para armazenar informações do último turno bem-sucedido
    let ultimoRawOutput: string | undefined;
    let ultimoToolCall: Record<string, any> | undefined;
    let ultimoToolResult: Record<string, any> | undefined;

    // Loop de auto-correção do Programador (max 5 tentativas)
    while (!codigoAprovado && tentativa <= 5) {
      await this.logger.info(`🔄 Programador: Turno ${tentativa}/5`);

      // 1. Passo atômico: Chamar IA
      const passoIA = new PassoChamarIA({ logger: this.logger, openClaw: this.openClaw });
      const resultadoIA = await passoIA.execute({
        prompt: promptAtual,
        agente: 'senior-developer',
      });

      if (!resultadoIA.sucesso) {
        await this.logger.erro(`💥 Programador falhou na comunicação com OpenClaw.`);
        return { 
          sucesso: false, 
          errosCriticos: 'OpenClaw falhou ou deu timeout.',
          rawOutput: ultimoRawOutput,
          toolCall: ultimoToolCall,
          toolResult: ultimoToolResult
        };
      }

      // Salvar informações do turno atual
      ultimoRawOutput = resultadoIA.rawOutput;
      ultimoToolCall = resultadoIA.toolCall;
      ultimoToolResult = resultadoIA.toolResult;

      // 2. Passo atômico: Extrair Feedback do Programador
      const passoValidacao = new PassoExtrairValidarJSON<any>({
        logger: this.logger,
        validador: this.jsonValidator,
      });
      const validacao = await passoValidacao.execute({ textoBruto: resultadoIA.respostaRaw });

      if (validacao.sucesso) {
        const payload = validacao.dados;
        
        // Verifica se a IA se deu por satisfeita
        if (payload?.acao === 'feito' || payload?.status === 'concluido') {
          codigoAprovado = true;
          await this.logger.info(`✅ Programador sinalizou conclusão do código!`);
        } else {
          // IA diz que ainda precisa de mais um turno
          await this.logger.info(`⏳ Programador pediu mais um turno: ${payload?.mensagem || 'Sem detalhes'}`);
          promptAtual = `Continue o trabalho. (Turno anterior finalizado sem erros de sintaxe).`;
          tentativa++;
        }
      } else {
        // Erro na sintaxe do JSON retornado pela IA
        await this.logger.erro(`❌ Programador retornou JSON inválido. Solicitando correção...`);
        promptAtual = `[ERRO DE SINTAXE JSON NO SEU ÚLTIMO TURNO]\nCorrija este erro para continuarmos:\n${validacao.erroDeSintaxe}`;
        tentativa++;
      }
    }

    if (!codigoAprovado) {
      await this.logger.erro(`💥 Programador estourou o limite de 5 turnos.`);
      return { 
        sucesso: false, 
        errosCriticos: 'Limite de turnos atingido sem conclusão.',
        rawOutput: ultimoRawOutput,
        toolCall: ultimoToolCall,
        toolResult: ultimoToolResult
      };
    }

    return { 
      sucesso: true,
      rawOutput: ultimoRawOutput,
      toolCall: ultimoToolCall,
      toolResult: ultimoToolResult
    };
  }
}
