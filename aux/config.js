// aux/config.js

require('dotenv').config();
const path = require('path');

// Caminhos baseados no seu ambiente
const BASE_DIR = '/home/alexandrebragatorqueti/projetos';
const OPENCLAW_DIR = '/home/alexandrebragatorqueti/.openclaw/workspace';
const TASKS_DIR = path.join(OPENCLAW_DIR, 'pending-tasks');
const PROCESSED_DIR = path.join(TASKS_DIR, 'processed');
const ERROR_DIR = path.join(TASKS_DIR, 'error');

const API_URL = process.env.API_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;
const STATE_FILE = path.join(TASKS_DIR, 'monitor-state.json');
const LOG_FILE = path.join(OPENCLAW_DIR, 'jarbas-monitor.log');
const MY_USER_ID = process.env.MY_USER_ID || '0bdc9840-fde8-4008-9c54-47edf5f527f2';

const MAX_LOG_LINES = 1000;
const MINUTOS = 30; // 3 horas para modelos pesados
const TASK_TIMEOUT_MS = MINUTOS * 60 * 1000; // 
const servicesConfig = JSON.parse(process.env.PROJECT_SERVICES || '[]');
const LOCK_FILE = '/home/alexandrebragatorqueti/tmp/.monitor.lock';


const STATUS = {
  IN_PROGRESS: '28a4201d-272e-4e53-8c91-4cd5bf5ea516',
  COMPLETED: 'd9bc0336-0a16-48eb-8fc7-0c5ebec06f97',
};

// Garante que as pastas físicas existam
const fs = require('fs');
[TASKS_DIR, PROCESSED_DIR, ERROR_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

module.exports = {
  BASE_DIR, TASKS_DIR, PROCESSED_DIR, ERROR_DIR, API_URL, 
  STATE_FILE, LOG_FILE, MY_USER_ID, MAX_LOG_LINES, 
  TASK_TIMEOUT_MS, servicesConfig, STATUS, MINUTOS, LOCK_FILE
};

