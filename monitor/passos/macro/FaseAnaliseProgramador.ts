// monitor/passos/macro/FaseAnaliseProgramador.ts
// ─────────────────────────────────────────────────────
// Macro Passo: Análise do Programador (Inspeciona Workspace)
// Atualizado para usar o novo sistema completo de inspeção
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import { PassoBase } from '../PassoBase';
import type { TarefaCompleta } from '../../interfaces';
import type { Snapshot } from '../../services/WorkspaceSnapshotService';
import type { MacroFaseInspecaoWorkspace, InspecaoWorkspaceInput, InspecaoWorkspaceOutput } from './FaseInspecaoWorkspace';

export interface AnaliseProgramadorInput {
  tarefaAtual: TarefaCompleta;
  caminhoTaskDir: string;
  snapshotInicial?: Snapshot;
  diretorioBase?: string;
  rawOutput?: string;
  toolCall?: Record<string, any>;
  toolResult?: Record<string, any>;
}

export interface AnaliseProgramadorOutput {
  workspaceValidado: boolean;
  arquivosAlterados?: boolean;
  mensagem?: string;
  hasDoneFile?: boolean;
  hasRealChanges?: boolean;
  fileChanges?: {
    modified: string[];
    created: string[];
    deleted: string[];
    total: number;
  };
  evidence?: any;
  errosCriticos?: string;
  
  // Novos campos para controle de sessão e feedback específico
  precisaCorrecao?: boolean;
  tipoFalha?: 'SEM_DONE' | 'SEM_ALTERACOES' | 'ALTERACOES_INSUFICIENTES' | 'NADA_FEITO' | 'BUILD_FALHOU' | 'TESTES_FALHARAM';
  mensagemCorrecao?: string;
  manterSessao?: boolean;
  instrucoesEspecificas?: string;
}

export interface DependenciasAnaliseProgramador {
  logger: Logger;
  inspecaoWorkspace: MacroFaseInspecaoWorkspace;
}

