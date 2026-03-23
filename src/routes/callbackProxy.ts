import express from 'express';
const router = express.Router();
const { passport } = require('../middlewares/authMiddleware');

// Único callback endpoint que o Google conhece
router.get('/google/callback', 
  // Primeiro, autenticar com Google
  passport.authenticate('google', { 
    failureRedirect: '/auth/failure',
    session: true
  }),
  // Depois, redirecionar para a origem correta
  (req, res) => {
    // Obter origem da session ou default
    const origin = req.session?.authOrigin || 'http://localhost:3000';
    
    console.log(`🎯 Callback successful, redirecting to: ${origin}/auth/callback`);
    
    // Redirecionar para frontend correto
    res.redirect(`${origin}/auth/callback`);
  }
);

// Endpoint de falha
router.get('/failure', (req, res) => {
  const origin = req.session?.authOrigin || 'http://localhost:3000';
  res.redirect(`${origin}/login?error=auth_failed`);
});

module.exports = router;
