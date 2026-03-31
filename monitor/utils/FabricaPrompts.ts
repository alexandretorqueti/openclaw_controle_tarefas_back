// monitor/utils/FabricaPrompts.ts
// ─────────────────────────────────────────────────────
// Fábrica de Prompts Especializados para os Agentes IA
//
// Centraliza toda a engenharia de prompt do sistema.
// Focada em regras claras, determinismo e JSON estruturado.
// ─────────────────────────────────────────────────────

import type { TarefaCompleta } from '../interfaces';

export interface ContextoProjeto {
  pastaBase: string;
  frontendPath?: string;
  backendPath?: string;
  frontendPort?: number;
  backendPort?: number;
}

export class FabricaPromptsIA {
  
  // ==========================================================
  // 1. ARQUITETO (Planejamento)
  // ==========================================================
  public static gerarPromptArquiteto(
    tarefa: TarefaCompleta,
    projeto: ContextoProjeto,
    caminhoPlano: string
  ): string {
    const ctxFisico = this.montarContextoPastas(projeto);

    return `
Você é o Arquiteto de Software Líder deste projeto.
Sua única responsabilidade neste turno é gerar um PLANO TÉCNICO DE AÇÃO para o Desenvolvedor seguir.

[CONTEXTO DA TAREFA]
- Título: ${tarefa.title}
- Domínio: ${tarefa.domain || 'FULLSTACK'}
- Descrição original:
${tarefa.description}

[INFRAESTRUTURA DO PROJETO]
${ctxFisico}

[SEU OBJETIVO OBRIGATÓRIO]
1. Analise o que precisa ser feito.
2. Formule um passo a passo técnico, direto e indubitável (ex: "1. No arquivo X, adicione a rota Y").
3. NÃO programe. Não crie código fonte. O seu trabalho é ESTRITAMENTE de planejamento.
4. Use a ferramenta de arquivos para escrever todo o seu plano detalhado EXATAMENTE neste caminho absoluto:
   📍 ${caminhoPlano}
5. Se houver ambiguidades na descrição, tome a decisão de arquitetura mais segura e moderna. Não dê opções ao desenvolvedor.

[QUANDO TERMINAR]
Quando o arquivo do plano estiver salvo no disco, responda OBRIGATORIAMENTE com um bloco JSON neste formato exato (sem formatação markdown extra):
\`\`\`json
{
  "sucesso": true,
  "mensagem": "Plano arquitetural concluído e salvo com sucesso."
}
\`\`\`
`.trim();
  }

  // ==========================================================
  // 2. PROGRAMADOR (Execução)
  // ==========================================================
  public static gerarPromptProgramador(
    tarefa: TarefaCompleta,
    planoArquiteto: string,
    caminhoTaskDir: string
  ): string {
    return `
Você é o Desenvolvedor Senior encarregado de implementar esta tarefa.

[A TAREFA]
- Título: ${tarefa.title}
- Descrição: ${tarefa.description}

[O PLANO DO ARQUITETO (SIGA ESTRITAMENTE)]
${planoArquiteto}

[REGRAS DE EXECUÇÃO - CRÍTICAS]
1. PENSE ANTES DE AGIR: Se precisar ler arquivos para entender o código atual, faça isso primeiro.
2. EDITE COM PRECISÃO: Ao usar ferramentas de edição, garanta que não vai quebrar a sintaxe do arquivo.
3. SEM ARQUIVOS TEMPORÁRIOS: Faça as modificações diretamente nos arquivos oficiais do projeto.

[COMO ENCERRAR O SEU TRABALHO]
Quando você tiver ABSOLUTA CERTEZA de que codificou tudo o que o Arquiteto pediu e que o código não tem erros de sintaxe óbvios:
1. Crie um arquivo vazio chamado ".done" exatamente neste diretório: ${caminhoTaskDir}
2. Responda OBRIGATORIAMENTE com um bloco JSON indicando seu status.

Se você ainda precisa de mais turnos para terminar a codificação, responda:
\`\`\`json
{
  "acao": "continuar",
  "mensagem": "Ainda estou codificando o arquivo X..."
}
\`\`\`

Se você já terminou e criou o arquivo .done, responda:
\`\`\`json
{
  "acao": "feito",
  "mensagem": "Código finalizado conforme o plano do arquiteto."
}
\`\`\`
`.trim();
  }