export class MacroFaseAnaliseProgramador 
  extends PassoBase<AnaliseProgramadorInput, AnaliseProgramadorOutput> {
  readonly nome = 'Análise do Programador (Inspeção Completa)';
  private readonly inspecaoWorkspace: MacroFaseInspecaoWorkspace;

  constructor(deps: DependenciasAnaliseProgramador) {
    super(deps);
    this.inspecaoWorkspace = deps.inspecaoWorkspace;
  }

  public async execute(input: AnaliseProgramadorInput): Promise<AnaliseProgramadorOutput> {
    return await this.processar(input);
  }

  protected async processar(input: AnaliseProgramadorInput): Promise<AnaliseProgramadorOutput> {
    await this.logger.info(`🔎 Iniciando análise completa do workspace para tarefa [${input.tarefaAtual.id}]...`);
    
    // 1. Executar inspeção completa do workspace
    const inspecaoInput: InspecaoWorkspaceInput = {
      tarefaAtual: input.tarefaAtual,
      snapshotInicial: input.snapshotInicial || new Map(),
      taskDir: input.caminhoTaskDir,
      rawOutput: input.rawOutput,
      toolCall: input.toolCall,
      toolResult: input.toolResult
    };
    
    const inspecaoResult: InspecaoWorkspaceOutput = await this.inspecaoWorkspace.execute(inspecaoInput);
    
    if (!inspecaoResult.sucesso) {
      await this.logger.erro(`❌ Falha na inspeção do workspace: ${inspecaoResult.errosCriticos}`);
      return {
        workspaceValidado: false,
        mensagem: `Falha na inspeção: ${inspecaoResult.errosCriticos}`,
        errosCriticos: inspecaoResult.errosCriticos
      };
    }
    
    // 2. Avaliar resultados da inspeção
    const { hasDoneFile, hasRealChanges, fileChanges, evidence } = inspecaoResult;
    
    // 3. Tomar decisão baseada em evidências com feedback específico
    if (hasDoneFile) {
      // Tem arquivo .done - validação positiva
      await this.logger.info(`✅ Arquivo .done encontrado! Programador entregou artefato de conclusão.`);
      
      if (hasRealChanges) {
        await this.logger.info(`✅ Mudanças reais detectadas (${fileChanges.total} arquivos). Entrega validada.`);
        
        return {
          workspaceValidado: true,
          arquivosAlterados: true,
          hasDoneFile,
          hasRealChanges,
          fileChanges,
          evidence,
          precisaCorrecao: false,
          manterSessao: false // Sessão pode ser encerrada, tarefa completa
        };
      } else {
        // Cenário b: Criou .done mas não alterou arquivos
        await this.logger.info(`⚠️ Arquivo .done encontrado mas sem alterações detectadas.`);
        
        return {
          workspaceValidado: false,
          arquivosAlterados: false,
          hasDoneFile: true,
          hasRealChanges: false,
          fileChanges,
          evidence,
          precisaCorrecao: true,
          tipoFalha: 'SEM_ALTERACOES',
          mensagemCorrecao: 'Você criou o arquivo .done mas não houve alterações nos arquivos do código.',
          instrucoesEspecificas: 'Por favor, use as ferramentas de edição de código (write, edit) para fazer as alterações necessárias na tarefa. O arquivo .done indica que você finalizou, mas não há mudanças no código para validar.',
          manterSessao: true // Mantém sessão para correção
        };
      }
    } else if (hasRealChanges) {
      // Tem alterações mas não tem .done
      await this.logger.info(`⚠️ Alterações detectadas (${fileChanges.total} arquivos) mas sem arquivo .done.`);
      
      // Verificar se há evidências suficientes mesmo sem .done
      const temEvidenciasSuficientes = fileChanges.total >= 1; // Pelo menos uma alteração
      
      if (temEvidenciasSuficientes) {
        // Cenário a: Alterou arquivos mas não criou .done
        await this.logger.info(`✅ Alterações suficientes detectadas, mas falta .done.`);
        
        return {
          workspaceValidado: false, // Não valida completamente sem .done
          arquivosAlterados: true,
          hasDoneFile: false,
          hasRealChanges: true,
          fileChanges,
          evidence,
          precisaCorrecao: true,
          tipoFalha: 'SEM_DONE',
          mensagemCorrecao: 'Você alterou arquivos, mas faltou criar o arquivo .done.',
          instrucoesEspecificas: `Por favor, crie o arquivo .done na pasta da tarefa (${input.caminhoTaskDir}) para indicar que finalizou o trabalho. Use o comando: write { path: "${input.caminhoTaskDir}/.done", content: "Tarefa concluída em ${new Date().toISOString()}" }`,
          manterSessao: true // Mantém sessão para criação do .done
        };
      } else {
        // Alterações insuficientes
        await this.logger.erro(`❌ Alterações insuficientes e sem .done.`);
        
        return {
          workspaceValidado: false,
          mensagem: 'Programador não entregou artefato de conclusão (.done) e alterações insuficientes.',
          hasDoneFile: false,
          hasRealChanges: true,
          fileChanges,
          evidence,
          precisaCorrecao: true,
          tipoFalha: 'ALTERACOES_INSUFICIENTES',
          mensagemCorrecao: 'Alterações detectadas são insuficientes para validar o trabalho.',
          instrucoesEspecificas: 'Por favor, faça alterações mais significativas no código ou crie o arquivo .done para indicar conclusão.',
          manterSessao: true // Mantém sessão para mais trabalho
        };
      }
    } else {
      // Cenário d: Nada feito - nem .done nem alterações
      await this.logger.erro(`❌ Nenhum artefato de entrega encontrado.`);
      
      return {
        workspaceValidado: false,
        mensagem: 'Nenhum arquivo .done encontrado e nenhuma alteração detectada no workspace.',
        hasDoneFile: false,
        hasRealChanges: false,
        fileChanges,
        evidence,
        precisaCorrecao: true,
        tipoFalha: 'NADA_FEITO',
        mensagemCorrecao: 'Não detectei nenhuma alteração no código nem arquivo .done criado.',
        instrucoesEspecificas: 'Por favor, comece a trabalhar na tarefa usando as ferramentas de código (write, edit, exec) ou crie o arquivo .done se já tiver concluído.',
        manterSessao: true // Mantém sessão para iniciar trabalho
      };
    }
  }
}
