const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require("path");

const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const statusRoutes = require('./routes/statusRoutes');
const priorityRoutes = require('./routes/priorityRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const recurrenceRoutes = require('./routes/recurrenceRoutes');
const commentRoutes = require('./routes/commentRoutes');
const logRoutes = require('./routes/logRoutes');
const agentRoutes = require('./routes/agentRoutes');
const ErrorMiddleware = require('./middlewares/errorMiddleware');
const { Logger, LOG_LEVELS } = require('./utils/logger');
const { extractUser } = require('./middlewares/authMiddleware');
const cronScheduler = require('./cronScheduler');

const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
const corsOptions = {
  credentials: true,
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['*'];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

// Parse CORS_ORIGIN environment variable
if (process.env.CORS_ORIGIN) {
  if (process.env.CORS_ORIGIN === '*') {
    // Allow any origin (reflect request origin)
    corsOptions.origin = true;
    console.log(`🌐 CORS configured to allow ANY origin (wildcard)`);
  } else if (process.env.CORS_ORIGIN.includes(',')) {
    // Multiple origins - split into array
    corsOptions.origin = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
    console.log(`🌐 CORS configured with multiple origins:`, corsOptions.origin);
  } else {
    // Single origin
    corsOptions.origin = process.env.CORS_ORIGIN;
    console.log(`🌐 CORS configured with single origin: ${corsOptions.origin}`);
  }
} else {
  // Default origin
  corsOptions.origin = 'http://localhost:3000';
  console.log(`🌐 CORS using default origin: ${corsOptions.origin}`);
}

app.use(cors(corsOptions));

// Static files
app.use(express.static("public"));
app.use("/logs", express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para extrair usuário do header/body (simplificado)
app.use(extractUser);

// Add correlation ID and request timing
app.use(ErrorMiddleware.addCorrelationId);
app.use(ErrorMiddleware.logRequestStart);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request start
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Correlation ID: ${req.correlationId}`);
  }
  
  // Log request body for POST/PUT in development
  if (process.env.NODE_ENV === 'development' && (req.method === 'POST' || req.method === 'PUT')) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  
  // Log successful responses
  res.on('finish', async () => {
    const responseTime = Date.now() - startTime;
    
    // Log slow requests (over 1 second)
    if (responseTime > 1000) {
      await Logger.logWarning({
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        message: `Slow request: ${responseTime}ms`,
        requestBody: req.body,
        requestQuery: req.query,
        requestParams: req.params,
        clientIp: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userId: req.user?.id || null,
        correlationId: req.correlationId,
        responseTime
      });
    }
    
    // Log all requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${responseTime}ms)`);
    }
  });
  
  next();
});

// Health check with logging
app.get('/health', async (req, res) => {
  try {
    // Log health check
    await Logger.logInfo({
      endpoint: req.originalUrl,
      method: req.method,
      statusCode: 200,
      message: 'Health check successful',
      correlationId: req.correlationId
    });
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'Task Manager API',
      auth: 'simplified (nickname only)',
      correlationId: req.correlationId
    });
  } catch (error) {
    // Log health check failure
    await Logger.logError(error, req, res, 'SystemError', req.correlationId);
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      correlationId: req.correlationId
    });
  }
});

// Auth Routes
app.use('/api/auth', authRoutes);
app.use('/callback', require('./routes/callbackProxy'));

// Test route for terminal SSE (temporary)
app.post('/api/test/terminal-update', (req, res) => {
  try {
    const { type, content, taskId } = req.body;
    
    console.log(`📡 Terminal update received: ${type} for task ${taskId}`);
    console.log(`   Content: "${content}"`);
    
    // Emitir evento SSE
    const sseService = require('./services/sseService');
    sseService.broadcast('terminal_update', { type, content, taskId });
    
    res.json({ 
      success: true, 
      message: `Terminal update sent for ${type}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in terminal-update:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});


// Logs interface
app.get("/logs", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/error-logs.html"));
});
// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dependencies', require('./routes/dependencyRoutes'));
app.use('/api/statuses', statusRoutes);
app.use('/api/priorities', priorityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/project-types', require('./routes/projectTypeRoutes'));
app.use('/api/recurrence', recurrenceRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/task-history', require('./routes/taskHistoryRoutes'));
app.use('/api/logs', logRoutes);
app.use('/api/models', require('./routes/modelRoutes'));
app.use('/api/task-executions', require('./routes/taskExecutionRoutes'));
app.use('/api/agents', agentRoutes);
app.use('/api', require('./routes/avatarRoutes'));
app.use('/api/stages', require('./routes/stageRoutes'));

// Importar serviço SSE
const sseService = require('./services/sseService');

// Rota para conexão SSE (Server-Sent Events)
app.get('/api/sse/events', (req, res) => {
  sseService.addClient(req, res);
});

// IA Test endpoint
app.get('/api/ia-test', (req, res) => {
  res.json({ 
    message: 'Teste de processamento IA funcionando',
    timestamp: new Date().toISOString(),
    taskId: 'afaa26ed-96d9-4067-a9e9-19e5854cdcec'
  });
});

// Logs endpoints moved to dedicated route (see logRoutes.js)

// 404 handler
// app.use(ErrorMiddleware.notFoundHandler());

// Global error handler
app.use(ErrorMiddleware.handler());

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Database: ${process.env.DATABASE_URL}`);
  console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔓 Auth: Simplificado (apenas nickname, sem senha/tokens)`);
  console.log(`📊 Error logging: ENABLED`);
  
  // Start cron scheduler for recurring tasks
  if (process.env.ENABLE_CRON_SCHEDULER !== 'false') {
    cronScheduler.init();
    console.log('🕐 Cron scheduler enabled for recurring tasks');
  } else {
    console.log('⏸️ Cron scheduler disabled (ENABLE_CRON_SCHEDULER=false)');
  }
});
