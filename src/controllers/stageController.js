var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const stageService = require('../services/stageService');
class StageController {
    getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stages = yield stageService.getAll();
                res.json(stages);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    getById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stage = yield stageService.getById(parseInt(req.params.id));
                if (!stage)
                    return res.status(404).json({ error: 'Etapa não encontrada' });
                res.json(stage);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { etapa } = req.body;
                if (!etapa)
                    return res.status(400).json({ error: 'Campo etapa é obrigatório' });
                const stage = yield stageService.create({ etapa });
                res.status(201).json(stage);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { etapa } = req.body;
                if (!etapa)
                    return res.status(400).json({ error: 'Campo etapa é obrigatório' });
                const stage = yield stageService.update(parseInt(req.params.id), { etapa });
                res.json(stage);
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield stageService.delete(parseInt(req.params.id));
                res.status(204).send();
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}
module.exports = new StageController();
