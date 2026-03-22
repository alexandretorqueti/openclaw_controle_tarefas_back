// Migrado para TypeScript - Fase: Controllers
// Arquivo: stageController.js

import stageService from '../services/stageService';

class StageController {
  async getAll(req, res): Promise<any> {
    try {
      const stages = await stageService.getAll();
      res.json(stages);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res): Promise<any> {
    try {
      const stage = await stageService.getById(parseInt(req.params.id));
      if (!stage) return res.status(404).json({ error: 'Etapa não encontrada' });
      res.json(stage);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req, res): Promise<any> {
    try {
      const { etapa } = req.body;
      if (!etapa) return res.status(400).json({ error: 'Campo etapa é obrigatório' });
      
      const stage = await stageService.create({ etapa });
      res.status(201).json(stage);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req, res): Promise<any> {
    try {
      const { etapa } = req.body;
      if (!etapa) return res.status(400).json({ error: 'Campo etapa é obrigatório' });
      
      const stage = await stageService.update(parseInt(req.params.id), { etapa });
      res.json(stage);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res): Promise<any> {
    try {
      await stageService.delete(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new StageController();