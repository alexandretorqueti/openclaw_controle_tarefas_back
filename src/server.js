const express = require('express');
const cors = require('cors');
require('dotenv').config();

const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const authRoutes = require('./routes/authRoutes');
const statusRoutes = require('./routes/statusRoutes');
const priorityRoutes = require('./routes/priorityRoutes');
const userRoutes = require('./routes/userRoutes');
const recurrenceRoutes = require('./routes/recurrenceRoutes');
const cronScheduler = require('./cronScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOptions = {
  credentials: true
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

// Debug middleware - log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Body received:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Task Manager API'
  });
});

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/statuses', statusRoutes);
app.use('/api/priorities', priorityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/recurrence', recurrenceRoutes);

// Rotas de autenticação
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Database: ${process.env.DATABASE_URL}`);
  console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN}`);
  
  // Start cron scheduler for recurring tasks
  if (process.env.ENABLE_CRON_SCHEDULER !== 'false') {
    cronScheduler.init();
    console.log('🕐 Cron scheduler enabled for recurring tasks');
  } else {
    console.log('⏸️ Cron scheduler disabled (ENABLE_CRON_SCHEDULER=false)');
  }
});
