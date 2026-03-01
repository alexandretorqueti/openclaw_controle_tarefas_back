const fs = require('fs');
const lockfile = require('proper-lockfile');
const { STATE_FILE } = require('./config');

async function get_state() {
  await lockfile.lock(STATE_FILE);
  if (fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE));
      state.active_tasks = state.active_tasks || {};
      return state;
    } catch (e) { return { active_tasks: {} }; }
  }
  await lockfile.unlock(STATE_FILE);
  return { active_tasks: {} };
}

async function save_state(state) {
  await lockfile.lock(STATE_FILE);
  await fs.promises.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  await lockfile.unlock(STATE_FILE);
}

module.exports = { get_state, save_state };