const express = require('express');
const router = express.Router();

// Armazenamento simples em memória (para desenvolvimento)
const users = new Map();

// Rota de login/cadastro simples
router.post('/simple-auth/login', (req, res) => {
  try {
    const { nickname } = req.body;
    
    if (!nickname || nickname.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nickname deve ter pelo menos 2 caracteres' 
      });
    }
    
    const cleanNickname = nickname.trim().toLowerCase();
    
    // Verifica se já existe um usuário com esse nickname (case-insensitive)
    let existingUser = null;
    for (const [id, u] of users.entries()) {
      if (u.nickname.toLowerCase() === cleanNickname) {
        existingUser = u;
        break;
      }
    }

    if (existingUser) {
      console.log(`🔐 Login simples (existente): ${existingUser.nickname} (ID: ${existingUser.id})`);
      return res.status(200).json({
        success: true,
        message: 'Login realizado com sucesso',
        user: {
          id: existingUser.id,
          nickname: existingUser.nickname,
          isAuthenticated: true
        }
      });
    }
    
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newUser = {
      id: userId,
      nickname: nickname.trim(), // Mantém casing original no display
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    // Armazena usuário (em memória para DEV)
    users.set(userId, newUser);
    
    console.log(`🔐 Login simples (novo): ${newUser.nickname} (ID: ${userId})`);
    
    // Retorna sucesso
    return res.status(200).json({
      success: true,
      message: 'Conta criada e login realizado com sucesso',
      user: {
        id: userId,
        nickname: newUser.nickname,
        isAuthenticated: true
      }
    });
    
  } catch (error) {
    console.error('Erro no login simples:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// Rota para verificar autenticação
router.get('/check', (req, res) => {
  // Em modo simples, se houver um usuário na query ou se quisermos simular
  // (Como o sistema atual não usa sessions persistentes para simple-auth em memória,
  // vamos permitir que o frontend controle o estado ou usar uma lógica básica)
  
  // Nota: Para persistência real entre reloads sem sessions complexas em DEV,
  // poderíamos usar cookies, mas aqui vamos apenas garantir que não dê 404
  return res.status(200).json({
    isAuthenticated: false,
    message: 'Sistema aguardando autenticação'
  });
});

// Rota de logout
router.post('/logout', (req, res) => {
  // Em modo simples, apenas confirma logout
  return res.status(200).json({
    success: true,
    message: 'Logout realizado'
  });
});

module.exports = router;
