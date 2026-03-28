// src/steps/ConfiguraUsuario.ts

import axios from 'axios';
import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import container from '../container';

export const passoConfiguraUsuario: Passo = {
    name: 'Configura Usuário',
    func: async (ctx: ContextoExecucao) => {
        const { config } = ctx;

        try {
            // Tenta usar um serviço injetado, ou cai no axios direto se ainda não migrou
            const api = container.resolve('apiService') || axios;
            
            await log(`🔍 Buscando ID para o usuário: ${config.MY_USER_NICKNAME}...`);

            const usersRes = await api.get(`${config.API_URL}/api/users`);
            
            // Tratativa para diferentes estruturas de retorno da API
            const listaUsuarios = usersRes.data?.users || usersRes.data || [];
            
            const user = listaUsuarios.find(
                (u: any) => u.nickname === config.MY_USER_NICKNAME
            );

            if (user) {
                ctx.UserId = user.id;
                await log(`👤 Usuário identificado: ${user.nickname} (ID: ${user.id})`);
            } else {
                await log(`⚠️ Usuário '${config.MY_USER_NICKNAME}' não encontrado na API.`);
            }
        } catch (userError: any) {
            // Captura erro de conexão ou 404/500
            const msg = userError.response?.data?.message || userError.message;
            await log(`⚠️ Falha ao buscar configurações de usuário: ${msg}`);
        }
    }
};