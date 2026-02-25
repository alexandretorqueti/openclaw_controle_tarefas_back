const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { passport } = require('../middlewares/authMiddleware');

// GET /auth/google - Initiate Google OAuth
router.get('/google', 
  (req, res, next) => {
    // Store the origin (frontend URL) in session so we know where to redirect back
    const origin = req.query.origin || req.headers.origin || req.headers.referer || 'http://localhost:3000';
    
    // Extract just the base URL (remove paths)
    const url = new URL(origin);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Determine backend URL based on frontend URL
    let backendHost = 'localhost:3001';
    if (baseUrl.includes('192.168.1.70')) {
      backendHost = '192.168.1.70:3001';
    } else if (baseUrl.includes('tarefas.local')) {
      backendHost = 'api.tarefas.local:3001';
    }
    
    // Create dynamic callback URL
    const callbackURL = `http://${backendHost}/auth/google/callback`;
    
    // List of allowed frontend URLs
    const allowedFrontendUrls = process.env.FRONTEND_URLS 
      ? process.env.FRONTEND_URLS.split(',') 
      : ['http://localhost:3000', 'http://192.168.1.70:3000', 'http://tarefas.local:3000'];
    
    // Check if the origin is allowed
    if (allowedFrontendUrls.includes(baseUrl)) {
      req.session.authOrigin = baseUrl;
      req.session.callbackURL = callbackURL;
      console.log(`📥 Storing auth origin: ${baseUrl}`);
      console.log(`📥 Using callback URL: ${callbackURL}`);
    } else {
      console.log(`⚠️  Origin not allowed: ${baseUrl}, using default`);
      req.session.authOrigin = allowedFrontendUrls[0];
      req.session.callbackURL = `http://localhost:3001/auth/google/callback`;
    }
    
    // Pass the callback URL as state parameter to Google OAuth
    const state = JSON.stringify({
      callbackURL: req.session.callbackURL,
      authOrigin: req.session.authOrigin
    });
    
    // Use custom authenticate with state
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      prompt: 'select_account',
      state: Buffer.from(state).toString('base64') // Encode state as base64
    })(req, res, next);
  }
);

// GET /auth/google/callback - Google OAuth callback
router.get('/google/callback',
  (req, res, next) => {
    try {
      // Decode state parameter if present
      if (req.query.state) {
        const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
        console.log('📦 Decoded state:', state);
        
        // Update session with state data
        if (state.authOrigin) {
          req.session.authOrigin = state.authOrigin;
        }
        if (state.callbackURL) {
          req.session.callbackURL = state.callbackURL;
          
          // Update Passport strategy with correct callbackURL
          const { updateGoogleStrategyCallbackURL } = require('../middlewares/authMiddleware');
          updateGoogleStrategyCallbackURL(state.callbackURL);
        }
      }
      
      // Use stored session data as fallback
      const authOrigin = req.session?.authOrigin || 'http://localhost:3000';
      const callbackURL = req.session?.callbackURL || 'http://localhost:3001/auth/google/callback';
      
      console.log(`🎯 Callback processing - Auth Origin: ${authOrigin}, Callback URL: ${callbackURL}`);
      
      // Authenticate with Google
      passport.authenticate('google', { 
        failureRedirect: `${authOrigin}/login?error=auth_failed`,
        session: true
      })(req, res, next);
    } catch (error) {
      console.error('❌ Error processing OAuth callback:', error);
      // Fallback to default
      passport.authenticate('google', { 
        failureRedirect: 'http://localhost:3000/login?error=auth_failed',
        session: true
      })(req, res, next);
    }
  },
  authController.googleAuthCallback
);

// GET /auth/me - Get current user
router.get('/me', authController.getCurrentUser);

// GET /auth/check - Check authentication status (session-based)
router.get('/check', authController.checkAuth);

