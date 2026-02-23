const { z } = require('zod');

const projectSchema = z.object({
  name: z.string()
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name must be at most 100 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .or(z.literal('')),
  regras: z.string().optional().nullable(),
  status: z.boolean().optional().default(true),
  createdById: z.string().uuid('Invalid user ID format')
});

const updateProjectSchema = z.object({
  name: z.string()
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name must be at most 100 characters')
    .optional(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  regras: z.string().optional().nullable(),
  status: z.boolean().optional()
});

const validateProject = (data) => {
  return projectSchema.safeParse(data);
};

const validateProjectUpdate = (data) => {
  return updateProjectSchema.safeParse(data);
};

module.exports = {
  validateProject,
  validateProjectUpdate
};