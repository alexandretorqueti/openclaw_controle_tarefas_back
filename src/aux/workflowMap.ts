// config/workflowMap.ts
import { Rota } from '../interfaces/interfaceMonitor';

export const mapaDeTransicoes: Record<string, Rota[]> = {
    
    'Verifica Lock': [
        // Vai direto para configurar usuário.
        { to: 'Configura Usuário' } 
    ],

    'Configura Usuário': [
        // Se não achou o usuário, para por aqui (to: null). 
        { condition: (c) => c.UserId === null, to: null }, 
        
        // Caminho feliz:
        { to: 'Busca Nova Tarefa' }
    ],

    'Busca Nova Tarefa': [
        // Se a fila está vazia (tarefaAtual é null), encerra o ciclo amigavelmente.
        { condition: (c) => c.tarefaAtual === null, to: null },
        
        // Caminho feliz:
        { to: 'Inicializa Tarefa' }
    ],

    'Inicializa Tarefa': [
        // Por enquanto, como você não implementou os próximos, vamos encerrar aqui.
        // Quando criar o passo da IA, mude este "null" para "Super Validação".
        { to: null }
    ]
};