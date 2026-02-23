const express = require('express');
const router = express.Router();
const prisma = require('../services/prismaService');

// Rota de cadastro/registro
router.post('/register', async (req, res) => {
  try {
    const { name, nickname, email } = req.body;
    
    // Validações
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome deve ter pelo menos 2 caracteres' 
      });
    }
    
    if (!nickname || nickname.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nickname deve ter pelo menos 2 caracteres' 
      });
    }
    
    const cleanNickname = nickname.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    
    // Verificar se nickname já existe
    const existingNickname = await prisma.user.findUnique({
      where: { nickname: cleanNickname }
    });
    
    if (existingNickname) {
      return res.status(400).json({ 
        success: false, 
        message: 'Este nickname já está em uso' 
      });
    }
    
    // Verificar se email já existe (se fornecido)
    if (cleanEmail) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: cleanEmail }
      });
      
      if (existingEmail) {
        return res.status(400).json({ 
          success: false, 
          message: 'Este email já está em uso' 
        });
      }
    }
    
    // Criar novo usuário
    const newUser = await prisma.user.create({
      data: {
        name: cleanName,
        nickname: cleanNickname,
        email: cleanEmail,
        role: 'Viewer' // Default role
      }
    });
    
    console.log(`✅ Usuário cadastrado (DEV): ${newUser.nickname} (ID: ${newUser.id})`);
    
    return res.status(201).json({
      success: true,
      message: 'Cadastro realizado com sucesso',
      user: {
        id: newUser.id,
        name: newUser.name,
        nickname: newUser.nickname,
        email: newUser.email,
        role: newUser.role,
        isAuthenticated: true
      }
    });
    
  } catch (error) {
    console.error('Erro no cadastro (DEV):', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// Rota de login
router.post('/login', async (req, res) => {
  try {
    const { nickname } = req.body;
    
    if (!nickname || nickname.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nickname deve ter pelo menos 2 caracteres' 
      });
    }
    
    const cleanNickname = nickname.trim().toLowerCase();
    
    // Buscar usuário pelo nickname
    const user = await prisma.user.findUnique({
      where: { nickname: cleanNickname }
    });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuário não encontrado' 
      });
    }
    
    console.log(`🔐 Login realizado (DEV): ${user.nickname} (ID: ${user.id})`);
    
    return res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isAuthenticated: true
      }
    });
    
  } catch (error) {
    console.error('Erro no login (DEV):', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// Rota para verificar autenticação (por ID)
router.post('/check', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(200).json({
        isAuthenticated: false,
        message: 'Nenhum usuário autenticado'
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(200).json({
        isAuthenticated: false,
        message: 'Usuário não encontrado'
      });
    }
    
    return res.status(200).json({
      isAuthenticated: true,
      user: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl
      }
    });
    
  } catch (error) {
    console.error('Erro ao verificar autenticação (DEV):', error);
    return res.status(200).json({
      isAuthenticated: false,
      message: 'Erro ao verificar autenticação'
    });
  }
});

// Rota para listar todos os usuários (para desenvolvimento)
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return res.status(200).json({
      success: true,
      users
    });
    
  } catch (error) {
    console.error('Erro ao listar usuários (DEV):', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// Rota de logout
router.post('/logout', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logout realizado'
  });
});

// Mantendo a rota simple-auth para compatibilidade durante transição
router.post('/simple-auth/login', (req, res) => {
  return res.status(200).json({
    success: false,
    message: 'Sistema de autenticação atualizado. Use /api/auth/register ou /api/auth/login'
  });
});

module.exports = router;