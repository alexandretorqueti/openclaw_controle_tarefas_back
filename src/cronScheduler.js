var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const cron = require('node-cron');
const taskService = require('./services/taskService');
class CronScheduler {
    constructor() {
        this.jobs = [];
    }
    // Initialize the scheduler
    init() {
        /*console.log('🕐 Initializing cron scheduler for recurring tasks...');
        
        // Schedule task to check for due recurring tasks every minute
        const checkJob = cron.schedule('* * * * *', async () => {
          await this.checkAndExecuteDueTasks();
        });
        
        this.jobs.push(checkJob);
        
        console.log('✅ Cron scheduler initialized. Checking for due tasks every minute.');
        */
    }
    // Stop all scheduled jobs
    stop() {
        this.jobs.forEach(job => job.stop());
        console.log('🛑 Cron scheduler stopped.');
    }
    // Check and execute due recurring tasks
    checkAndExecuteDueTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const dueTasks = yield taskService.getRecurringTasksDue();
                if (dueTasks.length === 0) {
                    console.log(`[${new Date().toISOString()}] No recurring tasks due for execution.`);
                    return;
                }
                console.log(`[${new Date().toISOString()}] Found ${dueTasks.length} recurring task(s) due for execution.`);
                let executedCount = 0;
                let errorCount = 0;
                for (const task of dueTasks) {
                    try {
                        console.log(`  → Executing task: ${task.title} (ID: ${task.id})`);
                        const updatedTask = yield taskService.markTaskAsExecuted(task.id);
                        console.log(`    ✓ Task executed successfully. Next execution: ${updatedTask.nextExecutionAt}`);
                        executedCount++;
                        // Here you could add additional logic like:
                        // - Send notifications
                        // - Create task history entries
                        // - Trigger webhooks
                    }
                    catch (error) {
                        console.error(`    ✗ Error executing task ${task.id}:`, error.message);
                        errorCount++;
                    }
                }
                console.log(`[${new Date().toISOString()}] Execution summary: ${executedCount} executed, ${errorCount} errors`);
            }
            catch (error) {
                console.error(`[${new Date().toISOString()}] Error in cron scheduler:`, error);
            }
        });
    }
    // Manually trigger task execution (for testing or manual runs)
    manualExecuteDueTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Manually executing due recurring tasks...');
            yield this.checkAndExecuteDueTasks();
        });
    }
    // Get scheduler status
    getStatus() {
        return {
            active: this.jobs.length > 0,
            jobCount: this.jobs.length,
            nextRun: this.jobs[0] ? 'Every minute' : 'Not scheduled'
        };
    }
}
// Create singleton instance
const scheduler = new CronScheduler();
// Export for use in server.js
module.exports = scheduler;
// If this file is run directly, start the scheduler (for testing)
if (require.main === module) {
    console.log('🚀 Starting cron scheduler in standalone mode...');
    scheduler.init();
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT. Stopping scheduler...');
        scheduler.stop();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM. Stopping scheduler...');
        scheduler.stop();
        process.exit(0);
    });
}
