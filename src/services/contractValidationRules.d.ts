declare const politeEmptyReportMessage = "[VALIDA\u00C7\u00C3O] Ol\u00E1! Notei que voc\u00EA criou o arquivo de relat\u00F3rio com sucesso, muito obrigado! Por\u00E9m, ele parece estar vazio (ou muito curto). Por gentileza, use a ferramenta 'write' ou 'edit' para preencher o conte\u00FAdo dele com o seu resumo antes de concluirmos a tarefa.";
declare const validationRules: {
    analysis: {
        hasError: (ctx: any) => boolean;
        getError: (ctx: any) => {
            contractFulfilled: boolean;
            executionNotes: string;
            feedbackToAgent: string;
        };
    }[];
    development: {
        hasError: (ctx: any) => boolean;
        getError: (ctx: any) => {
            contractFulfilled: boolean;
            executionNotes: string;
            feedbackToAgent: string;
        };
    }[];
    automation: {
        hasError: (ctx: any) => boolean;
        getError: (ctx: any) => {
            contractFulfilled: boolean;
            executionNotes: string;
            feedbackToAgent: string;
        };
    }[];
};
