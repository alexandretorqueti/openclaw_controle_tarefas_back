
 cd /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server

 /home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/bin/node monitor.js 2>&1 | \
  tac | tail -100 | tac > /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server/logs/monitor-cron.log

 echo "=== Execução concluída em: $(date '+%d/%m/%Y, %H:%M:%S') ===" >> /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server/logs/monitor-cron.log