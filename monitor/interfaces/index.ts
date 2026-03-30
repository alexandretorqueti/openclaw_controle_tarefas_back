// monitor/interfaces/index.ts
// Barrel export — importação limpa: import { Passo, ContextoExecucao } from './interfaces';

export type {
  // Tarefa e projeto
  TarefaCompleta,

  // Serviços
  ResultadoCheckLock,
  ServicoLock,
  ServicoEstado,
  ServicoArquivosTarefa,
  ServicoUsuario,
  ServicoAnaliseTarefa,
  FabricaPrompts,

  // Plano
  PlanoDeAnalise,

  // Controle
  ProcessoFantasma,
  ControleGeral,
  ErrosCiclo,
  ResultadosPassos,

  // Arquivos
  ArquivosSessao,

  // Configuração
  ConfiguracaoMonitor,

  // Contexto
  ContextoExecucao,
  ServicosDoMonitor,
  UtilidadesDoMonitor,

  // Resultados
  ResultadoPlanejamentoArquiteto,
  AnaliseArquiteto,

  Passo,
} from './tipos';

export type { Logger } from './logger';
