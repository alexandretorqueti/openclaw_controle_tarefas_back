// src/steps/ConfiguraUsuario.ts

import axios from 'axios';
import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';

export const passoConfiguraUsuario: Passo = {
    name: 'Configura Usuário',
    func: async (ctx: ContextoExecucao) => {
        const { config } = ctx;

        try {
            // Busca a lista de usuários na API
            const usersRes = await axios.get(`${config.API_URL}/api/users`);
            
            // Encontra o usuário correspondente ao nickname das configurações
            const user = (usersRes.data.users || []).find(
                (u: any) => u.nickname === config.MY_USER_NICKNAME
            );

            if (user) {
                // Injeta os IDs no contexto para os próximos passos usarem
                ctx.UserId = user.id;
            } else {
                await log(`⚠️ Usuário '${config.MY_USER_NICKNAME}' não encontrado na API. Operações que exigem ID podem falhar.`);
            }
        } catch (userError: any) {
            await log(`⚠️ Falha ao buscar configurações de usuário: ${userError.message}`);
        }
    }
};