"use strict";
/**
 * Hash utilities for file content and data integrity
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.generateUUID = exports.shortHash = exports.hashFile = exports.sha1 = exports.md5 = exports.sha256 = exports.HashUtils = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
class HashUtils {
    /**
     * Generate SHA-256 hash of a string
     */
    static sha256(input) {
        return (0, crypto_1.createHash)('sha256').update(input, 'utf8').digest('hex');
    }
    /**
     * Generate MD5 hash of a string (faster but less secure)
     */
    static md5(input) {
        return (0, crypto_1.createHash)('md5').update(input, 'utf8').digest('hex');
    }
    /**
     * Generate SHA-1 hash of a string
     */
    static sha1(input) {
        return (0, crypto_1.createHash)('sha1').update(input, 'utf8').digest('hex');
    }
    /**
     * Generate hash of file contents
     */
    static async hashFile(filePath, algorithm = 'sha256') {
        try {
            const content = await fs_1.promises.readFile(filePath, 'utf8');
            return this.hash(content, algorithm);
        }
        catch (error) {
            throw new Error(`Failed to hash file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Generate hash using specified algorithm
     */
    static hash(input, algorithm = 'sha256') {
        switch (algorithm) {
            case 'sha256':
                return this.sha256(input);
            case 'md5':
                return this.md5(input);
            case 'sha1':
                return this.sha1(input);
            default:
                throw new Error(`Unsupported hash algorithm: ${algorithm}`);
        }
    }
    /**
     * Generate HMAC with secret key
     */
    static hmac(input, secret, algorithm = 'sha256') {
        return (0, crypto_1.createHmac)(algorithm, secret).update(input, 'utf8').digest('hex');
    }
    /**
     * Compare two hashes in a timing-safe manner
     */
    static compareHashes(hash1, hash2) {
        if (hash1.length !== hash2.length) {
            return false;
        }
        let result = 0;
        for (let i = 0; i < hash1.length; i++) {
            result |= hash1.charCodeAt(i) ^ hash2.charCodeAt(i);
        }
        return result === 0;
    }
    /**
     * Generate a short hash for display purposes (first 8 characters)
     */
    static shortHash(input, length = 8) {
        const fullHash = this.sha256(input);
        return fullHash.substring(0, length);
    }
    /**
     * Generate hash for object (converts to JSON first)
     */
    static hashObject(obj, algorithm = 'sha256') {
        const jsonString = JSON.stringify(obj, Object.keys(obj).sort()); // Sort keys for consistency
        return this.hash(jsonString, algorithm);
    }
    /**
     * Generate content-based hash for code similarity
     * Normalizes whitespace and removes comments for better similarity matching
     */
    static hashCodeContent(code) {
        // Basic normalization: remove extra whitespace and normalize line endings
        const normalized = code
            .replace(/\r\n/g, '\n') // Normalize line endings
            .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
            .replace(/\/\/.*$/gm, '') // Remove line comments
            .trim();
        return this.sha256(normalized);
    }
    /**
     * Generate a deterministic hash for file metadata
     */
    static hashFileMetadata(filePath, size, lastModified) {
        const metadata = {
            path: filePath,
            size,
            lastModified: lastModified.toISOString()
        };
        return this.hashObject(metadata);
    }
    /**
     * Validate hash format
     */
    static isValidHash(hash, algorithm = 'sha256') {
        const expectedLengths = {
            sha256: 64,
            sha1: 40,
            md5: 32
        };
        const expectedLength = expectedLengths[algorithm];
        if (hash.length !== expectedLength) {
            return false;
        }
        // Check if it contains only valid hex characters
        return /^[a-f0-9]+$/i.test(hash);
    }
    /**
     * Generate UUID v4 (for resume tokens, etc.)
     */
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    /**
     * Generate secure random token
     */
    static generateToken(length = 32) {
        const bytes = require('crypto').randomBytes(Math.ceil(length / 2));
        return bytes.toString('hex').slice(0, length);
    }
    /**
     * Hash multiple inputs together
     */
    static hashMultiple(inputs, algorithm = 'sha256') {
        const combined = inputs.join('|');
        return this.hash(combined, algorithm);
    }
    /**
     * Generate content fingerprint for change detection
     * Includes both content hash and structural information
     */
    static generateFingerprint(content, metadata) {
        const contentHash = this.sha256(content);
        const metadataHash = metadata ? this.hashObject(metadata) : '';
        return this.sha256(`${contentHash}:${metadataHash}`);
    }
}
exports.HashUtils = HashUtils;
// Export convenience functions
exports.sha256 = HashUtils.sha256;
exports.md5 = HashUtils.md5;
exports.sha1 = HashUtils.sha1;
exports.hashFile = HashUtils.hashFile;
exports.shortHash = HashUtils.shortHash;
exports.generateUUID = HashUtils.generateUUID;
exports.generateToken = HashUtils.generateToken;
//# sourceMappingURL=hash.js.map