const express = require('express');
const cors = require('cors');
require('dotenv').config();

const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const statusRoutes = require('./routes/statusRoutes');
const priorityRoutes = require('./routes/priorityRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const recurrenceRoutes = require('./routes/recurrenceRoutes');
const commentRoutes = require('./routes/commentRoutes');
const logRoutes = require('./routes/logRoutes');
const ErrorMiddleware = require('./middlewares/errorMiddleware');
const { Logger, LOG_LEVELS } = require('./utils/logger');
const { passport, sessionConfig, getCurrentUser } = require('./middlewares/authMiddleware');
const cronScheduler = require('./cronScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOptions = {
  credentials: true,
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:3000'];
    
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware (must come before passport)
app.use(require('express-session')(sessionConfig));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Get current user middleware
app.use(getCurrentUser);

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

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/statuses', statusRoutes);
app.use('/api/priorities', priorityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/recurrence', recurrenceRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/logs', logRoutes);

// IA Test endpoint
app.get('/api/ia-test', (req, res) => {
  res.json({ 
    message: 'Teste de processamento IA funcionando',
    timestamp: new Date().toISOString(),
    taskId: 'afaa26ed-96d9-4067-a9e9-19e5854cdcec'
  });
});

// Logs endpoint for debugging (protected in production)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/logs', async (req, res, next) => {
    try {
      const { limit = 50, level, endpoint, startDate, endDate } = req.query;
      
      const logs = await Logger.getLogs({
        limit: parseInt(limit),
        level,
        endpoint,
        startDate,
        endDate
      });
      
      res.json({
        count: logs.length,
        logs
      });
    } catch (error) {
      next(error);
    }
  });
  
  app.get('/api/logs/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const log = await Logger.getLogById(id);
      
      if (!log) {
        return res.status(404).json({
          error: 'Log not found'
        });
      }
      
      res.json(log);
    } catch (error) {
      next(error);
    }
  });
}

// 404 handler
app.use(ErrorMiddleware.notFoundHandler());

// Global error handler
app.use(ErrorMiddleware.handler());

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Database: ${process.env.DATABASE_URL}`);
  console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  console.log(`📊 Error logging: ENABLED`);
  
  // Start cron scheduler for recurring tasks
  if (process.env.ENABLE_CRON_SCHEDULER !== 'false') {
    cronScheduler.init();
    console.log('🕐 Cron scheduler enabled for recurring tasks');
  } else {
    console.log('⏸️ Cron scheduler disabled (ENABLE_CRON_SCHEDULER=false)');
  }

  // Teste completo do novo task-processor - modificação de teste pelo agente Jarbas em 2026-02-25 18:55 GMT-3
});