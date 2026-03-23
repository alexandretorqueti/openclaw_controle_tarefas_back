const { z } = require('zod');

// Helper to validate UUID format (with or without hyphens)
const uuidSchema = z.string().refine((val) => {
  // Remove hyphens
  const clean = val.replace(/-/g, '');
  // Must be 32 hex characters
  if (!/^[0-9a-f]{32}$/i.test(clean)) return false;
  // Optional: validate version bits for UUID v4 (optional)
  // If hyphens present, validate standard positions (8-4-4-4-12)
  if (val.includes('-')) {
    const parts = val.split('-');
    if (parts.length !== 5) return false;
    if (parts[0].length !== 8 || parts[1].length !== 4 || parts[2].length !== 4 || parts[3].length !== 4 || parts[4].length !== 12) return false;
  }
  return true;
}, {
  message: 'Invalid task ID format (must be 32 hex characters, with or without hyphens)'
});

// Schema for creating a comment
const createCommentSchema = z.object({
  content: z.string()
    .min(1, 'Comment content is required'),
  
  taskId: uuidSchema,
  
  userId: uuidSchema,
  
  parentCommentId: uuidSchema
    .optional()
    .nullable()
});

// Schema for updating a comment
const updateCommentSchema = z.object({
  content: z.string()
    .min(1, 'Comment content is required')
    .optional()
});

// Validate comment creation
function validateComment(data) {
  const result = createCommentSchema.safeParse(data);
  
  if (!result.success) {
    return {
      success: false,
      error: {
        message: 'Validation failed',
        errors: result.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      }
    };
  }
  
  return {
    success: true,
    data: result.data
  };
}

// Validate comment update
function validateCommentUpdate(data) {
  const result = updateCommentSchema.safeParse(data);
  
  if (!result.success) {
    return {
      success: false,
      error: {
        message: 'Validation failed',
        errors: result.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      }
    };
  }
  
  return {
    success: true,
    data: result.data
  };
}

module.exports = {
  validateComment,
  validateCommentUpdate
};
