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
      1. Se a tarefa pede para criar/alterar/corrigir código, o tipo é 'development'.
      2. Se pede apenas para explicar/documentar/analisar sem mudar arquivos, é 'analysis'.
      3. Se é uma tarefa de script/limpeza/execução repetitiva, é 'automation'.
      4. Se requer um relatório detalhado ou passo a passo, marque "requiresReport" como true.

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
}

module.exports = PromptFactory;