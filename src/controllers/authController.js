const ErrorMiddleware = require('../middlewares/errorMiddleware');
const prisma = require('../services/prismaService');

class AuthController {
  // Initiate Google OAuth login
  googleAuth = ErrorMiddleware.catchAsync(async (req, res, next) => {
    // Passport will handle the redirect
    console.log('🔐 Initiating Google OAuth login');
  });

  // Google OAuth callback
  googleAuthCallback = ErrorMiddleware.catchAsync(async (req, res, next) => {
    console.log('🔐 Google OAuth callback received');
    
    // Determine which frontend URL to redirect to based on referer or session
    let frontendUrl = 'http://localhost:3000';
    
    // Check if we have a stored origin in session
    if (req.session.authOrigin) {
      frontendUrl = req.session.authOrigin;
      console.log(`📤 Redirecting to stored origin: ${frontendUrl}`);
    } 
    // Check referer header from Google
    else if (req.headers.referer) {
      console.log(`📤 Referer from Google: ${req.headers.referer}`);
    }
    
    // List of allowed frontend URLs
    const allowedFrontendUrls = process.env.FRONTEND_URLS 
      ? process.env.FRONTEND_URLS.split(',') 
      : ['http://localhost:3000', 'http://192.168.1.70:3000', 'http://tarefas.local:3000'];
    
    // Ensure the URL is allowed
    if (!allowedFrontendUrls.includes(frontendUrl)) {
      frontendUrl = allowedFrontendUrls[0];
      console.log(`⚠️  Frontend URL not allowed, defaulting to: ${frontendUrl}`);
    }
    
    console.log(`🎯 Redirecting to: ${frontendUrl}/auth/callback`);
    
    // Successful authentication, redirect to frontend
    res.redirect(`${frontendUrl}/auth/callback`);
  });

  // Login by nickname
  login = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { nickname } = req.body;

    if (!nickname) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Nickname is required'
      });
    }

    // Buscar usuário pelo nickname
    const user = await prisma.user.findUnique({
      where: { nickname },
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
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found with this nickname'
      });
    }

    // Logar o usuário manualmente (sem senha, apenas sessão)
    req.login(user, (err) => {
      if (err) {
        console.error('❌ Error logging in user:', err);
        return next(err);
      }

      console.log(`✅ User logged in by nickname: ${user.nickname} (${user.name})`);
      
      res.json({
        message: 'Login successful',
        user: user,
        correlationId: req.correlationId
      });
    });
  });

  // Get current user
  getCurrentUser = ErrorMiddleware.catchAsync(async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No user logged in'
      });
    }

    res.json({
      user: req.user,
      correlationId: req.correlationId
    });
  });

  // Logout
  logout = ErrorMiddleware.catchAsync(async (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      
      req.session.destroy((err) => {
        if (err) {
          console.error('❌ Error destroying session:', err);
        }
        
        // Clear session cookie
        res.clearCookie('connect.sid');
        
        res.json({
          message: 'Logged out successfully',
          correlationId: req.correlationId
        });
      });
    });
  });

  // Check authentication status
  checkAuth = ErrorMiddleware.catchAsync(async (req, res, next) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      user: req.isAuthenticated() ? req.user : null,
      correlationId: req.correlationId
    });
  });
}

module.exports = new AuthController();