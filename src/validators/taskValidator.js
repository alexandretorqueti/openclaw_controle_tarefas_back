const { z } = require('zod');

const taskSchema = z.object({
  title: z.string()
    .min(3, 'Task title must be at least 3 characters')
    .max(200, 'Task title must be at most 200 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .optional()
    .or(z.literal('')),
  deadline: z.string()
    .refine(date => {
      // Aceita tanto formato ISO 8601 completo quanto sem segundos
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
      return isoRegex.test(date) && !isNaN(new Date(date).getTime());
    }, 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS)')
    .refine(date => new Date(date) > new Date(), {
      message: 'Deadline must be in the future'
    }),
  position: z.number().int().min(0).optional().default(0),
  isCompleted: z.boolean().optional().default(false),
  
  // Recurrence fields
  isRecurring: z.boolean().optional().default(false),
  recurrenceType: z.enum(['daily', 'weekly', 'monthly']).optional().nullable(),
  recurrenceTimes: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM'))
    .optional()
    .nullable(),
  recurrenceDays: z.array(z.number().int().min(0).max(6))
    .optional()
    .nullable(),
  
  projectId: z.string().uuid('Invalid project ID format'),
  statusId: z.string().uuid('Invalid status ID format'),
  priorityId: z.string().uuid('Invalid priority ID format'),
  createdById: z.string().uuid('Invalid creator ID format'),
  assignedToId: z.string().uuid('Invalid assignee ID format'),
  
  parentTaskId: z.string().uuid('Invalid parent task ID format').optional().nullable()
});

const updateTaskSchema = z.object({
  title: z.string()
    .min(3, 'Task title must be at least 3 characters')
    .max(200, 'Task title must be at most 200 characters')
    .optional(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .optional(),
  deadline: z.string()
    .refine(date => {
      // Aceita tanto formato ISO 8601 completo quanto sem segundos
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
      return isoRegex.test(date) && !isNaN(new Date(date).getTime());
    }, 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS)')
    .optional(),
  position: z.number().int().min(0).optional(),
  isCompleted: z.boolean().optional(),
  
  // Recurrence fields
  isRecurring: z.boolean().optional(),
  recurrenceType: z.enum(['daily', 'weekly', 'monthly']).optional().nullable(),
  recurrenceTimes: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM'))
    .optional()
    .nullable(),
  recurrenceDays: z.array(z.number().int().min(0).max(6))
    .optional()
    .nullable(),
  
  projectId: z.string().uuid('Invalid project ID format').optional(),
  statusId: z.string().uuid('Invalid status ID format').optional(),
  priorityId: z.string().uuid('Invalid priority ID format').optional(),
  assignedToId: z.string().uuid('Invalid assignee ID format').optional(),
  parentTaskId: z.string().uuid('Invalid parent task ID format').optional().nullable(),
  statusChangeNotes: z.string().max(500).optional(),
  userId: z.string().uuid('Invalid user ID format').optional()
});

const taskFiltersSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format').optional(),
  statusId: z.string().uuid('Invalid status ID format').optional(),
  priorityId: z.string().uuid('Invalid priority ID format').optional(),
  assignedToId: z.string().uuid('Invalid assignee ID format').optional(),
  isCompleted: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['deadline', 'position', 'title', 'createdAt']).optional().default('deadline'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
});

const validateTask = (data) => {
  return taskSchema.safeParse(data);
};

const validateTaskUpdate = (data) => {
  return updateTaskSchema.safeParse(data);
};

const validateTaskFilters = (data) => {
  return taskFiltersSchema.safeParse(data);
};

module.exports = {
  validateTask,
  validateTaskUpdate,
  validateTaskFilters
};