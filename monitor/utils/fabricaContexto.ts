// monitor/utils/fabricaContexto.ts
// ─────────────────────────────────────────────────────
// Cria um ContextoExecucao limpo para cada ciclo.
// Centraliza a inicialização para evitar repetição.
// ─────────────────────────────────────────────────────

import type {
  ContextoExecucao,
  ConfiguracaoMonitor,
  ServicosDoMonitor,
  UtilidadesDoMonitor,
} from '../interfaces';

export interface DependenciasFabricaContexto {
  config: ConfiguracaoMonitor;
  services: ServicosDoMonitor;
  utils: UtilidadesDoMonitor;
}

export function criarContextoLimpo(deps: DependenciasFabricaContexto): ContextoExecucao {
  return {
    tarefaAtual: null,
    UserId: null,
    config: deps.config,
    services: deps.services,
    utils: deps.utils,
    lockAtivo: false,
    files: {
      promptFile: null,
      relatorioFile: null,
      doneFile: null,
      terminalLogFile: null,
      architectPlanFile: null,
      architectLogFile: null,
    },
    analysisPlan: null,
    
    // Trilha de auditoria vazia no início
    historicoPassos: [],
    
    // Namespaces separados e inicializados limpos
    controle: {
      loopsExecutados: 0,
    },
    erros: {},
    resultados: {},
  };
}
