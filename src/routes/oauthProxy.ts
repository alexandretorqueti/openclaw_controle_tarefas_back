import express from 'express';
const router = express.Router();

// Proxy endpoint that redirects to the correct Google OAuth URL
router.get('/proxy/google', (req, res) => {
  const origin = req.query.origin || req.headers.origin || 'http://localhost:3000';
  
  // Determine backend host based on origin
  let backendHost = 'localhost:4001';
  if (origin.includes('192.168.1.70')) {
    backendHost = '192.168.1.70:4001';
  } else if (origin.includes('tarefas.local')) {
    backendHost = 'api.tarefas.local:4001';
  }
  
  // Construct the correct OAuth URL
  const oauthUrl = `http://${backendHost}/auth/google?origin=${encodeURIComponent(origin)}`;
  
  console.log(`🔗 OAuth Proxy: ${origin} -> ${oauthUrl}`);
  res.redirect(oauthUrl);
});

module.exports = router;
