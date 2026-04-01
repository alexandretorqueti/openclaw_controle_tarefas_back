// monitor/passos/macro/FaseArquiteto.ts
// ─────────────────────────────────────────────────────
// Macro Passo: FASE ARQUITETO
// O orquestrador usa isso para gerenciar toda a construção
// e escrita do plano do arquiteto. Internamente, este passo
// orquestra os Atômicos: ChamarIA, ExtrairJSON, e ManipularArquivo.
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import { PassoBase } from '../PassoBase';
import type { TarefaCompleta, PlanoDeAnalise } from '../../interfaces';

// Importa os Passos Atômicos que ele vai usar
import { PassoChamarIA } from '../atomicos/PassoChamarIA';
import type { 
  ChamarIAInput, 
  ChamarIAOutput, 
  DependenciasChamarIA, 
  ServicoOpenClaw 
} from '../atomicos/PassoChamarIA';

import { PassoExtrairValidarJSON } from '../atomicos/PassoExtrairValidarJSON';
import type { FabricaJSONValidator } from '../atomicos/PassoExtrairValidarJSON';

import { PassoManipularArquivo } from '../atomicos/PassoManipularArquivo';
import type { ServicoDisco } from '../atomicos/PassoManipularArquivo';
import { Project } from '@prisma/client';

export interface FaseArquitetoInput {
  tarefaAtual: TarefaCompleta;
  planoAnalise: PlanoDeAnalise | null;
  promptInicial: string;
  caminhoPlanoParaSalvar: string;
}

export interface FaseArquitetoOutput {
  sucesso: boolean;
  planDetails?: string;
  errosCriticos?: string;
}

export interface DependenciasFaseArquiteto {
  logger: Logger;
  openClaw: ServicoOpenClaw;
  disco: ServicoDisco;
  jsonValidator: FabricaJSONValidator<any>;
}

export class MacroFaseArquiteto extends PassoBase<FaseArquitetoInput, FaseArquitetoOutput> {
  readonly nome = 'Fase Arquiteto (Construção do Plano)';
  private readonly openClaw: ServicoOpenClaw;
  private readonly disco: ServicoDisco;
  private readonly jsonValidator: FabricaJSONValidator<any>;

  constructor(deps: DependenciasFaseArquiteto) {
    super(deps);
    this.openClaw = deps.openClaw;
    this.disco = deps.disco;
    this.jsonValidator = deps.jsonValidator;
  }

  protected async processar(input: FaseArquitetoInput): Promise<FaseArquitetoOutput> {
    await this.logger.info(`🏗️ Fase Arquiteto iniciada para a tarefa [${input.tarefaAtual.id}].`);
    const { 
      tarefaAtual, 
      planoAnalise, 
      promptInicial,
      caminhoPlanoParaSalvar } : FaseArquitetoInput = input;
    let planoValido = false;
    let tentativa = 1;
    let promptAtual: string = promptInicial;
    let resultadoIA: ChamarIAOutput | null = null;
    const projeto : Project = tarefaAtual.project;
    // Loop de auto-correção interno do Arquiteto (max 3 tentativas)
    while (!planoValido && tentativa <= 3) {
      await this.logger.info(`🔄 Arquiteto: Tentativa ${tentativa}/3`);

      // 1. Passo atômico de IA
      const passoIA: PassoChamarIA = new PassoChamarIA
      (
        { 
          logger: this.logger, 
          openClaw: this.openClaw 
        } as DependenciasChamarIA
      );
      resultadoIA = await passoIA.execute({
        prompt: promptAtual,
        agente: projeto.agent,
      } as ChamarIAInput);

      if (!resultadoIA.sucesso) {
        await this.logger.erro(`💥 Arquiteto falhou na comunicação com OpenClaw.`);
        return { sucesso: false, errosCriticos: 'OpenClaw falhou ou deu timeout.' };
      }

      // 2. Passo atômico de Validação (Extração de JSON estruturado)
      const passoValidacao = new PassoExtrairValidarJSON<any>({
        logger: this.logger,
        validador: this.jsonValidator,
      });
      const validacao = await passoValidacao.execute({ textoBruto: resultadoIA.respostaRaw });

      if (validacao.sucesso) {
        planoValido = true;

        // 3. Passo atômico de escrita no disco (Salva o .md do plano)
        const passoDisco = new PassoManipularArquivo({ logger: this.logger, disco: this.disco });
        await passoDisco.execute({
          acao: 'escrever',
          caminhoAbsoluto: caminhoPlanoParaSalvar,
          conteudo: JSON.stringify(validacao.dados, null, 2),
        });

      } else {
        await this.logger.erro(`❌ Sintaxe inválida. Preparando correção...`);
        promptAtual += `\n\n[ERRO DE SINTAXE] Corrija este erro: ${validacao.erroDeSintaxe}`;
        tentativa++;
      }
    }

    if (!planoValido) {
      await this.logger.erro(`💥 Arquiteto falhou em gerar um plano válido após 3 tentativas.`);
      return { sucesso: false, errosCriticos: 'Limite de auto-correção atingido.' };
    }

    await this.logger.info(`✅ Plano arquitetural gerado e aprovado com sucesso!`);
    return { sucesso: true, planDetails: resultadoIA?.respostaRaw };
  }
}
