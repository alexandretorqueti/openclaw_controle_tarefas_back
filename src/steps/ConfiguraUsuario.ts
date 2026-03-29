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
            const { userService } = ctx.services;
            
            await log(`🔍 Buscando ID para o usuário: ${config.MY_USER_NICKNAME}...`);

            const user = await userService.getUserByNickname(`${config.MY_USER_NICKNAME}`);

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