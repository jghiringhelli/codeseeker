/**
 * Interface for data persistence operations following SOLID principles
 */
class IDataPersister {
  /**
   * Initialize the data persister
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Persist analysis results
   * @param {Object} data Data to persist
   * @returns {Promise<Object>} Persistence results
   */
  async persist(data) {
    throw new Error('persist() must be implemented by subclass');
  }

  /**
   * Retrieve persisted data
   * @param {Object} query Query parameters
   * @returns {Promise<Object>} Retrieved data
   */
  async retrieve(query) {
    throw new Error('retrieve() must be implemented by subclass');
  }

  /**
   * Cleanup resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Default implementation - can be overridden
  }
}

module.exports = { IDataPersister };