// monitor/passos/atomicos/PassoVerificaAtomicidade.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Verifica se a tarefa é atômica.
// Se isAtomic não estiver definido no banco, chama LLM para determinar.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { TarefaCompleta, FabricaPrompts } from '../../interfaces';

export interface VerificaAtomicidadeInput {
  tarefa: TarefaCompleta;
}

export interface VerificaAtomicidadeOutput {
  isAtomic: boolean; // true = atômica, false = precisa decomposição
  certeza: number; // 0-100, confiança da determinação
}

/** Contrato do serviço LLM para determinar atomicidade */
export interface ServicoLlmAtomicidade {
  determinarAtomicidadeTarefa(
    titulo: string,
    descricao: string,
    contextoProjeto: any,
    prompt: string
  ): Promise<{ isAtomic: boolean; certeza: number; razao: string }>;
}

export interface DependenciasVerificaAtomicidade extends DependenciasBase {
  servicoLlmAtomicidade?: ServicoLlmAtomicidade;
  fabricaPrompts?: FabricaPrompts;
}

export class PassoVerificaAtomicidade extends PassoBase<VerificaAtomicidadeInput, VerificaAtomicidadeOutput> {
  readonly nome = 'Verificação de Atomicidade';

  private readonly servicoLlmAtomicidade?: ServicoLlmAtomicidade;
  private readonly fabricaPrompts?: FabricaPrompts;

  constructor(deps: DependenciasVerificaAtomicidade) {
    super(deps);
    this.servicoLlmAtomicidade = deps.servicoLlmAtomicidade;
    this.fabricaPrompts = deps.fabricaPrompts;
  }

  protected async processar(input: VerificaAtomicidadeInput): Promise<VerificaAtomicidadeOutput> {
    const { tarefa } = input;

    // CASO 1: Atomicidade já definida no banco
    if (tarefa.isAtomic !== undefined && tarefa.isAtomic !== null) {
      await this.logger.info(`✅ Atomicidade já definida no banco: ${tarefa.isAtomic ? 'ATÔMICA' : 'NÃO ATÔMICA'}`);
      return { 
        isAtomic: tarefa.isAtomic, 
        certeza: 100 // Máxima confiança quando vem do banco
      };
    }

    // CASO 2: Atomicidade não definida, temos serviço LLM
    if (this.servicoLlmAtomicidade && this.fabricaPrompts) {
      await this.logger.info(`🔍 Atomicidade não definida. Chamando LLM para determinar...`);

      try {
        // Gerar prompt para determinar atomicidade
        const promptAtomicidade = this.fabricaPrompts.gerarPromptParaVerificarAtomicidadeeDominio(tarefa); // TODO: Passar taskType: 'determinar_atomicidade',); // TODO: Passar tefinitionOfDone: [); // TODO: Passar teterminar se ta); // TODO: Passar terificar se tarefa precisa ser decomposta em subtarefas',); // TODO: Passar tnalisar complexidade e escopo da tarefa'); // TODO: Passar t);

        // Chamar LLM
        const resultado = await this.servicoLlmAtomicidade.determinarAtomicidadeTarefa(
          tarefa.title,
          tarefa.description || '',
          tarefa.project,
          promptAtomicidade
        );

        await this.logger.info(
          `✅ Atomicidade determinada pela LLM: ${resultado.isAtomic ? 'ATÔMICA' : 'NÃO ATÔMICA'} ` +
          `(Certeza: ${resultado.certeza}%, Razão: ${resultado.razao})`
        );

        return { 
          isAtomic: resultado.isAtomic, 
          certeza: resultado.certeza 
        };

      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        await this.logger.erro(`❌ Erro ao chamar LLM para determinar atomicidade: ${msg}`);
        
        // Fallback conservador: assume que é atômica para evitar decomposição desnecessária
        await this.logger.info(`⚠️ Usando fallback: assumindo tarefa como ATÔMICA`);
        return { isAtomic: true, certeza: 50 };
      }
    }

    // CASO 3: Atomicidade não definida e sem LLM disponível
    await this.logger.erro(`❌ Atomicidade não definida e sem LLM disponível. Usando heurística.`);
    
    // Heurística simples baseada no título e descrição
    const isAtomic = this.aplicarHeuristicaAtomicidade(tarefa);
    await this.logger.info(`⚠️ Heurística determinou: ${isAtomic ? 'ATÔMICA' : 'NÃO ATÔMICA'}`);
    
    return { isAtomic, certeza: 60 }; // Baixa confiança na heurística
  }

  /**
   * Heurística simples para determinar atomicidade quando LLM não está disponível
   */
  private aplicarHeuristicaAtomicidade(tarefa: TarefaCompleta): boolean {
    const titulo = tarefa.title.toLowerCase();
    const descricao = (tarefa.description || '').toLowerCase();
    
    // Palavras-chave que indicam tarefa complexa (não atômica)
    const palavrasComplexas = [
      'sistema', 'plataforma', 'módulo', 'feature', 'funcionalidade',
      'refatorar', 'reestruturar', 'redesenhar', 'migrar', 'integrar',
      'implementar', 'desenvolver', 'criar', 'construir'
    ];
    
    // Palavras-chave que indicam tarefa simples (atômica)
    const palavrasSimples = [
      'corrigir', 'ajustar', 'consertar', 'arrumar', 'fix',
      'atualizar', 'melhorar', 'otimizar', 'adicionar', 'remover',
      'alterar', 'modificar', 'configurar', 'testar', 'verificar'
    ];
    
    // Contar ocorrências
    let contadorComplexas = 0;
    let contadorSimples = 0;
    
    const textoCompleto = `${titulo} ${descricao}`;
    
    palavrasComplexas.forEach(palavra => {
      if (textoCompleto.includes(palavra)) contadorComplexas++;
    });
    
    palavrasSimples.forEach(palavra => {
      if (textoCompleto.includes(palavra)) contadorSimples++;
    });
    
    // Heurística: se tem mais palavras complexas que simples, não é atômica
    if (contadorComplexas > contadorSimples) {
      return false; // Não atômica
    }
    
    // Heurística: se descrição tem mais de 200 caracteres, provavelmente não é atômica
    if (descricao.length > 200) {
      return false; // Não atômica
    }
    
    // Default: assume atômica (conservador)
    return true;
  }
}