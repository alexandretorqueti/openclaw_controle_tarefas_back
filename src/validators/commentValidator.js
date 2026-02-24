const { z } = require('zod');

// Schema for creating a comment
const createCommentSchema = z.object({
  content: z.string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment content cannot exceed 2000 characters'),
  
  taskId: z.string()
    .uuid('Invalid task ID format'),
  
  userId: z.string()
    .uuid('Invalid user ID format'),
  
  parentCommentId: z.string()
    .uuid('Invalid parent comment ID format')
    .optional()
    .nullable()
});

// Schema for updating a comment
const updateCommentSchema = z.object({
  content: z.string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment content cannot exceed 2000 characters')
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