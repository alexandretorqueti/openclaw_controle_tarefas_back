const express = require('express');
const router = express.Router();
const prisma = require('../services/prismaService');

// GET /api/priorities - List all priorities
router.get('/', async (req, res) => {
  try {
    const priorities = await prisma.priority.findMany({
      orderBy: {
        weight: 'desc'
      }
    });
    
    return res.status(200).json({
      success: true,
      priorities
    });
    
  } catch (error) {
    console.error('Error fetching priorities:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// GET /api/priorities/:id - Get single priority
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const priority = await prisma.priority.findUnique({
      where: { id }
    });
    
    if (!priority) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prioridade não encontrada' 
      });
    }
    
    return res.status(200).json({
      success: true,
      priority
    });
    
  } catch (error) {
    console.error('Error fetching priority:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// POST /api/priorities - Create new priority
router.post('/', async (req, res) => {
  try {
    const { name, weight } = req.body;
    
    // Validações
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome deve ter pelo menos 2 caracteres' 
      });
    }
    
    if (weight === undefined || weight < 1 || weight > 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Peso deve ser entre 1 e 10' 
      });
    }
    
    // Verificar se já existe prioridade com mesmo nome
    const existingPriority = await prisma.priority.findFirst({
      where: { name: name.trim() }
    });
    
    if (existingPriority) {
      return res.status(400).json({ 
        success: false, 
        message: 'Já existe uma prioridade com este nome' 
      });
    }
    
    // Verificar se já existe prioridade com mesmo peso
    const existingWeight = await prisma.priority.findFirst({
      where: { weight: parseInt(weight) }
    });
    
    if (existingWeight) {
      return res.status(400).json({ 
        success: false, 
        message: 'Já existe uma prioridade com este peso' 
      });
    }
    
    // Criar nova prioridade
    const newPriority = await prisma.priority.create({
      data: {
        name: name.trim(),
        weight: parseInt(weight)
      }
    });
    
    console.log(`✅ Prioridade criada: ${newPriority.name} (ID: ${newPriority.id})`);
    
    return res.status(201).json({
      success: true,
      message: 'Prioridade criada com sucesso',
      priority: newPriority
    });
    
  } catch (error) {
    console.error('Error creating priority:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// PUT /api/priorities/:id - Update priority
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, weight } = req.body;
    
    // Verificar se prioridade existe
    const existingPriority = await prisma.priority.findUnique({
      where: { id }
    });
    
    if (!existingPriority) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prioridade não encontrada' 
      });
    }
    
    // Validações
    if (name && name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome deve ter pelo menos 2 caracteres' 
      });
    }
    
    if (weight !== undefined && (weight < 1 || weight > 10)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Peso deve ser entre 1 e 10' 
      });
    }
    
    // Verificar se já existe outra prioridade com mesmo nome
    if (name && name.trim() !== existingPriority.name) {
      const duplicatePriority = await prisma.priority.findFirst({
        where: { 
          name: name.trim(),
          NOT: { id }
        }
      });
      
      if (duplicatePriority) {
        return res.status(400).json({ 
          success: false, 
          message: 'Já existe outra prioridade com este nome' 
        });
      }
    }
    
    // Verificar se já existe outra prioridade com mesmo peso
    if (weight !== undefined && weight !== existingPriority.weight) {
      const duplicateWeight = await prisma.priority.findFirst({
        where: { 
          weight: parseInt(weight),
          NOT: { id }
        }
      });
      
      if (duplicateWeight) {
        return res.status(400).json({ 
          success: false, 
          message: 'Já existe outra prioridade com este peso' 
        });
      }
    }
    
    // Atualizar prioridade
    const updatedPriority = await prisma.priority.update({
      where: { id },
      data: {
        name: name ? name.trim() : existingPriority.name,
        weight: weight !== undefined ? parseInt(weight) : existingPriority.weight
      }
    });
    
    console.log(`✅ Prioridade atualizada: ${updatedPriority.name} (ID: ${updatedPriority.id})`);
    
    return res.status(200).json({
      success: true,
      message: 'Prioridade atualizada com sucesso',
      priority: updatedPriority
    });
    
  } catch (error) {
    console.error('Error updating priority:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// DELETE /api/priorities/:id - Delete priority
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se prioridade existe
    const existingPriority = await prisma.priority.findUnique({
      where: { id }
    });
    
    if (!existingPriority) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prioridade não encontrada' 
      });
    }
    
    // Verificar se prioridade está sendo usada em tarefas
    const tasksUsingPriority = await prisma.task.findFirst({
      where: { priorityId: id }
    });
    
    if (tasksUsingPriority) {
      return res.status(400).json({ 
        success: false, 
        message: 'Não é possível excluir prioridade que está sendo usada em tarefas' 
      });
    }
    
    // Excluir prioridade
    await prisma.priority.delete({
      where: { id }
    });
    
    console.log(`🗑️ Prioridade excluída: ${existingPriority.name} (ID: ${id})`);
    
    return res.status(200).json({
      success: true,
      message: 'Prioridade excluída com sucesso'
    });
    
  } catch (error) {
    console.error('Error deleting priority:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

module.exports = router;