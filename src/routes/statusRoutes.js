const express = require('express');
const router = express.Router();
const prisma = require('../services/prismaService');

// GET /api/statuses - List all statuses
router.get('/', async (req, res) => {
  try {
    const statuses = await prisma.status.findMany({
      orderBy: {
        order: 'asc'
      }
    });
    
    return res.status(200).json({
      success: true,
      statuses
    });
    
  } catch (error) {
    console.error('Error fetching statuses:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// GET /api/statuses/:id - Get single status
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const status = await prisma.status.findUnique({
      where: { id }
    });
    
    if (!status) {
      return res.status(404).json({ 
        success: false, 
        message: 'Status não encontrado' 
      });
    }
    
    return res.status(200).json({
      success: true,
      status
    });
    
  } catch (error) {
    console.error('Error fetching status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// POST /api/statuses - Create new status
router.post('/', async (req, res) => {
  try {
    const { name, colorCode, order, isFinalState } = req.body;
    
    // Validações
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome deve ter pelo menos 2 caracteres' 
      });
    }
    
    if (!colorCode || !/^#[0-9A-F]{6}$/i.test(colorCode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Código de cor inválido (formato: #RRGGBB)' 
      });
    }
    
    if (order === undefined || order < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ordem inválida' 
      });
    }
    
    // Verificar se já existe status com mesmo nome
    const existingStatus = await prisma.status.findFirst({
      where: { name: name.trim() }
    });
    
    if (existingStatus) {
      return res.status(400).json({ 
        success: false, 
        message: 'Já existe um status com este nome' 
      });
    }
    
    // Criar novo status
    const newStatus = await prisma.status.create({
      data: {
        name: name.trim(),
        colorCode: colorCode.trim(),
        order: parseInt(order) || 0,
        isFinalState: Boolean(isFinalState)
      }
    });
    
    console.log(`✅ Status criado: ${newStatus.name} (ID: ${newStatus.id})`);
    
    return res.status(201).json({
      success: true,
      message: 'Status criado com sucesso',
      status: newStatus
    });
    
  } catch (error) {
    console.error('Error creating status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// PUT /api/statuses/:id - Update status
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, colorCode, order, isFinalState } = req.body;
    
    // Verificar se status existe
    const existingStatus = await prisma.status.findUnique({
      where: { id }
    });
    
    if (!existingStatus) {
      return res.status(404).json({ 
        success: false, 
        message: 'Status não encontrado' 
      });
    }
    
    // Validações
    if (name && name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome deve ter pelo menos 2 caracteres' 
      });
    }
    
    if (colorCode && !/^#[0-9A-F]{6}$/i.test(colorCode)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Código de cor inválido (formato: #RRGGBB)' 
      });
    }
    
    if (order !== undefined && order < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ordem inválida' 
      });
    }
    
    // Verificar se já existe outro status com mesmo nome
    if (name && name.trim() !== existingStatus.name) {
      const duplicateStatus = await prisma.status.findFirst({
        where: { 
          name: name.trim(),
          NOT: { id }
        }
      });
      
      if (duplicateStatus) {
        return res.status(400).json({ 
          success: false, 
          message: 'Já existe outro status com este nome' 
        });
      }
    }
    
    // Atualizar status
    const updatedStatus = await prisma.status.update({
      where: { id },
      data: {
        name: name ? name.trim() : existingStatus.name,
        colorCode: colorCode ? colorCode.trim() : existingStatus.colorCode,
        order: order !== undefined ? parseInt(order) : existingStatus.order,
        isFinalState: isFinalState !== undefined ? Boolean(isFinalState) : existingStatus.isFinalState
      }
    });
    
    console.log(`✅ Status atualizado: ${updatedStatus.name} (ID: ${updatedStatus.id})`);
    
    return res.status(200).json({
      success: true,
      message: 'Status atualizado com sucesso',
      status: updatedStatus
    });
    
  } catch (error) {
    console.error('Error updating status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// DELETE /api/statuses/:id - Delete status
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se status existe
    const existingStatus = await prisma.status.findUnique({
      where: { id }
    });
    
    if (!existingStatus) {
      return res.status(404).json({ 
        success: false, 
        message: 'Status não encontrado' 
      });
    }
    
    // Verificar se status está sendo usado em tarefas
    const tasksUsingStatus = await prisma.task.findFirst({
      where: { statusId: id }
    });
    
    if (tasksUsingStatus) {
      return res.status(400).json({ 
        success: false, 
        message: 'Não é possível excluir status que está sendo usado em tarefas' 
      });
    }
    
    // Excluir status
    await prisma.status.delete({
      where: { id }
    });
    
    console.log(`🗑️ Status excluído: ${existingStatus.name} (ID: ${id})`);
    
    return res.status(200).json({
      success: true,
      message: 'Status excluído com sucesso'
    });
    
  } catch (error) {
    console.error('Error deleting status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

module.exports = router;