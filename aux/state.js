const fs = require('fs');
const { STATE_FILE } = require('./config');

function get_state() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE));
      state.active_tasks = state.active_tasks || {};
      return state;
    } catch (e) { return { active_tasks: {} }; }
  }
  return { active_tasks: {} };
}

function save_state(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

module.exports = { get_state, save_state };