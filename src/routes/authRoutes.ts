/**
 * Rotas de Autenticação Simplificadas
 * 
 * Sistema simplificado para uso local. Apenas login por nickname.
 */import express from 'express');
const router = express.Router();
const authController = require('../controllers/authController');
const prisma = require('../services/prismaService';

// POST /api/auth/login - Login por nickname (sem senha)
router.post('/login', authController.login);

// GET /api/auth/me - Obter usuário atual
router.get('/me', authController.getCurrentUser);

// GET /api/auth/check - Verificar status de autenticação
router.get('/check', authController.checkAuth);

// POST /api/auth/check - Verificar status por userId ou nickname
router.post('/check', authController.checkAuth);

// POST /api/auth/logout - Logout
router.post('/logout', authController.logout);

// POST /api/auth/register - Registro simples
router.post('/register', async (req, res) => {
  try {
    const { name, email, nickname } = req.body;
    
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
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email inválido' 
      });
    }
    
    const cleanName = name.trim();
    const cleanNickname = nickname.trim();
    const cleanEmail = email ? email.trim() : null;
    
    // Verificar se nome ou nickname já existem
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { name: cleanName },
          { nickname: cleanNickname }
        ]
      }
    });

    if (existingUser) {
      const field = existingUser.name === cleanName ? 'Nome' : 'Nickname';
      return res.status(400).json({ 
        success: false, 
        message: `${field} já está em uso` 
      });
    }
    
    // Criar novo usuário
    const newUser = await prisma.user.create({
      data: {
        name: cleanName,
        nickname: cleanNickname,
        email: cleanEmail,
        role: 'Viewer'
      }
    });

    console.log(`📝 Registro: ${newUser.name} (${newUser.nickname}) (ID: ${newUser.id})`);
    
    return res.status(200).json({
      success: true,
      message: 'Conta criada com sucesso',
      user: {
        id: newUser.id,
        name: newUser.name,
        nickname: newUser.nickname,
        email: newUser.email,
        role: newUser.role,
        avatarUrl: newUser.avatarUrl
      }
    });
    
  } catch (error) {
    console.error('Erro no registro:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// Rotas OAuth removidas - mantidas para compatibilidade (retornam erro)
router.get('/google', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'OAuth Google foi removido. Use login por nickname em /api/auth/login'
  });
});

router.get('/google/callback', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'OAuth Google foi removido. Use login por nickname.'
  });
});

module.exports = router;
