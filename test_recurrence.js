const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRecurrence() {
  try {
    console.log('🔍 Testing recurrence functionality...\n');
    
    // Get some existing IDs
    const projects = await prisma.project.findMany({ take: 1 });
    const statuses = await prisma.status.findMany({ take: 1 });
    const priorities = await prisma.priority.findMany({ take: 1 });
    const users = await prisma.user.findMany({ take: 1 });
    
    if (!projects.length || !statuses.length || !priorities.length || !users.length) {
      console.log('❌ Need at least one record in each table to test');
      return;
    }
    
    const projectId = projects[0].id;
    const statusId = statuses[0].id;
    const priorityId = priorities[0].id;
    const userId = users[0].id;
    
    console.log('📋 Using IDs:');
    console.log(`  Project: ${projectId}`);
    console.log(`  Status: ${statusId}`);
    console.log(`  Priority: ${priorityId}`);
    console.log(`  User: ${userId}\n`);
    
    // Test 1: Create a daily recurring task
    console.log('🧪 Test 1: Creating daily recurring task');
    const dailyTask = await prisma.task.create({
      data: {
        title: 'Daily Recurring Task Test',
        description: 'This task repeats daily at 09:00 and 18:00',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        isRecurring: true,
        recurrenceType: 'daily',
        recurrenceTimes: JSON.stringify(['09:00', '18:00']),
        nextExecutionAt: new Date(new Date().setHours(9, 0, 0, 0)), // 09:00 today
        projectId,
        statusId,
        priorityId,
        createdById: userId,
        assignedToId: userId
      }
    });
    
    console.log(`  ✅ Created task: ${dailyTask.title}`);
    console.log(`    ID: ${dailyTask.id}`);
    console.log(`    Is recurring: ${dailyTask.isRecurring}`);
    console.log(`    Recurrence type: ${dailyTask.recurrenceType}`);
    console.log(`    Recurrence times: ${dailyTask.recurrenceTimes}`);
    console.log(`    Next execution: ${dailyTask.nextExecutionAt}\n`);
    
    // Test 2: Create a weekly recurring task
    console.log('🧪 Test 2: Creating weekly recurring task');
    const weeklyTask = await prisma.task.create({
      data: {
        title: 'Weekly Recurring Task Test',
        description: 'This task repeats on Mondays and Fridays at 10:00',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
        isRecurring: true,
        recurrenceType: 'weekly',
        recurrenceDays: JSON.stringify([1, 5]), // Monday (1) and Friday (5)
        recurrenceTimes: JSON.stringify(['10:00']),
        nextExecutionAt: new Date(new Date().setHours(10, 0, 0, 0)), // 10:00 today
        projectId,
        statusId,
        priorityId,
        createdById: userId,
        assignedToId: userId
      }
    });
    
    console.log(`  ✅ Created task: ${weeklyTask.title}`);
    console.log(`    ID: ${weeklyTask.id}`);
    console.log(`    Recurrence days: ${weeklyTask.recurrenceDays}\n`);
    
    // Test 3: Get recurring tasks due
    console.log('🧪 Test 3: Getting recurring tasks due');
    const dueTasks = await prisma.task.findMany({
      where: {
        isRecurring: true,
        isCompleted: false,
        OR: [
          {
            nextExecutionAt: {
              lte: new Date()
            }
          },
          {
            nextExecutionAt: null,
            lastExecutedAt: null
          }
        ]
      }
    });
    
    console.log(`  Found ${dueTasks.length} recurring task(s) due for execution`);
    dueTasks.forEach(task => {
      console.log(`    - ${task.title} (next: ${task.nextExecutionAt})`);
    });
    console.log();
    
    // Test 4: Mark a task as executed
    console.log('🧪 Test 4: Marking task as executed');
    const updatedTask = await prisma.task.update({
      where: { id: dailyTask.id },
      data: {
        lastExecutedAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    console.log(`  ✅ Task marked as executed`);
    console.log(`    Last executed: ${updatedTask.lastExecutedAt}\n`);
    
    // Test 5: Calculate next execution (simulated)
    console.log('🧪 Test 5: Simulating next execution calculation');
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // Next day at 09:00
    
    const recalculatedTask = await prisma.task.update({
      where: { id: dailyTask.id },
      data: {
        nextExecutionAt: tomorrow
      }
    });
    
    console.log(`  ✅ Next execution recalculated`);
    console.log(`    New next execution: ${recalculatedTask.nextExecutionAt}\n`);
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testRecurrence();