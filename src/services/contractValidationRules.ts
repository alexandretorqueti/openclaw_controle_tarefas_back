// Migrado para TypeScript - Fase: Services
// Arquivo: contractValidationRules.js

// src/services/contractValidationRules.js

const politeEmptyReportMessage = "[VALIDAÇÃO] Olá! Notei que você criou o arquivo de relatório com sucesso, muito obrigado! Porém, ele parece estar vazio (ou muito curto). Por gentileza, use a ferramenta 'write' ou 'edit' para preencher o conteúdo dele com o seu resumo antes de concluirmos a tarefa.";

const validationRules = {
  // ==========================================
  // REGRAS PARA TAREFAS DE ANÁLISE
  // ==========================================
  analysis: [
    {
      hasError: (ctx) => !ctx.relatorioValido,
      getError: (ctx) => ({
        contractFulfilled: false,
        executionNotes: ctx.relatorioVazio ? 'Relatório vazio.' : 'Aguardando relatorio valido.',
        feedbackToAgent: ctx.relatorioVazio
          ? politeEmptyReportMessage
          : '[VALIDACAO] Esta e uma tarefa de analise/documentacao. Gere um relatorio final consistente no arquivo de relatorio antes de concluir.'
      })
    },
    {
      hasError: (ctx) => !ctx.doneExists,
      getError: () => ({
        contractFulfilled: false,
        executionNotes: 'Aguardando arquivo .done.',
        feedbackToAgent: '[VALIDACAO] Gere o relatorio e finalize criando o arquivo .done obrigatorio.'
      })
    },
    {
      hasError: (ctx) => !ctx.haEvidenciaInspecao,
      getError: () => ({
        contractFulfilled: false,
        executionNotes: 'Sem evidencia de inspecao.',
        feedbackToAgent: '[VALIDAÇÃO DE ANÁLISE FALHOU] Você gerou um relatório final, mas os logs mostram que você NÃO INSPECIONOU nenhum arquivo do projeto. Não alucine o relatório. AÇÃO OBRIGATÓRIA: Use as ferramentas "exec" (com ls, grep) ou "read" para investigar os arquivos reais do projeto antes de reescrever o relatório e concluir.'
      })
    }
  ],

  // ==========================================
  // REGRAS PARA TAREFAS DE DESENVOLVIMENTO
  // ==========================================
  development: [
    {
      hasError: (ctx) => !ctx.relatorioValido,
      getError: (ctx) => ({
        contractFulfilled: false,
        executionNotes: ctx.relatorioVazio ? 'Relatório vazio.' : 'Aguardando relatorio valido.',
        feedbackToAgent: ctx.relatorioVazio
          ? politeEmptyReportMessage
          : '[VALIDACAO] Esta e uma tarefa de desenvolvimento. Gere um relatorio final valido no arquivo de relatorio.'
      })
    },
    {
      hasError: (ctx) => !ctx.doneExists,
      getError: () => ({
        contractFulfilled: false,
        executionNotes: 'Aguardando arquivo .done.',
        feedbackToAgent: '[VALIDACAO] Apos implementar as alteracoes, crie o arquivo .done obrigatorio.'
      })
    },
    {
      hasError: (ctx) => ctx.realModifiedFiles.length === 0,
      getError: () => ({
        contractFulfilled: false,
        executionNotes: 'Nenhuma alteracao real detectada.',
        feedbackToAgent: '[FALHA DE VALIDAÇÃO CRÍTICA] Você tentou finalizar a tarefa, mas NENHUM arquivo do código-fonte foi modificado no disco. A sua última tentativa de alteração falhou ou foi ignorada pelo sistema. PARE de tentar concluir. PASSO A PASSO OBRIGATÓRIO AGORA: 1. Use a ferramenta "read" para ler o arquivo que você precisa alterar. 2. Use a ferramenta "edit" (ou "write") para injetar o código correto. 3. SÓ crie o .done depois de ter uma confirmação de sucesso na edição.'
      })
    },
    {
      hasError: (ctx) => ctx.requiresFrontendMod && ctx.modifiedInFrontend.length === 0,
      getError: (ctx) => ({
         contractFulfilled: false,
         executionNotes: 'Pre-analise exige alteracao no frontend, mas nenhuma foi detectada.',
         feedbackToAgent: `[FALHA DE ARQUITETURA] A análise exige alteração REAL no Frontend, mas você só alterou arquivos de outras pastas. Você ainda não tocou em: ${ctx.project?.frontendPath || ctx.fullFrontendPath}. PROIBIDO concluir a tarefa agora. Vá até essa pasta, faça as alterações necessárias nas telas/componentes, e recrie o .done.`
      })
    },
    {
      hasError: (ctx) => ctx.requiresBackendMod && ctx.modifiedInBackend.length === 0,
      getError: (ctx) => ({
         contractFulfilled: false,
         executionNotes: 'Pre-analise exige alteracao no backend, mas nenhuma foi detectada.',
         feedbackToAgent: `[FALHA DE ARQUITETURA] A análise exige alteração REAL no Backend, mas você só alterou arquivos de outras pastas. Você ainda não tocou em: ${ctx.project?.backendPath || ctx.fullBackendPath}. PROIBIDO concluir a tarefa agora. Vá até essa pasta, faça as implementações necessárias, e recrie o .done.`
      })
    },
    {
      hasError: (ctx) => ctx.expectsFrontendTouch && ctx.touchedInFrontend.length === 0,
      getError: (ctx) => ({
         contractFulfilled: false,
         executionNotes: 'A pre-analise esperava revisao do frontend, mas nao ha evidencia disso.',
         feedbackToAgent: `[VALIDACAO] A pre-analise indicou impacto potencial no frontend. Ainda nao ha evidencia de inspecao em ${ctx.project?.frontendPath || ctx.fullFrontendPath}. Revise essa camada antes de concluir.`
      })
    },
    {
      hasError: (ctx) => ctx.expectsBackendTouch && ctx.touchedInBackend.length === 0,
      getError: (ctx) => ({
         contractFulfilled: false,
         executionNotes: 'A pre-analise esperava revisao do backend, mas nao ha evidencia disso.',
         feedbackToAgent: `[VALIDACAO] A pre-analise indicou impacto potencial no backend. Ainda nao ha evidencia de inspecao em ${ctx.project?.backendPath || ctx.fullBackendPath}. Revise essa camada antes de concluir.`
      })
    }
  ],

  // ==========================================
  // REGRAS PARA TAREFAS DE AUTOMAÇÃO
  // ==========================================
  automation: [
    {
      hasError: (ctx) => ctx.reportRequired && !ctx.relatorioValido,
      getError: (ctx) => ({
        contractFulfilled: false,
        executionNotes: ctx.relatorioVazio ? 'Relatório vazio.' : 'Aguardando relatorio valido.',
        feedbackToAgent: ctx.relatorioVazio
          ? politeEmptyReportMessage
          : '[VALIDACAO] Esta tarefa exige relatorio final. Escreva o resultado no arquivo de relatorio antes de concluir.'
      })
    },
    {
      hasError: (ctx) => !ctx.doneExists,
      getError: () => ({
        contractFulfilled: false,
        executionNotes: 'Aguardando arquivo .done.',
        feedbackToAgent: '[VALIDACAO] Finalize a tarefa criando o arquivo .done obrigatorio.'
      })
    },
    {
      hasError: (ctx) => !ctx.usefulExecution,
      getError: () => ({
        contractFulfilled: false,
        executionNotes: 'Sem evidencia de execucao util.',
        feedbackToAgent: '[VALIDACAO] Ainda nao ha evidencia de execucao util. Execute as acoes necessarias antes de concluir.'
      })
    }
  ]
};

export default validationRules;