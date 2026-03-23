/**
 * Utility functions for converting between snake_case and camelCase naming conventions.
 * Centralized to eliminate code duplication across controllers.
 */

/**
 * Converts an object or array from snake_case to camelCase.
 * Handles nested objects and arrays recursively.
 * Special handling for JSON strings in recurrenceTimes and recurrenceDays fields.
 * 
 * @param {Object|Array} obj - The object or array to convert
 * @returns {Object|Array} - The converted object or array
 */
function snakeToCamel(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamel(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        const value = obj[key];
        
        // Special handling for JSON strings that should be arrays
        if ((camelKey === 'recurrenceTimes' || camelKey === 'recurrenceDays') && 
            typeof value === 'string') {
          // Handle empty string, "null", or "[]" as null/empty array
          const trimmedValue = value.trim();
          if (trimmedValue === '' || trimmedValue === 'null') {
            newObj[camelKey] = null;
          } else if (trimmedValue === '[]') {
            newObj[camelKey] = [];
          } else if (trimmedValue.startsWith('[')) {
            try {
              newObj[camelKey] = JSON.parse(value);
            } catch (error) {
              console.warn(`Failed to parse ${camelKey} as JSON:`, value, error);
              newObj[camelKey] = null; // Fallback to null instead of keeping invalid string
            }
          } else {
            // If it's a string but not JSON array, treat as null
            newObj[camelKey] = null;
          }
        } else {
          newObj[camelKey] = snakeToCamel(value);
        }
      }
    }
    return newObj;
  }
  
  return obj;
}

/**
 * Converts an object or array from camelCase to snake_case.
 * Handles nested objects and arrays recursively.
 * 
 * @param {Object|Array} obj - The object or array to convert
 * @returns {Object|Array} - The converted object or array
 */
function camelToSnake(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => camelToSnake(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        newObj[snakeKey] = camelToSnake(obj[key]);
      }
    }
    return newObj;
  }
  
  return obj;
}

module.exports = { snakeToCamel, camelToSnake };
