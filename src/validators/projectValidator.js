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
  ativo: z.boolean().optional().default(true),
  createdById: z.string().uuid('Invalid user ID format'),
  // Novos campos
  frontendPath: z.string().optional().nullable(),
  frontendPort: z.number().int().positive().max(65535).optional().nullable(),
  backendPath: z.string().optional().nullable(),
  backendPort: z.number().int().positive().max(65535).optional().nullable(),
  repositoryUrl: z.string().url('Invalid URL format').optional().nullable().or(z.literal('')),
  pastaBase: z.string().optional().nullable()
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
  status: z.boolean().optional(),
  ativo: z.boolean().optional(),
  // Novos campos
  frontendPath: z.string().optional().nullable(),
  frontendPort: z.number().int().positive().max(65535).optional().nullable(),
  backendPath: z.string().optional().nullable(),
  backendPort: z.number().int().positive().max(65535).optional().nullable(),
  repositoryUrl: z.string().url('Invalid URL format').optional().nullable().or(z.literal('')),
  pastaBase: z.string().optional().nullable()
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