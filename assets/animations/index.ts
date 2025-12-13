/**
 * Lottie Animation Assets Index
 * Import and export all Lottie JSON files for easy access
 */

export const sparklesAnimation = require('./sparkles.json');
export const scanAnimation = require('./scan.json');
export const brainAnimation = require('./brain.json');
export const trendingAnimation = require('./trending.json');

// Export as a collection for easy iteration
export const animations = {
  sparkles: sparklesAnimation,
  scan: scanAnimation,
  brain: brainAnimation,
  trending: trendingAnimation,
};

export default animations;