  // ==========================================================
  // 3. DECOMPOSIÇÃO (Validação de Épicos)
  // ==========================================================
  public static gerarPromptDecomposicao(tarefa: TarefaCompleta): string {
    return `
Você é um Arquiteto de Software focado em gestão de fluxo ágil.
Avalie esta tarefa e decida se ela é muito grande (um Épico) e precisa ser dividida.

[TAREFA ATUAL]
Título: ${tarefa.title}
Descrição: ${tarefa.description}

[REGRAS CRÍTICAS]
1. Se a tarefa for razoavelmente simples ou coesa (pode ser feita editando 1 a 5 arquivos do mesmo domínio em algumas horas), NÃO DIVIDA.
2. Tarefas que pedem leitura, análise ou exploração NÃO devem ser divididas.
3. Uma subtarefa deve gerar código real e pertencer a apenas UM domínio (FRONTEND ou BACKEND).
4. Se for dividir, não divida em apenas 1 tarefa.

[SAÍDA OBRIGATÓRIA]
Responda EXCLUSIVAMENTE com um JSON neste formato. Sem explicações ou markdown em volta:
\`\`\`json
{
  "precisaDividir": true/false,
  "motivo": "Explicação curta do porquê...",
  "subtarefas": [
    {
      "title": "[FRONTEND] Nome da Ação",
      "description": "Detalhes técnicos específicos",
      "domain": "FRONTEND"
    }
  ]
}
\`\`\`
Se precisaDividir for false, o array de subtarefas deve ser vazio [].
`.trim();
  }

  public static gerarPromptParaVerificarAtomicidadeeDominio(task: TarefaCompleta): string {
  return `Você é um Juiz de Arquitetura de Software. Sua função é avaliar se uma tarefa tem o "Tamanho Ideal" para ser entregue a um desenvolvedor senior.

O QUE É UMA TAREFA DE TAMANHO IDEAL:
1. É uma unidade coesa de funcionalidade ou correção. Exemplo: "Criar endpoint de login", "Implementar layout da tela de perfil", "Adicionar validação no formulário X".
2. Pode a edição de múltiplos arquivos relacionados (ex: alterar Rota, Controller e Service) para entregar a funcionalidade de ponta a ponta.
3. O desenvolvedor tem inteligência para usar ferramentas de busca (find, grep) e ler o código sozinho. O escopo foca no OBJETIVO (o que construir/corrigir).
4. É uma tarefa que leva de algumas horas até um dia de trabalho.
5. Se uma tarefa é só no front, ou só no back, e ela envolve um módulo, ela deve ser considerada IDEAL.
6. Se uma tarefa envolve apenas um arquivo, ela deve ser considerada IDEAL.
7. Tarefas que mexem em apenas uma arquivo não deve ser dividido.

O QUE **NÃO** É UMA TAREFA DE TAMANHO IDEAL:
1. Micro-gerenciamento microscópico. Tarefas do tipo "Abra a pasta X", "Procure a string Y", "Edite a linha 5" NÃO são tarefas reais, são passos de terminal. Se a tarefa é um passo de terminal, ela DEVE ser considerada IDEAL (pois o dev a fará em segundos), mas o ideal é que a tarefa englobe a feature inteira.
2. Épicos ou Módulos Inteiros. Exemplo: "Fazer o módulo de pagamentos inteiro", "Refatorar todo o sistema", "Criar o painel de admin completo". Isso é muito grande e precisa ser dividido (Não é ideal).
3. Tarefas que mencionam várias telas ou vários menus. Exemplo: "Rever o layout de todas as telas". Isso é muito grande e precisa ser dividido (NÃO é ideal).
REGRA DE OURO: Não seja excessivamente radical. Se a tarefa descreve uma funcionalidade clara ou um bug específico que um dev consegue resolver em um dia, ela deve ser considerada, IDEAL. Reprove (isIdeal: false) APENAS se for um Épico gigante que envolva dezenas de funcionalidades soltas.

INFORMAÇÕES DA TAREFA:
- Título: ${task.title}
- Descrição: ${task.description}
- Projeto: ${task.project.name}
- Domínio: ${task.domain || 'Não especificado'}

FORMATO DE RESPOSTA OBRIGATÓRIO (APENAS JSON):
{
  "isIdeal": boolean,
  "reason": "Explique brevemente por que a tarefa tem um bom escopo funcional ou por que é um épico grande demais.",
  "confidence": number,
  "inferredDomain": "FRONTEND | BACKEND | UNKNOWN" 
}

REGRA PARA O DOMÍNIO: Se o 'Domínio Atual' for 'Não especificado', deduza se a tarefa pertence ao FRONTEND ou BACKEND baseado na descrição. Se não for possível deduzir, retorne "UNKNOWN". Se já vier preenchido, apenas repita-o.
`;
  }

  // ==========================================================
  // HELPERS
  // ==========================================================
  private static montarContextoPastas(projeto: ContextoProjeto): string {
    let ctx = `- Pasta Base: ${projeto.pastaBase}\n`;
    if (projeto.frontendPath) ctx += `- Caminho Frontend: ${projeto.pastaBase}/${projeto.frontendPath}\n`;
    if (projeto.backendPath) ctx += `- Caminho Backend: ${projeto.pastaBase}/${projeto.backendPath}\n`;
    if (projeto.frontendPort) ctx += `- Porta Frontend: ${projeto.frontendPort}\n`;
    if (projeto.backendPort) ctx += `- Porta Backend: ${projeto.backendPort}\n`;
    return ctx;
  }
}
