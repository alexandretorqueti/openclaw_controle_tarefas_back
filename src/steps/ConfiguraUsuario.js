"use strict";
// src/steps/ConfiguraUsuario.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoConfiguraUsuario = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../aux/logger");
const container_1 = __importDefault(require("../container"));
exports.passoConfiguraUsuario = {
    name: 'Configura Usuário',
    func: async (ctx) => {
        const { config } = ctx;
        try {
            // Tenta usar um serviço injetado, ou cai no axios direto se ainda não migrou
            const api = container_1.default.resolve('userService') || axios_1.default;
            await (0, logger_1.log)(`🔍 Buscando ID para o usuário: ${config.MY_USER_NICKNAME}...`);
            const user = await api.getUserByNickname(`${config.MY_USER_NICKNAME}`);
            if (user) {
                ctx.UserId = user.id;
                await (0, logger_1.log)(`👤 Usuário identificado: ${user.nickname} (ID: ${user.id})`);
            }
            else {
                await (0, logger_1.log)(`⚠️ Usuário '${config.MY_USER_NICKNAME}' não encontrado na API.`);
            }
        }
        catch (userError) {
            // Captura erro de conexão ou 404/500
            const msg = userError.response?.data?.message || userError.message;
            await (0, logger_1.log)(`⚠️ Falha ao buscar configurações de usuário: ${msg}`);
        }
    }
};
