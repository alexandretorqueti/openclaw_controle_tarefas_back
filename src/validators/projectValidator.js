const { z } = require('zod');

// Project validator - updated 2026-03-08 for frontend layout refactoring
const projectSchema = z.object({
  name: z.string()
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name must be at most 100 characters'),
  description: z.string()
    .min(1, 'Description must be at least 1 character')
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .or(z.literal('')),
  regras: z.string().optional().nullable(),
  status: z.boolean().optional().default(true),
  ativo: z.boolean().optional().default(true),
  createdById: z.string().uuid('Invalid user ID format'),
  projectTypeId: z.string().uuid('Invalid project type ID format').optional().nullable(),
  // Novos campos
  frontendPath: z.string().optional().nullable(),
  frontendPort: z.number().int().positive().max(65535).optional().nullable(),
  backendPath: z.string().optional().nullable(),
  backendPort: z.number().int().positive().max(65535).optional().nullable(),
  repositoryUrl: z.string().url('Invalid URL format').optional().nullable().or(z.literal('')),
  pastaBase: z.string().optional().nullable(),
  agent: z.string().max(100, 'Agent must be at most 100 characters').optional().nullable(),
  programadorContratado: z.string().max(100, 'Programador contratado must be at most 100 characters').optional().nullable(),
  programadorFront: z.string().max(100).optional().nullable(),
  programadorBack: z.string().max(100).optional().nullable(),
  modeloAuxiliar: z.string().max(100).optional().nullable(),
  frontendBuildCmd: z.string().optional().nullable(),
  backendBuildCmd: z.string().optional().nullable(),
  frontendTestCommand: z.string().optional().nullable(),  // NOVO
  backendTestCommand: z.string().optional().nullable(),   // NOVO
});

const updateProjectSchema = z.object({
  name: z.string()
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name must be at most 100 characters')
    .optional(),
  description: z.string()
    .min(1, 'Description must be at least 1 character')
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .or(z.literal('')),
  regras: z.string().optional().nullable(),
  status: z.boolean().optional(),
  ativo: z.boolean().optional(),
  projectTypeId: z.string().uuid('Invalid project type ID format').optional().nullable(),
  // Novos campos
  frontendPath: z.string().optional().nullable(),
  frontendPort: z.number().int().positive().max(65535).optional().nullable(),
  backendPath: z.string().optional().nullable(),
  backendPort: z.number().int().positive().max(65535).optional().nullable(),
  repositoryUrl: z.string().url('Invalid URL format').optional().nullable().or(z.literal('')),
  pastaBase: z.string().optional().nullable(),
  agent: z.string().max(100, 'Agent must be at most 100 characters').optional().nullable(),
  programadorContratado: z.string().max(100, 'Programador contratado must be at most 100 characters').optional().nullable(),
  programadorFront: z.string().max(100).optional().nullable(),
  programadorBack: z.string().max(100).optional().nullable(),
  modeloAuxiliar: z.string().max(100).optional().nullable(),
  frontendBuildCmd: z.string().optional().nullable(),
  backendBuildCmd: z.string().optional().nullable(),
  frontendTestCommand: z.string().optional().nullable(),  // NOVO
  backendTestCommand: z.string().optional().nullable(),   // NOVO
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