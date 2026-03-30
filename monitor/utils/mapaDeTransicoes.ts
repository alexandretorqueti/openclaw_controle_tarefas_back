// monitor/utils/mapaDeTransicoes.ts
// ─────────────────────────────────────────────────────
// Mapa declarativo de transições entre passos.
// Cada chave é o nome do passo, cada valor são as rotas
// possíveis (avaliadas na ordem — a primeira que bater ganha).
//
// Regra: última rota SEM condição = fallback padrão.
//        `to: null` = fim do ciclo.
// ─────────────────────────────────────────────────────

import type { MapaDeTransicoes } from '../interfaces';
import { StepName } from '../interfaces';

export const mapaDeTransicoes: MapaDeTransicoes = {

  [StepName.VERIFICA_LOCK]: [
    {
      condition: (c) => c.controleExecucao.processoFantasma != null,
      to: StepName.VERIFICA_TIMEOUT,
    },
    {
      condition: (c) => c.lockAtivo === true,
      to: null, // Lock recente e válido — espera o próximo ciclo
    },
    { to: StepName.CONFIGURA_USUARIO },
  ],

  [StepName.VERIFICA_TIMEOUT]: [
    { to: null }, // Após timeout, encerra para intervenção manual
  ],

  [StepName.CONFIGURA_USUARIO]: [
    { to: StepName.BUSCA_TAREFA },
  ],

  [StepName.BUSCA_TAREFA]: [
    {
      condition: (c) => c.tarefaAtual == null,
      to: null, // Fila vazia — ciclo encerra silenciosamente
    },
    { to: StepName.INICIALIZA_TAREFA },
  ],

  [StepName.INICIALIZA_TAREFA]: [
    {
      condition: (c) => c.controleExecucao.erroInicializacao === true,
      to: null,
    },
    { to: StepName.VALIDA_TAREFA },
  ],

  [StepName.VALIDA_TAREFA]: [
    {
      condition: (c) => c.controleExecucao.erroValidacao === true,
      to: null,
    },
    {
      condition: (c) => c.tarefaAtual?.isAtomic === false,
      to: StepName.DECOMPOE_TAREFA,
    },
    {
      condition: (c) => !c.tarefaAtual?.domain,
      to: StepName.VERIFICA_DOMINIO,
    },
    { to: StepName.PREPARA_SESSAO },
  ],

  [StepName.DECOMPOE_TAREFA]: [
    {
      condition: (c) => c.controleExecucao.erroDecomposicao === true,
      to: null,
    },
    {
      condition: (c) =>
        c.controleExecucao.analiseConcluidaComSucesso === true &&
        (c.controleExecucao.subtasksCreated ?? 0) > 0,
      to: null, // Decomposição criou subtarefas — ciclo encerra
    },
    { to: StepName.VERIFICA_DOMINIO },
  ],

  [StepName.VERIFICA_DOMINIO]: [
    {
      condition: (c) => c.controleExecucao.falhaDeDominio === true,
      to: null,
    },
    { to: StepName.PREPARA_SESSAO },
  ],

  [StepName.PREPARA_SESSAO]: [
    { to: StepName.ANALISTA_SISTEMAS },
  ],

  [StepName.ANALISTA_SISTEMAS]: [
    { to: StepName.PROGRAMADOR },
  ],

  [StepName.PROGRAMADOR]: [
    {
      condition: (c) => c.controleExecucao.erroFatalIA === true,
      to: null,
    },
    {
      condition: (c) => (c.controleExecucao.loopsExecutados ?? 0) > 5,
      to: null, // Eject por segurança
    },
    { to: StepName.INSPECIONA_WORKSPACE },
  ],

  [StepName.INSPECIONA_WORKSPACE]: [
    { to: StepName.ANALISA_TURNO },
  ],

  [StepName.ANALISA_TURNO]: [
    {
      condition: (c) =>
        c.controleExecucao.doneExists === true &&
        !c.controleExecucao.feedbackForNextTurn,
      to: StepName.FINALIZA_TAREFA,
    },
    {
      condition: (c) =>
        c.controleExecucao.feedbackForNextTurn != null ||
        c.controleExecucao.erroSintaxeJSON === true,
      to: StepName.PREPARA_CORRECAO,
    },
    { to: null },
  ],

  [StepName.PREPARA_CORRECAO]: [
    { to: StepName.PROGRAMADOR },
  ],

  [StepName.FINALIZA_TAREFA]: [
    { to: null },
  ],
};
