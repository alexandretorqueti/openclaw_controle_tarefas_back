// monitor/utils/FabricaPrompts.ts
// ─────────────────────────────────────────────────────
// Fábrica de Prompts Especializados para os Agentes IA
//
// Centraliza toda a engenharia de prompt do sistema.
// Focada em regras claras, determinismo e JSON estruturado.
// ─────────────────────────────────────────────────────

import type { TarefaCompleta } from '../interfaces';
import { Project } from '@prisma/client';



export class FabricaPromptsIA {
  
  // ==========================================================
  // 1. ARQUITETO (Planejamento - Versão Aprimorada do Legado)
  // ==========================================================
  public static gerarPromptArquiteto(
    tarefa: TarefaCompleta,
    projeto: Project,
    caminhoPlano: string,
    tipoTarefa: string = 'development',
    listaArquivos: string[] = [],
    secaoComentarios: string = ''
  ): string {
    const ctxFisico = this.montarContextoPastas(projeto);
    
    // Filtra arquivos relevantes (máximo 500)
    const arquivosFiltrados = this.filtrarArquivosRelevantes(listaArquivos);
    const arquivosTruncados = arquivosFiltrados.slice(0, 500).join('\n');
    
    // Contexto de portas
    let ctxPortas = '';
    if (projeto.frontendPort || projeto.backendPort) {
      ctxPortas = `\n[INFRAESTRUTURA DE PORTAS]\n`;
      if (projeto.frontendPort) ctxPortas += `- Frontend roda na porta: ${projeto.frontendPort}\n`;
      if (projeto.backendPort) ctxPortas += `- Backend roda na porta: ${projeto.backendPort}\n`;
      ctxPortas += `(Garanta que o código ou as instruções de ambiente .env respeitem estas portas)`;
    }

    // Instruções específicas por tipo de tarefa
    const instrucoesPorTipo = this.gerarInstrucoesPorTipo(tipoTarefa, caminhoPlano);

    return `
Você é o Arquiteto de Software Líder do projeto.
Tipo de Tarefa: [${tipoTarefa.toUpperCase()}]

[CONTEXTO DO PROJETO]
${ctxFisico}${ctxPortas}

[ESTRUTURA DE ARQUIVOS (Primeiros 500 arquivos relevantes)]
${arquivosTruncados}

[TAREFA ATUAL]
Título: ${tarefa.title}
Domínio: ${tarefa.domain || 'FULLSTACK'}
Descrição: ${tarefa.description}${secaoComentarios}

${instrucoesPorTipo}.
`.trim();
  }





