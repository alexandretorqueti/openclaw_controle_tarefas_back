const fs = require('fs');
const lockfile = require('proper-lockfile');
const { STATE_FILE } = require('./config');

async function get_state() {
  
  // helper for existence check
  async function fileExists(path) {
    try {
      await fs.promises.access(path, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  if (await fileExists(STATE_FILE)) {
    try {
      await lockfile.lock(STATE_FILE);
      const state = JSON.parse(await fs.promises.readFile(STATE_FILE, 'utf8'));
      state.active_tasks = state.active_tasks || {};
      return state;
    } catch (e) { return { active_tasks: {} }; }
    finally {
      try {
        await lockfile.unlock(STATE_FILE);
      } catch (e) {
        // Se o arquivo de lock não existir, ignora o erro
      }
    }
  }
  
  return { active_tasks: {} };
}

async function save_state(state) {
  await lockfile.lock(STATE_FILE);
  await fs.promises.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  await lockfile.unlock(STATE_FILE);
}

module.exports = { get_state, save_state };