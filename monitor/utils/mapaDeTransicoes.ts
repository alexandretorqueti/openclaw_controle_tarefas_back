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
      condition: (c) => c.controle.processoFantasma != null,
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
      condition: (c) => c.erros.inicializacao === true,
      to: null,
    },
    { to: StepName.VALIDA_TAREFA },
  ],

  [StepName.VALIDA_TAREFA]: [
    {
      condition: (c) => c.erros.validacao === true,
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
      condition: (c) => c.erros.decomposicao === true,
      to: null,
    },
    {
      condition: (c) =>
        c.resultados.decomposicao?.sucesso === true &&
        (c.resultados.decomposicao?.subtasksCreated ?? 0) > 0,
      to: null, // Decomposição criou subtarefas — ciclo encerra
    },
    { to: StepName.VERIFICA_DOMINIO },
  ],

  [StepName.VERIFICA_DOMINIO]: [
    {
      condition: (c) => c.erros.dominio === true,
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
      condition: (c) => c.erros.fatalIA === true,
      to: null,
    },
    {
      condition: (c) => (c.controle.loopsExecutados ?? 0) > 5,
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
        c.resultados.inspecao?.doneExists === true &&
        !c.resultados.analiseTurno?.feedbackForNextTurn,
      to: StepName.FINALIZA_TAREFA,
    },
    {
      condition: (c) =>
        c.resultados.analiseTurno?.feedbackForNextTurn != null ||
        c.erros.sintaxeJSON === true,
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