  // ==========================================================
  // 1.1. Prompt para Análise da Resposta do Arquiteto
  // ==========================================================
  public static gerarPromptAnaliseArquiteto(
    respostaArquiteto: string,
    tarefa: TarefaCompleta,
    projeto: Project,
    evidencias: any
  ): string {
    // Monta o contexto de evidências físicas
    let contextoEvidencias = "";
    if (evidencias.hasRealChanges || evidencias.existsDoneFile) {
      const modCount = evidencias.changes?.modified?.length || 0;
      const creCount = evidencias.changes?.created?.length || 0;
      contextoEvidencias = `
      [🚨 ALERTA CRÍTICO DE SISTEMA - LEIA COM ATENÇÃO]
      O monitoramento físico do sistema de arquivos PROVA INCONTESTAVELMENTE que o Arquiteto ALTEROU CÓDIGO FONTE nesta rodada (modificou ${modCount} arquivos e criou ${creCount} arquivos)${evidencias.existsDoneFile ? ' e gerou o arquivo .done' : ''}.
      Isso significa que é ALTAMENTE PROVÁVEL que ele não tenha apenas planejado, mas sim EXECUTADO a tarefa.
      Analise o texto dele com um FORTE VIÉS DE EXECUÇÃO CONCLUÍDA. Procure no texto a confirmação do que ele fez.
      Mesmo que ele use verbos no imperativo para explicar a solução, a prova física indica que ELE JÁ APLICOU as mudanças.`;
    } else {
      contextoEvidencias = `
      [INFO DO SISTEMA] 
      Não houve alterações reais nos arquivos de código. É altamente provável que ele tenha apenas gerado um plano de ação (instruções) para o Desenvolvedor seguir.`;
    }

    return `
      Você é um analista de respostas de arquitetos de software.
      Analise a resposta abaixo de um arquiteto e determine:

      1. O arquiteto JÁ EXECUTOU a tarefa? (implementou código, alterou arquivos)
      2. O arquiteto apenas GEROU UM PLANO? (descreveu passos, mas não executou)
      3. O arquiteto NÃO CONSEGUIU ANALISAR? (resposta vazia, incompleta, erro)
      4. O arquiteto AFIRMA QUE A TAREFA JÁ FOI EXECUTADA ANTERIORMENTE? (resposta com "hadExecuted": true)

      ${contextoEvidencias}

      CONTEXTO:
      - Tarefa: ${tarefa.title}
      - Descrição: ${tarefa.description}
      - Projeto: ${projeto?.name || 'N/A'}

      RESPOSTA DO ARQUITETO:
      ${respostaArquiteto}

      Analise PALAVRA POR PALAVRA.
      
      Responda EXCLUSIVAMENTE em JSON:
      {
        "hasExecuted": true/false,
        "hasPlan": true/false,
        "confidence": 0-100,
        "executionDetails": "Descrição do que foi executado, se aplicável",
        "planDetails": "Descrição do plano gerado, se aplicável",
        "analysisFailed": true/false,
        "hadExecuted": true/false
      }

      CRITÉRIOS CLAROS E EXCLUSIVOS:
      1. "hasExecuted": true SE o arquiteto descreve a solução E o ALERTA DE SISTEMA confirma que arquivos mudaram.
         - Palavras-chave do texto: "modifiquei", "alterei", "implementei", "resolvido", "código atualizado", "feito".
         
      2. "hasPlan": true SE o arquiteto descreve passos FUTUROS e o ALERTA DE SISTEMA diz que não houve alterações.
         - Palavras-chave do texto: "deve", "precisa", "siga", "passo a passo", "modifique", "o desenvolvedor deve".
         
      3. "analysisFailed": true SE a resposta for vazia, incompreensível, ou não relacionada.

      REGRA DE OURO CRÍTICA: 
      - A EVIDÊNCIA FÍSICA (Alerta de Sistema) tem PESO MÁXIMO. 
      - Se o sistema diz que arquivos foram alterados, incline sua análise para "hasExecuted": true e confira se o texto bate com a ação.
      - Se o sistema diz que NÃO houve alterações, incline para "hasPlan": true (pois ele apenas falou, mas não agiu).
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
  private static montarContextoPastas(projeto: Project): string {
    let ctx = `- Pasta Base: ${projeto.pastaBase}\n`;
    if (projeto.frontendPath) ctx += `- Caminho Frontend: ${projeto.pastaBase}/${projeto.frontendPath}\n`;
    if (projeto.backendPath) ctx += `- Caminho Backend: ${projeto.pastaBase}/${projeto.backendPath}\n`;
    if (projeto.frontendPort) ctx += `- Porta Frontend: ${projeto.frontendPort}\n`;
    if (projeto.backendPort) ctx += `- Porta Backend: ${projeto.backendPort}\n`;
    return ctx;
  }

  private static filtrarArquivosRelevantes(listaArquivos: string[]): string[] {
    // Padrões para ignorar
    const padroesIgnorar = [
      /\/prisma\/migrations\//,
      /\/node_modules\//,
      /\.git\//,
      /\/(dist|build|out)\//,
      /backup/i,
      /\.(lock|log|md|txt)$/,
      /\.(png|jpe?g|svg|gif|ico|pdf|zip|gz)$/,
      /\.(db|sqlite|sqlite3)$/,
      /\.map$/,
      /\.d\.ts\.map$/,
      /\.vscode\//,
      /coverage\//
    ];

    // Extensões relevantes
    const extensoesRelevantes = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.css', '.json'];

    return listaArquivos.filter(arquivo => {
      // Deve ter extensão relevante
      const temExtensaoRelevante = extensoesRelevantes.some(ext => arquivo.endsWith(ext));
      
      // Não deve bater em padrões de ignorar
      const naoIgnorado = !padroesIgnorar.some(pattern => pattern.test(arquivo));
      
      // Ignorar configurações de ferramentas
      const naoConfigFerramenta = !arquivo.match(/\.(config|setup|rc|babelrc)\.(js|json|ts)$/);

      return temExtensaoRelevante && naoIgnorado && naoConfigFerramenta;
    });
  }

  private static gerarInstrucoesPorTipo(tipoTarefa: string, caminhoPlano: string): string {
    const instrucoes = {
      development: `
=== SEU FLUXO DE TRABALHO OBRIGATÓRIO (DESENVOLVIMENTO) ===
* Analise a tarefa e decida quais arquivos o Desenvolvedor precisará criar ou alterar.
* Formule um passo a passo técnico detalhado (ex: "1. No arquivo X, adicione a rota Y").
* Use a ferramenta 'write' para salvar TODO esse passo a passo EXATAMENTE neste arquivo: ${caminhoPlano}
* NÃO DÊ MAIS DE UMA OPÇÃO AO DESENVOLVEDOR. SE HOUVER MAIS DE UM CAMINHO ESCOLHA O MELHOR.
* NÃO PEÇA AO DESENVOLVEDOR PARA REALIZAR TESTES. OS TESTES SERÃO FEITOS EM OUTRA ETAPA.
* Assim que o plano for salvo com sucesso, responda APENAS com: "Plano salvo. Passando o bastão para o Desenvolvedor."
      `,
      
      analysis: `
=== SEU FLUXO DE TRABALHO OBRIGATÓRIO (ANÁLISE) ===
1. Esta é uma tarefa EXCLUSIVA de leitura e investigação. NÃO modifique códigos.
2. Use a ferramenta 'read' ou 'exec' (comandos bash como cat, grep) para inspecionar os arquivos solicitados.
3. Use a ferramenta 'write' para gerar um RELATÓRIO COMPLETO com suas descobertas EXATAMENTE neste arquivo: ${caminhoPlano}
4. Após gerar e salvar o relatório, você DEVE finalizar a tarefa executando o comando \`touch .done\` no diretório da tarefa usando a ferramenta 'exec'.
5. Redija seu relatório e mensagens no PASSADO (ex: "verifiquei", "encontrei", "descobri") para provar que a ação foi concluída.
6. Responda com: "Análise concluída. Tarefa finalizada pelo arquiteto."
      `,
      
      automation: `
=== SEU FLUXO DE TRABALHO OBRIGATÓRIO (AUTOMAÇÃO) ===
1. Avalie se o script ou comando de automação pode ser rodado por você agora mesmo (ex: comandos shell simples, limpeza, git).
2. Se puder resolver agora, EXECUTE a ação usando a ferramenta 'exec'.
3. Use a ferramenta 'write' para registrar o resultado da execução no arquivo: ${caminhoPlano}
4. Se você executou com sucesso, finalize criando o marcador de conclusão via ferramenta 'exec' rodando \`touch .done\`.
5. Se for complexo demais e exigir codificação pesada, crie apenas um plano de ação (como em 'development') e NÃO crie o arquivo .done.
      `
    };

    return instrucoes[tipoTarefa as keyof typeof instrucoes] || instrucoes.development;
  }
}
