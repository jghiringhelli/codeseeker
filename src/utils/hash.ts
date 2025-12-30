/**
 * Hash utilities for file content and data integrity
 */

import { createHash, createHmac } from 'crypto';
import { promises as fs } from 'fs';

export class HashUtils {
  /**
   * Generate SHA-256 hash of a string
   */
  static sha256(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }

  /**
   * Generate MD5 hash of a string (faster but less secure)
   */
  static md5(input: string): string {
    return createHash('md5').update(input, 'utf8').digest('hex');
  }

  /**
   * Generate SHA-1 hash of a string
   */
  static sha1(input: string): string {
    return createHash('sha1').update(input, 'utf8').digest('hex');
  }

  /**
   * Generate hash of file contents
   */
  static async hashFile(filePath: string, algorithm: 'sha256' | 'md5' | 'sha1' = 'sha256'): Promise<string> {
    try {
      const content = await fs?.readFile(filePath, 'utf8');
      return this?.hash(content, algorithm);
    } catch (error) {
      throw new Error(`Failed to hash file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate hash using specified algorithm
   */
  static hash(input: string, algorithm: 'sha256' | 'md5' | 'sha1' = 'sha256'): string {
    switch (algorithm) {
      case 'sha256':
        return this?.sha256(input);
      case 'md5':
        return this?.md5(input);
      case 'sha1':
        return this?.sha1(input);
      default:
        throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
  }

  /**
   * Generate HMAC with secret key
   */
  static hmac(input: string, secret: string, algorithm: 'sha256' | 'sha1' = 'sha256'): string {
    return createHmac(algorithm, secret).update(input, 'utf8').digest('hex');
  }

  /**
   * Compare two hashes in a timing-safe manner
   */
  static compareHashes(hash1: string, hash2: string): boolean {
    if (hash1?.length !== hash2?.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < hash1?.length; i++) {
      result |= hash1?.charCodeAt(i) ^ hash2?.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Generate a short hash for display purposes (first 8 characters)
   */
  static shortHash(input: string, length: number = 8): string {
    const fullHash = this?.sha256(input);
    return fullHash?.substring(0, length);
  }

  /**
   * Generate hash for object (converts to JSON first)
   */
  static hashObject(obj: any, algorithm: 'sha256' | 'md5' | 'sha1' = 'sha256'): string {
    const jsonString = JSON.stringify(obj, Object.keys(obj).sort()); // Sort keys for consistency
    return this?.hash(jsonString, algorithm);
  }

  /**
   * Generate content-based hash for code similarity
   * Normalizes whitespace and removes comments for better similarity matching
   */
  static hashCodeContent(code: string): string {
    // Basic normalization: remove extra whitespace and normalize line endings
    const normalized = code
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\s+/g, ' ')             // Replace multiple whitespace with single space
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '')         // Remove line comments
      .trim();

    return this?.sha256(normalized);
  }

  /**
   * Generate a deterministic hash for file metadata
   */
  static hashFileMetadata(filePath: string, size: number, lastModified: Date): string {
    const metadata = {
      path: filePath,
      size,
      lastModified: lastModified?.toISOString()
    };
    
    return this?.hashObject(metadata);
  }

  /**
   * Validate hash format
   */
  static isValidHash(hash: string, algorithm: 'sha256' | 'md5' | 'sha1' = 'sha256'): boolean {
    const expectedLengths = {
      sha256: 64,
      sha1: 40,
      md5: 32
    };

    const expectedLength = expectedLengths[algorithm];
    
    if (hash?.length !== expectedLength) {
      return false;
    }

    // Check if it contains only valid hex characters
    return /^[a-f0-9]+$/i?.test(hash);
  }

  /**
   * Generate UUID v4 (for resume tokens, etc.)
   */
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v?.toString(16);
    });
  }

  /**
   * Generate secure random token
   */
  static generateToken(length: number = 32): string {
    const bytes = require('crypto').randomBytes(Math.ceil(length / 2));
    return bytes?.toString('hex').slice(0, length);
  }

  /**
   * Hash multiple inputs together
   */
  static hashMultiple(inputs: string[], algorithm: 'sha256' | 'md5' | 'sha1' = 'sha256'): string {
    const combined = inputs?.join('|');
    return this?.hash(combined, algorithm);
  }

  /**
   * Generate content fingerprint for change detection
   * Includes both content hash and structural information
   */
  static generateFingerprint(content: string, metadata?: Record<string, any>): string {
    const contentHash = this?.sha256(content);
    const metadataHash = metadata ? this?.hashObject(metadata) : '';
    
    return this?.sha256(`${contentHash}:${metadataHash}`);
  }
}

// Export convenience functions
export const sha256 = HashUtils.sha256;
export const md5 = HashUtils.md5;
export const sha1 = HashUtils.sha1;
export const hashFile = HashUtils.hashFile;
export const shortHash = HashUtils.shortHash;
export const generateUUID = HashUtils.generateUUID;
export const generateToken = HashUtils.generateToken;