/**
 * Hash utilities for file content and data integrity
 */
export declare class HashUtils {
    /**
     * Generate SHA-256 hash of a string
     */
    static sha256(input: string): string;
    /**
     * Generate MD5 hash of a string (faster but less secure)
     */
    static md5(input: string): string;
    /**
     * Generate SHA-1 hash of a string
     */
    static sha1(input: string): string;
    /**
     * Generate hash of file contents
     */
    static hashFile(filePath: string, algorithm?: 'sha256' | 'md5' | 'sha1'): Promise<string>;
    /**
     * Generate hash using specified algorithm
     */
    static hash(input: string, algorithm?: 'sha256' | 'md5' | 'sha1'): string;
    /**
     * Generate HMAC with secret key
     */
    static hmac(input: string, secret: string, algorithm?: 'sha256' | 'sha1'): string;
    /**
     * Compare two hashes in a timing-safe manner
     */
    static compareHashes(hash1: string, hash2: string): boolean;
    /**
     * Generate a short hash for display purposes (first 8 characters)
     */
    static shortHash(input: string, length?: number): string;
    /**
     * Generate hash for object (converts to JSON first)
     */
    static hashObject(obj: any, algorithm?: 'sha256' | 'md5' | 'sha1'): string;
    /**
     * Generate content-based hash for code similarity
     * Normalizes whitespace and removes comments for better similarity matching
     */
    static hashCodeContent(code: string): string;
    /**
     * Generate a deterministic hash for file metadata
     */
    static hashFileMetadata(filePath: string, size: number, lastModified: Date): string;
    /**
     * Validate hash format
     */
    static isValidHash(hash: string, algorithm?: 'sha256' | 'md5' | 'sha1'): boolean;
    /**
     * Generate UUID v4 (for resume tokens, etc.)
     */
    static generateUUID(): string;
    /**
     * Generate secure random token
     */
    static generateToken(length?: number): string;
    /**
     * Hash multiple inputs together
     */
    static hashMultiple(inputs: string[], algorithm?: 'sha256' | 'md5' | 'sha1'): string;
    /**
     * Generate content fingerprint for change detection
     * Includes both content hash and structural information
     */
    static generateFingerprint(content: string, metadata?: Record<string, any>): string;
}
export declare const sha256: typeof HashUtils.sha256;
export declare const md5: typeof HashUtils.md5;
export declare const sha1: typeof HashUtils.sha1;
export declare const hashFile: typeof HashUtils.hashFile;
export declare const shortHash: typeof HashUtils.shortHash;
export declare const generateUUID: typeof HashUtils.generateUUID;
export declare const generateToken: typeof HashUtils.generateToken;
//# sourceMappingURL=hash.d.ts.map