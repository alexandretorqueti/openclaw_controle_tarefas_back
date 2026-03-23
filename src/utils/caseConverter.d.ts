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
declare function snakeToCamel(obj: any): any;
/**
 * Converts an object or array from camelCase to snake_case.
 * Handles nested objects and arrays recursively.
 *
 * @param {Object|Array} obj - The object or array to convert
 * @returns {Object|Array} - The converted object or array
 */
declare function camelToSnake(obj: any): any;
