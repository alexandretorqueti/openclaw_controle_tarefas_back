/**
 * Utility function to convert relative avatar URL to absolute URL
 * @param {Object} req - Express request object
 * @param {string} avatarUrl - Avatar URL (could be relative or absolute)
 * @returns {string} Absolute avatar URL
 */
const getAbsoluteAvatarUrl = (req, avatarUrl) => {
  if (!avatarUrl) return avatarUrl;
  
  // If it's already an absolute URL, return as-is
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  
  // If it's a relative URL, make it absolute
  if (avatarUrl.startsWith('/')) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}${avatarUrl}`;
  }
  
  // If it's neither (shouldn't happen), return as-is
  return avatarUrl;
};

export { getAbsoluteAvatarUrl };

export default { getAbsoluteAvatarUrl };