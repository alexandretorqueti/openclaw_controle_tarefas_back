#!/bin/bash
# Script para executar o monitor com log rotativo (mantém últimas 100 linhas)

cd /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server

# Executar monitor e capturar output
/home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/bin/node monitor.js 2>&1 | \
  # Inverter ordem (tac), pegar últimas 100 linhas, inverter de volta
  tac | tail -100 | tac > /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server/logs/monitor-cron.log

# Adicionar timestamp no final do arquivo (opcional)
echo "=== Execução concluída em: $(date '+%d/%m/%Y, %H:%M:%S') ===" >> /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server/logs/monitor-cron.log