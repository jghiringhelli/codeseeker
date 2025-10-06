/**
 * Base Database Service Interface
 * Provides common interface for all database services
 */

class DatabaseService {
    constructor(name) {
        this.name = name;
        this.connected = false;
    }

    async connect() {
        throw new Error('connect() must be implemented by subclass');
    }

    async disconnect() {
        throw new Error('disconnect() must be implemented by subclass');
    }

    async healthCheck() {
        throw new Error('healthCheck() must be implemented by subclass');
    }

    isConnected() {
        return this.connected;
    }

    getName() {
        return this.name;
    }
}

module.exports = { DatabaseService };