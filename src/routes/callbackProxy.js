const express = require('express');
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
    var _a;
    // Obter origem da session ou default
    const origin = ((_a = req.session) === null || _a === void 0 ? void 0 : _a.authOrigin) || 'http://localhost:3000';
    console.log(`🎯 Callback successful, redirecting to: ${origin}/auth/callback`);
    // Redirecionar para frontend correto
    res.redirect(`${origin}/auth/callback`);
});
// Endpoint de falha
router.get('/failure', (req, res) => {
    var _a;
    const origin = ((_a = req.session) === null || _a === void 0 ? void 0 : _a.authOrigin) || 'http://localhost:3000';
    res.redirect(`${origin}/login?error=auth_failed`);
});
module.exports = router;
