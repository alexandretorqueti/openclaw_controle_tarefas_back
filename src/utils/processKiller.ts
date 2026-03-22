// Migrado para TypeScript - Fase: Utils
// Arquivo: processKiller.js

import logger from "./logger";

class ProcessKiller {
  // Matar processo após delay
  static killAfterDelay(delayMs = 5000) {
    setTimeout(() => {
      console.log(`Matando processo ${process.pid} após conclusão da tarefa`);
      process.exit(0);
    }, delayMs);
  }
  
  // Matar processo imediatamente
  static killNow() {
    console.log(`Matando processo ${process.pid} imediatamente`);
    process.exit(0);
  }
  
  // Matar processo após criação de tarefa
  static killAfterTaskCreation(task, delayMs = 3000) {
    if (task) {
      console.log(`Tarefa ${task.id} criada com sucesso. Matando processo em ${delayMs}ms`);
    } else {
      console.log(`Nenhuma tarefa criada. Matando processo em ${delayMs}ms`);
    }
    
    setTimeout(() => {
      process.exit(0);
    }, delayMs);
  }
}

export default ProcessKiller;
