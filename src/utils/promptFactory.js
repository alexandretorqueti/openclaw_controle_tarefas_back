// src/utils/promptFactory.js

class PromptFactory {
  /**
   * Gera o prompt para a análise inicial de escopo da tarefa.
   */
  static buildTaskAnalysisPrompt(task, project) {
    return `
      Você é um arquiteto de software. Analise a tarefa abaixo e defina o escopo de execução.
      
      PROJETO:
      - Base: ${project?.pastaBase}
      - Frontend Path: ${project?.frontendPath || 'N/A'}
      - Backend Path: ${project?.backendPath || 'N/A'}

      TAREFA:
      - Título: ${task.title}
      - Descrição: ${task.description}

      REGRAS:
      1. Se a tarefa pede para criar/alterar/corrigir código, ou alterar layout, o tipo é 'development'.
      2. Se a tarefa mencionar BUG, ERRO, CORRIGIR, AJUSTAR, MELHORAR, ou palavras similares, é 'development'.
      3. Se pede apenas para explicar/documentar/analisar sem mudar arquivos, é 'analysis'.
      4. Se é uma tarefa de script/limpeza/execução repetitiva, é 'automation'.
      5. Se requer um relatório detalhado ou passo a passo, marque "requiresReport" como true.

      Responda EXCLUSIVAMENTE em JSON com este formato:
      {
        "taskType": "development" | "analysis" | "automation",
        "requiresReport": true | false,
        "expectedLayers": ["frontend", "backend"],
        "requiredModifiedLayers": ["backend"],
        "mandatoryChecks": ["passo 1", "passo 2"],
        "risks": ["risco 1"]
      }
    `.trim();
  }

  static buildArchitectPrompt(task, project, fileList, planFilePath) {
    const truncatedFiles = fileList.slice(0, 500).join('\n');

    return `
      Você é o Arquiteto de Software Planejador.
      Seu ÚNICO OBJETIVO é criar um documento de texto contendo o plano de ação e encerrar o seu turno. Você passará o bastão para o Desenvolvedor.
      
      PROJETO:
      Frontend: ${project.pastaBase}${project?.frontendPath || 'N/A'}
      Backend: ${project.pastaBase}${project?.backendPath || 'N/A'}

      ESTRUTURA DE ARQUIVOS (Resumo):
      ${truncatedFiles}

      TAREFA A SER ANALISADA:
      Título: ${task?.title}
      Descrição: ${task?.description}

      SEU FLUXO DE TRABALHO OBRIGATÓRIO (Siga na ordem):
      1. Apenas analise a tarefa e decida quais arquivos o desenvolvedor precisará criar ou alterar.
      2. Formule um passo a passo técnico (ex: "1. Vá no arquivo X e adicione Y").
      3. Use a sua ferramenta de escrita (write, bash ou exec) para salvar todo esse passo a passo EXATAMENTE neste arquivo: ${planFilePath}
      4. Não faça nenhuma alteração no código dos projetos, nem crie o arquivo .done, você é o analista e vai passar o bastão para o desenvolvedor. Seu trabalho é apenas planejar e documentar o plano de ação.
      5. Assim que a ferramenta confirmar que o arquivo foi salvo com sucesso, PARE. Não tente editar os arquivos do projeto. Apenas responda com a frase: "Plano salvo. Passando o bastão para o Desenvolvedor."

      Inicie agora seguindo o fluxo acima.
    `.trim();
  }
 
  static buildAgentSystemPrompt(agentContext) {
    return `
      Você é o Agente Jarbas.
      O seu contexto atual é: ${agentContext}
      // ... outras regras do agente
    `.trim();
  }
  
  /**
   * Exemplo: Prompt para gerar relatórios
   */
  static buildReportPrompt(taskTitle, executionEvidence) {
     return `
       A tarefa "${taskTitle}" foi concluída. 
       Com base nas evidências: ${JSON.stringify(executionEvidence)}
       Escreva um relatório detalhado.
     `.trim();
  }

  static buildEngineRulesPrompt(
    files
  ) {
    return `
[REGRA DE OURO]
1. NÃO ADIVINHE CAMINHOS. Use 'find' ou 'ls'.
2. PROIBIDO FAZER BACKUPS: Edite os arquivos originais DIRETAMENTE.
3. SÓ FINALIZE criando o arquivo .done QUANDO TUDO ESTIVER CONCLUÍDO.
QUANDO TERMINAR:
1. Escreva em: ${files.relatorioFile}
2. Use: {"name": "exec", "arguments": {"command": "touch ${files.doneFile}"}}`;
  }

  static buildArchitectAnalysisPrompt(architectResponse, task, project) {
    const prompt = `
      Você é um analista de respostas de arquitetos de software.
      Analise a resposta abaixo de um arquiteto e determine:

      1. O arquiteto JÁ EXECUTOU a tarefa? (implementou código, alterou arquivos)
      2. O arquiteto apenas GEROU UM PLANO? (descreveu passos, mas não executou)
      3. O arquiteto NÃO CONSEGUIU ANALISAR? (resposta vazia, incompleta, erro)

      CONTEXTO:
      - Tarefa: ${task.title}
      - Descrição: ${task.description}
      - Projeto: ${project?.name || 'N/A'}

      RESPOSTA DO ARQUITETO:
      ${architectResponse}

      Analise PALAVRA POR PALAVRA. Procure por TEMPO VERBAL:
      - PASSADO = execução
      - IMPERATIVO/FUTURO = plano
      
      Se houver DÚVIDA, considere como PLANO (hasPlan: true, hasExecuted: false).

      Responda EXCLUSIVAMENTE em JSON:
      {
        "hasExecuted": true/false,
        "hasPlan": true/false,
        "confidence": 0-100,
        "executionDetails": "Descrição do que foi executado, se aplicável",
        "planDetails": "Descrição do plano gerado, se aplicável",
        "analysisFailed": true/false
      }

      CRITÉRIOS CLAROS E EXCLUSIVOS:
      1. "hasExecuted": true APENAS SE o arquiteto DESCREVE TER FEITO alterações reais.
         - Palavras-chave de EXECUÇÃO (PASSADO): "modifiquei", "alterei", "implementei", "adicionei", "removi", "testei e funcionou", "arquivo atualizado", "código executado", "fiz", "concluí", "finalizei"
         - Evidência de AÇÃO CONCLUÍDA, não de intenção.
         - EXEMPLO DE EXECUÇÃO: "Já alterei o arquivo X e adicionei o código Y"
         
      2. "hasPlan": true SE o arquiteto descreve passos FUTUROS, instruções, ou plano de ação.
         - Palavras-chave de PLANO (FUTURO/IMPERATIVO): "deve", "precisa", "siga", "passo a passo", "modifique", "adicione", "localize", "teste", "faça", "execute", "crie"
         - Descreve O QUE FAZER, não O QUE FOI FEITO.
         - EXEMPLO DE PLANO: "Você deve modificar o arquivo X e adicionar o código Y"
         
      3. "analysisFailed": true SE a resposta for vazia, incompreensível, ou não relacionada.

      REGRA DE OURO CRÍTICA: 
      - Se o arquiteto usa verbos no IMPERATIVO ou FUTURO ("faça", "modifique", "adicione") → É PLANO (hasPlan: true)
      - Se o arquiteto usa verbos no PASSADO ("fiz", "modifiquei", "alterei") → É EXECUÇÃO (hasExecuted: true)
      - Plano detalhado NÃO é execução! Um plano com 100 passos ainda é apenas um plano.
    `.trim();
    return prompt;
  }
}

module.exports = PromptFactory;