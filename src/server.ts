import express from 'express';
const cors = require('cors');
require('dotenv').config();
import path from 'path';

const projectRoutes = require('./routes/projectRoutes');
import taskRoutes from './routes/taskRoutes';
const statusRoutes = require('./routes/statusRoutes');
const priorityRoutes = require('./routes/priorityRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const recurrenceRoutes = require('./routes/recurrenceRoutes');
const commentRoutes = require('./routes/commentRoutes');
const logRoutes = require('./routes/logRoutes');
const agentRoutes = require('./routes/agentRoutes');
const ErrorMiddleware = require('./middlewares/errorMiddleware');
import { Logger, LOG_LEVELS } from './utils/logger';
const { extractUser } = require('./middlewares/authMiddleware');
const cronScheduler = require('./cronScheduler');

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Logger
app.use((req, res, next) => {
  if (process.env.LOG_LEVEL !== 'error') {
    // Log request in debug/verbose mode
    Logger.debug(`${req.method} ${req.originalUrl}`);
  }
  next();
});

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/statuses', statusRoutes);
app.use('/api/priorities', priorityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/recurrences', recurrenceRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/agents', agentRoutes);

// Avatar routes endpoint
app.get('/api/avatars/agent-avatars/:agentId/:filename', (req, res) => {
  try {
    const { agentId, filename } = req.params;
    const agent = require('./services/agentService').getAgentById(agentId);
    
    if (!agent || !agent.avatarPath) {
      return res.status(404).json({ error: 'Avatar não encontrado' });
    }
    
    res.sendFile(agent.avatarPath, { root: process.cwd() });
  } catch (error) {
    Logger.error(`Erro ao servir avatar: ${error.message}`);
    res.status(500).json({ error: 'Erro ao servir avatar' });
  }
});

// Callback proxy (Google OAuth)
const callbackProxy = require('./routes/callbackProxy');
app.use('/api/callback-proxy', callbackProxy);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

// ErrorHandler
app.use(ErrorMiddleware);

// Cron scheduler initialization
const scheduler = new cronScheduler;
scheduler.init();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Backend rodando em http://localhost:${PORT}`);
  console.log(`🌐 CORS configurado para: ${process.env.CORS_ORIGIN || 'localhost:3000'}`);
});

export default app;
