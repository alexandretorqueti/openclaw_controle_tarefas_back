const TaskService = require('../src/services/taskService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('TaskService - Reference Validation', () => {
  let testProject;
  let testStatus;
  let testPriority;
  let testUser1;
  let testUser2;
  let testTask;

  beforeAll(async () => {
    // Clean up and create test data
    await prisma.$transaction([
      prisma.taskHistory.deleteMany(),
      prisma.attachment.deleteMany(),
      prisma.comment.deleteMany(),
      prisma.dependency.deleteMany(),
      prisma.task.deleteMany(),
      prisma.project.deleteMany(),
      prisma.status.deleteMany(),
      prisma.priority.deleteMany(),
      prisma.user.deleteMany()
    ]);

    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        name: 'Test User 1',
        email: 'test1@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?img=1',
        role: 'Admin'
      }
    });

    testUser2 = await prisma.user.create({
      data: {
        name: 'Test User 2',
        email: 'test2@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?img=2',
        role: 'Editor'
      }
    });

    // Create test status
    testStatus = await prisma.status.create({
      data: {
        name: 'Test Status',
        colorCode: '#FF0000',
        isFinalState: false,
        order: 1
      }
    });

    // Create test priority
    testPriority = await prisma.priority.create({
      data: {
        name: 'Test Priority',
        weight: 1
      }
    });

    // Create test project
    testProject = await prisma.project.create({
      data: {
        name: 'Test Project',
        description: 'Test project description',
        status: true,
        createdById: testUser1.id
      }
    });

    // Create a test task
    testTask = await prisma.task.create({
      data: {
        title: 'Test Task',
        description: 'Test task description',
        deadline: new Date('2026-12-31T23:59:59Z'),
        position: 0,
        isCompleted: false,
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('validateReferences', () => {
    it('should validate all references successfully', async () => {
      const validData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        parentTaskId: testTask.id
      };

      await expect(TaskService.validateReferences(validData)).resolves.not.toThrow();
    });

    it('should throw error for non-existent project', async () => {
      const invalidData = {
        projectId: '00000000-0000-0000-0000-000000000000',
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id
      };

      await expect(TaskService.validateReferences(invalidData)).rejects.toThrow(
        /Project with ID .* not found/
      );
    });

    it('should throw error for non-existent status', async () => {
      const invalidData = {
        projectId: testProject.id,
        statusId: '00000000-0000-0000-0000-000000000000',
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id
      };

      await expect(TaskService.validateReferences(invalidData)).rejects.toThrow(
        /Status with ID .* not found/
      );
    });

    it('should throw error for non-existent priority', async () => {
      const invalidData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: '00000000-0000-0000-0000-000000000000',
        createdById: testUser1.id,
        assignedToId: testUser2.id
      };

      await expect(TaskService.validateReferences(invalidData)).rejects.toThrow(
        /Priority with ID .* not found/
      );
    });

    it('should throw error for non-existent creator', async () => {
      const invalidData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: '00000000-0000-0000-0000-000000000000',
        assignedToId: testUser2.id
      };

      await expect(TaskService.validateReferences(invalidData)).rejects.toThrow(
        /Creator with ID .* not found/
      );
    });

    it('should throw error for non-existent assignee', async () => {
      const invalidData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: '00000000-0000-0000-0000-000000000000'
      };

      await expect(TaskService.validateReferences(invalidData)).rejects.toThrow(
        /Assignee with ID .* not found/
      );
    });

    it('should throw error for non-existent parent task', async () => {
      const invalidData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        parentTaskId: '00000000-0000-0000-0000-000000000000'
      };

      await expect(TaskService.validateReferences(invalidData)).rejects.toThrow(
        /Parent task with ID .* not found/
      );
    });

    it('should throw error for parent task in different project', async () => {
      // Create another project
      const otherProject = await prisma.project.create({
        data: {
          name: 'Other Project',
          description: 'Other project description',
          status: true,
          createdById: testUser1.id
        }
      });

      // Create a task in the other project
      const otherTask = await prisma.task.create({
        data: {
          title: 'Other Project Task',
          description: 'Task in other project',
          deadline: new Date('2026-12-31T23:59:59Z'),
          position: 0,
          isCompleted: false,
          projectId: otherProject.id,
          statusId: testStatus.id,
          priorityId: testPriority.id,
          createdById: testUser1.id,
          assignedToId: testUser2.id
        }
      });

      const invalidData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        parentTaskId: otherTask.id
      };

      await expect(TaskService.validateReferences(invalidData)).rejects.toThrow(
        /Parent task belongs to a different project/
      );
    });
  });

  describe('createTask', () => {
    it('should create a task with valid references', async () => {
      const taskData = {
        title: 'New Valid Task',
        description: 'Description of new valid task',
        deadline: '2026-12-31T23:59:59Z',
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id
      };

      const task = await TaskService.createTask(taskData);

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.title).toBe('New Valid Task');
      expect(task.projectId).toBe(testProject.id);
      expect(task.statusId).toBe(testStatus.id);
      expect(task.priorityId).toBe(testPriority.id);
      expect(task.createdById).toBe(testUser1.id);
      expect(task.assignedToId).toBe(testUser2.id);
    });

    it('should create a subtask with valid parent', async () => {
      const subtaskData = {
        title: 'Valid Subtask',
        description: 'Description of valid subtask',
        deadline: '2026-12-31T23:59:59Z',
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        parentTaskId: testTask.id
      };

      const subtask = await TaskService.createTask(subtaskData);

      expect(subtask).toBeDefined();
      expect(subtask.parentTaskId).toBe(testTask.id);
    });

    it('should throw error when creating task with invalid references', async () => {
      const invalidData = {
        title: 'Invalid Task',
        description: 'Task with invalid references',
        deadline: '2026-12-31T23:59:59Z',
        projectId: '00000000-0000-0000-0000-000000000000',
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id
      };

      await expect(TaskService.createTask(invalidData)).rejects.toThrow(
        /Project with ID .* not found/
      );
    });
  });

  describe('validateUpdateReferences', () => {
    it('should validate update references successfully', async () => {
      const updateData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        assignedToId: testUser2.id,
        parentTaskId: null
      };

      await expect(TaskService.validateUpdateReferences(testTask.id, updateData)).resolves.not.toThrow();
    });

    it('should throw error for circular reference', async () => {
      const updateData = {
        parentTaskId: testTask.id // Task cannot be its own parent
      };

      await expect(TaskService.validateUpdateReferences(testTask.id, updateData)).rejects.toThrow(
        /Task cannot be its own parent/
      );
    });

    it('should throw error when task not found', async () => {
      const updateData = {
        statusId: testStatus.id
      };

      await expect(TaskService.validateUpdateReferences('00000000-0000-0000-0000-000000000000', updateData))
        .rejects.toThrow(/Task with ID .* not found/);
    });
  });
});