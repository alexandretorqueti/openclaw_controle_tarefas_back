// aux/config.js

require('dotenv').config();
const path = require('path');

// Caminhos baseados no seu ambiente
const BASE_DIR = process.env.BASE_DIR || '/home/alexandrebragatorqueti/projetos';
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/alexandrebragatorqueti/.openclaw/workspace';
const TASKS_DIR = process.env.PENDING_TASKS_DIR || path.join(OPENCLAW_DIR, 'pending-tasks');
const PROCESSED_DIR = path.join(TASKS_DIR, 'processed');
const ERROR_DIR = path.join(TASKS_DIR, 'error');

const API_URL = process.env.API_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;
const STATE_FILE = path.join(TASKS_DIR, 'monitor-state.json');
const LOG_FILE = path.join(OPENCLAW_DIR, 'jarbas-monitor.log');
const MY_USER_ID = process.env.MY_USER_ID || '0bdc9840-fde8-4008-9c54-47edf5f527f2';

const MAX_LOG_LINES = 1000;
const TASK_DEFAULT_TIMEOUT_MINUTES = parseInt(process.env.TASK_DEFAULT_TIMEOUT_MINUTES) || 30;
const MINUTOS = TASK_DEFAULT_TIMEOUT_MINUTES; // For backward compatibility
const TASK_TIMEOUT_MS = TASK_DEFAULT_TIMEOUT_MINUTES * 60 * 1000;
const OPENCLAW_EXECUTION_TIMEOUT_MS = parseInt(process.env.OPENCLAW_EXECUTION_TIMEOUT_MS) || 300000; 
const servicesConfig = JSON.parse(process.env.PROJECT_SERVICES || '[]');
const LOCK_FILE = process.env.LOCK_FILE_PATH || '/home/alexandrebragatorqueti/tmp/.monitor.lock';


const STATUS = {
  IN_PROGRESS: process.env.STATUS_IN_PROGRESS_ID || '28a4201d-272e-4e53-8c91-4cd5bf5ea516',
  COMPLETED: process.env.STATUS_COMPLETED_ID || 'd9bc0336-0a16-48eb-8fc7-0c5ebec06f97',
};

// Garante que as pastas físicas existam
const fs = require('fs');
[TASKS_DIR, PROCESSED_DIR, ERROR_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

module.exports = {
  BASE_DIR, TASKS_DIR, PROCESSED_DIR, ERROR_DIR, API_URL, 
  STATE_FILE, LOG_FILE, MY_USER_ID, MAX_LOG_LINES, 
  TASK_TIMEOUT_MS, servicesConfig, STATUS, MINUTOS, LOCK_FILE,
  OPENCLAW_EXECUTION_TIMEOUT_MS,
  DEBUG_TASK_ANALYSIS: process.env.DEBUG_TASK_ANALYSIS === 'true',
  DEBUG_TASK_PROMPT: process.env.DEBUG_TASK_PROMPT === 'true',
  DEBUG_TASK_CONTRACT: process.env.DEBUG_TASK_CONTRACT === 'true'
};