// POST /auth/check - Check authentication status (session-based) or specific user by ID
router.post('/check', (req, res) => {
  try {
    const { userId } = req.body;
    
    // If userId is provided, check that specific user in database
    if (userId) {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          nickname: true,
          email: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      }).then(user => {
        prisma.$disconnect();
        
        if (user) {
          return res.json({
            isAuthenticated: true,
            user: user
          });
        } else {
          return res.json({
            isAuthenticated: false,
            user: null
          });
        }
      }).catch(error => {
        console.error('Error checking user by ID:', error);
        prisma.$disconnect();
        
        return res.status(500).json({
          isAuthenticated: false,
          message: 'Error checking user'
        });
      });
    } else {
      // No userId provided, delegate to session-based authentication check
      console.log(`🔐 POST /auth/check - No userId, using session authentication`);
      return authController.checkAuth(req, res);
    }
    
  } catch (error) {
    console.error('Error in POST /auth/check:', error);
    return res.status(500).json({
      isAuthenticated: false,
      message: 'Internal server error'
    });
  }
});

// POST /auth/logout - Logout
router.post('/logout', authController.logout);

// --- SIMPLE AUTHENTICATION ---
// POST /auth/login - Simple authentication (using name as identifier)
router.post('/login', (req, res, next) => {
  try {
    const { nickname } = req.body;
    
    if (!nickname || nickname.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Identificador deve ter pelo menos 2 caracteres' 
      });
    }
    
    const identifier = nickname.trim();
    
    // Verificar se usuário existe no banco de dados
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Buscar usuário por nickname (usando nickname como identificador)
    prisma.user.findFirst({
      where: {
        nickname: identifier
      }
    }).then(existingUser => {
      if (existingUser) {
        console.log(`🔐 Login simples (existente): ${existingUser.name} (${existingUser.nickname}) (ID: ${existingUser.id})`);
        
        // Atualizar updatedAt (substitui lastLogin)
        prisma.user.update({
          where: { id: existingUser.id },
          data: { updatedAt: new Date() }
        }).then(() => {
          prisma.$disconnect();
          
          // Logar o usuário manualmente (criar sessão)
          req.login(existingUser, (err) => {
            if (err) {
              console.error('Erro ao criar sessão:', err);
              return res.status(500).json({ 
                success: false, 
                message: 'Erro ao criar sessão de login' 
              });
            }
            
            console.log(`✅ Sessão criada para: ${existingUser.name} (${existingUser.id})`);
            
            return res.status(200).json({
              success: true,
              message: 'Login realizado com sucesso',
              user: {
                id: existingUser.id,
                name: existingUser.name,
                email: existingUser.email,
                role: existingUser.role,
                avatarUrl: existingUser.avatarUrl,
                isAuthenticated: true
              }
            });
          });
        });
      } else {
        // Não criar novo usuário (banco requer email/nickname)
        prisma.$disconnect();
        
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado. Use um usuário existente ou cadastre-se via Google OAuth.'
        });
      }
    }).catch(error => {
      console.error('Erro no login simples:', error);
      prisma.$disconnect();
      
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno no servidor' 
      });
    });
    
  } catch (error) {
    console.error('Erro no login simples:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

// POST /auth/register - Simple registration
router.post('/register', (req, res) => {
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
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    prisma.user.findFirst({
      where: {
        OR: [
          { name: cleanName },
          { nickname: cleanNickname }
        ]
      }
    }).then(existingUser => {
      if (existingUser) {
        prisma.$disconnect();
        const field = existingUser.name === cleanName ? 'Nome' : 'Nickname';
        return res.status(400).json({ 
          success: false, 
          message: `${field} já está em uso` 
        });
      }
      
      // Criar novo usuário
      const newUserData = {
        name: cleanName,
        nickname: cleanNickname,
        email: cleanEmail,
        role: 'Viewer' // Role padrão
      };
      
      prisma.user.create({
        data: newUserData
      }).then(newUser => {
        console.log(`📝 Registro simples: ${newUser.name} (${newUser.nickname}) (ID: ${newUser.id})`);
        prisma.$disconnect();
        
        return res.status(200).json({
          success: true,
          message: 'Conta criada com sucesso',
          user: {
            id: newUser.id,
            name: newUser.name,
            nickname: newUser.nickname,
            email: newUser.email,
            role: newUser.role,
            avatarUrl: newUser.avatarUrl,
            isAuthenticated: true
          }
        });
      });
    }).catch(error => {
      console.error('Erro no registro simples:', error);
      prisma.$disconnect();
      
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno no servidor' 
      });
    });
    
  } catch (error) {
    console.error('Erro no registro simples:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no servidor' 
    });
  }
});

module.exports = router;