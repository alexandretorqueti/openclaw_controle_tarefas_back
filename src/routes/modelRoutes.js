var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
/**
 * @route GET /api/models
 * @desc Get list of available AI models from openclaw.json
 * @access Public
 */
router.get('/', (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        // Path to openclaw.json
        const openclawPath = '/home/alexandrebragatorqueti/.openclaw/openclaw.json';
        // Use jq to extract models from openclaw.json
        const command = `cat ${openclawPath} | jq -r '.models.providers | to_entries[] | .key as $p | .value.models[] | "\\($p)/\\(.id)"'`;
        const { stdout, stderr } = yield execAsync(command);
        if (stderr) {
            console.error('Error executing jq command:', stderr);
            return res.status(500).json({
                error: 'Failed to parse openclaw.json',
                details: stderr
            });
        }
        // Split stdout by newlines and filter out empty strings
        const models = stdout.trim().split('\n').filter(model => model.trim() !== '');
        res.json({ models });
    }
    catch (error) {
        console.error('Error loading models:', error);
        // Fallback to a hardcoded list if there's an error
        const fallbackModels = [
            'ollama/mistral-small',
            'ollama/glm-4.7-flash:q8_0',
            'ollama/glm-4.7-flash:bf16',
            'ollama/mixtral:latest',
            'ollama/deepseek-v2.5',
            'ollama/llama3.3',
            'ollama/llama3.1:405b',
            'ollama/llama3.1',
            'ollama/nomic-embed-text:latest',
            'ollama/deepseek-r1:70b',
            'ollama/qwen2.5-coder:32b',
            'ollama/qwen3-coder-next:latest',
            'ollama/qwen3:4b',
            'ollama/qwen2.5-coder:14b',
            'ollama/llama3.1:70b',
            'ollama/qwen2.5:72b',
            'ollama/nemotron:latest',
            'ollama/mxbai-embed-large:latest',
            'chatllm/route-llm',
            'google-antigravity/gemini-3-pro',
            'google-antigravity/gemini-3-flash',
            'google-antigravity/gemini-2.5-pro',
            'google-antigravity/gemini-2.5-flash',
            'google-antigravity/gemini-2.5-flash-lite',
            'google-antigravity/gemini-2.0-flash',
            'google-antigravity/gemini-2.0-flash-lite',
            'deepseek/deepseek-chat',
            'deepseek/deepseek-reasoner'
        ];
        res.json({ models: fallbackModels });
    }
}));
module.exports = router;
