/**
 * Base interface for all analyzers following SOLID principles
 */
class IAnalyzer {
  /**
   * Initialize the analyzer
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Analyze the project
   * @param {Object} params Analysis parameters
   * @returns {Promise<Object>} Analysis results
   */
  async analyze(params) {
    throw new Error('analyze() must be implemented by subclass');
  }

  /**
   * Get analysis statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    throw new Error('getStatistics() must be implemented by subclass');
  }

  /**
   * Cleanup resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Default implementation - can be overridden
  }
}

module.exports = { IAnalyzer };