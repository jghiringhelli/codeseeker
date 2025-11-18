/**
 * Error Factory Tests
 * Tests for SOLID-compliant error factory implementation
 */

import { ErrorFactory, errorFactory } from '../../../src/core/factories/error-factory';
import {
  DatabaseError,
  FileSystemError,
  ValidationError,
  NetworkError,
  ProjectError,
  SemanticAnalysisError,
  ClaudeCodeError,
} from '../../../src/core/interfaces/error-interfaces';

describe('ErrorFactory', () => {
  let factory: ErrorFactory;

  beforeEach(() => {
    factory = new ErrorFactory();
  });

  describe('createDatabaseError', () => {
    it('should create a properly formatted database error', () => {
      const error = factory.createDatabaseError(
        'connect',
        'Failed to connect to database',
        { table: 'users', query: 'SELECT * FROM users' }
      );

      expect(error.type).toBe('database');
      expect(error.operation).toBe('connect');
      expect(error.message).toBe('Failed to connect to database');
      expect(error.table).toBe('users');
      expect(error.query).toBe('SELECT * FROM users');
      expect(error.code).toMatch(/^DB_CONNECT_\d{6}$/);
      expect(error.timestamp).toBeDefined();
      expect(new Date(error.timestamp)).toBeInstanceOf(Date);
    });

    it('should work without optional context', () => {
      const error = factory.createDatabaseError('insert', 'Insert failed');

      expect(error.type).toBe('database');
      expect(error.operation).toBe('insert');
      expect(error.message).toBe('Insert failed');
      expect(error.table).toBeUndefined();
      expect(error.query).toBeUndefined();
    });
  });

  describe('createFileSystemError', () => {
    it('should create a properly formatted filesystem error', () => {
      const error = factory.createFileSystemError(
        'read',
        '/test/file.txt',
        'Permission denied'
      );

      expect(error.type).toBe('filesystem');
      expect(error.operation).toBe('read');
      expect(error.path).toBe('/test/file.txt');
      expect(error.message).toBe('Permission denied');
      expect(error.permissions).toBe(true); // Should detect permission error
      expect(error.code).toMatch(/^FS_READ_\d{6}$/);
    });

    it('should detect permission errors in message', () => {
      const error1 = factory.createFileSystemError('write', '/test', 'Permission denied');
      const error2 = factory.createFileSystemError('write', '/test', 'File not found');

      expect(error1.permissions).toBe(true);
      expect(error2.permissions).toBe(false);
    });

    it('should handle all operation types', () => {
      const operations: Array<'read' | 'write' | 'delete' | 'create'> = ['read', 'write', 'delete', 'create'];

      operations.forEach(operation => {
        const error = factory.createFileSystemError(operation, '/test', 'Test error');
        expect(error.operation).toBe(operation);
        expect(error.code).toMatch(new RegExp(`^FS_${operation.toUpperCase()}_\\d{6}$`));
      });
    });
  });

  describe('createValidationError', () => {
    it('should create a properly formatted validation error', () => {
      const error = factory.createValidationError(
        'email',
        'invalid-email',
        'valid email format'
      );

      expect(error.type).toBe('validation');
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
      expect(error.expected).toBe('valid email format');
      expect(error.message).toBe("Validation failed for field 'email': expected valid email format, got string");
      expect(error.code).toMatch(/^VAL_EMAIL_\d{6}$/);
    });

    it('should handle different value types', () => {
      const numberError = factory.createValidationError('age', 25, 'string');
      const objectError = factory.createValidationError('config', { test: true }, 'array');

      expect(numberError.message).toContain('got number');
      expect(objectError.message).toContain('got object');
    });
  });

  describe('createNetworkError', () => {
    it('should create a properly formatted network error', () => {
      const error = factory.createNetworkError(
        'https://api.example.com',
        'POST',
        'Request timeout',
        408
      );

      expect(error.type).toBe('network');
      expect(error.url).toBe('https://api.example.com');
      expect(error.method).toBe('POST');
      expect(error.message).toBe('Request timeout');
      expect(error.statusCode).toBe(408);
      expect(error.timeout).toBe(true); // Should detect timeout
      expect(error.code).toMatch(/^NET_POST_\d{6}$/);
    });

    it('should detect timeout errors in message', () => {
      const timeoutError = factory.createNetworkError('http://test', 'GET', 'Request timeout');
      const notTimeoutError = factory.createNetworkError('http://test', 'GET', 'Server error');

      expect(timeoutError.timeout).toBe(true);
      expect(notTimeoutError.timeout).toBe(false);
    });

    it('should work without status code', () => {
      const error = factory.createNetworkError('http://test', 'GET', 'Network error');

      expect(error.statusCode).toBeUndefined();
      expect(error.url).toBe('http://test');
    });
  });

  describe('createProjectError', () => {
    it('should create a properly formatted project error', () => {
      const error = factory.createProjectError(
        'initialize',
        'Project initialization failed',
        'proj-123',
        '/test/project'
      );

      expect(error.type).toBe('project');
      expect(error.operation).toBe('initialize');
      expect(error.message).toBe('Project initialization failed');
      expect(error.projectId).toBe('proj-123');
      expect(error.projectPath).toBe('/test/project');
      expect(error.code).toMatch(/^PROJ_INITIALIZE_\d{6}$/);
    });

    it('should work with minimal parameters', () => {
      const error = factory.createProjectError('scan', 'Scan failed');

      expect(error.operation).toBe('scan');
      expect(error.message).toBe('Scan failed');
      expect(error.projectId).toBeUndefined();
      expect(error.projectPath).toBeUndefined();
    });
  });

  describe('createSemanticAnalysisError', () => {
    it('should create a properly formatted semantic analysis error', () => {
      const error = factory.createSemanticAnalysisError(
        '/src/test.ts',
        'typescript',
        'syntactic',
        'Unexpected token'
      );

      expect(error.type).toBe('semantic');
      expect(error.filePath).toBe('/src/test.ts');
      expect(error.language).toBe('typescript');
      expect(error.parseStage).toBe('syntactic');
      expect(error.message).toBe('Unexpected token');
      expect(error.code).toMatch(/^SEM_SYNTACTIC_\d{6}$/);
    });

    it('should handle all parse stages', () => {
      const stages: Array<'lexical' | 'syntactic' | 'semantic'> = ['lexical', 'syntactic', 'semantic'];

      stages.forEach(stage => {
        const error = factory.createSemanticAnalysisError('/test.js', 'javascript', stage, 'Test error');
        expect(error.parseStage).toBe(stage);
        expect(error.code).toMatch(new RegExp(`^SEM_${stage.toUpperCase()}_\\d{6}$`));
      });
    });
  });

  describe('createClaudeCodeError', () => {
    it('should create a properly formatted Claude Code error', () => {
      const error = factory.createClaudeCodeError(
        'process_request',
        'API request failed',
        'Test prompt'
      );

      expect(error.type).toBe('claude');
      expect(error.operation).toBe('process_request');
      expect(error.message).toBe('API request failed');
      expect(error.prompt).toBe('Test prompt');
      expect(error.apiError).toBe(true); // Should detect API error
      expect(error.code).toMatch(/^CLAUDE_PROCESS_REQUEST_\d{6}$/);
    });

    it('should detect API errors in message', () => {
      const apiError = factory.createClaudeCodeError('test', 'API connection failed');
      const nonApiError = factory.createClaudeCodeError('test', 'Processing failed');

      expect(apiError.apiError).toBe(true);
      expect(nonApiError.apiError).toBe(false);
    });

    it('should work without prompt', () => {
      const error = factory.createClaudeCodeError('test', 'Test error');

      expect(error.prompt).toBeUndefined();
      expect(error.operation).toBe('test');
    });
  });

  describe('Error Code Generation', () => {
    it('should generate unique error codes', async () => {
      const error1 = factory.createProjectError('test', 'Error 1');
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 2));
      const error2 = factory.createProjectError('test', 'Error 2');

      expect(error1.code).not.toBe(error2.code);
      expect(error1.code).toMatch(/^PROJ_TEST_\d{6}$/);
      expect(error2.code).toMatch(/^PROJ_TEST_\d{6}$/);
    });

    it('should format operation names correctly', () => {
      const error = factory.createProjectError('initialize-project', 'Test error');
      expect(error.code).toMatch(/^PROJ_INITIALIZE-PROJECT_\d{6}$/);
    });
  });

  describe('Timestamp Generation', () => {
    it('should generate valid ISO timestamps', () => {
      const error = factory.createProjectError('test', 'Test error');
      const timestamp = new Date(error.timestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should generate recent timestamps', () => {
      const before = Date.now();
      const error = factory.createProjectError('test', 'Test error');
      const after = Date.now();
      const errorTime = new Date(error.timestamp).getTime();

      expect(errorTime).toBeGreaterThanOrEqual(before);
      expect(errorTime).toBeLessThanOrEqual(after);
    });
  });

  describe('Singleton Instance', () => {
    it('should provide a global singleton instance', () => {
      expect(errorFactory).toBeInstanceOf(ErrorFactory);

      const error1 = errorFactory.createProjectError('test1', 'Test 1');
      const error2 = errorFactory.createProjectError('test2', 'Test 2');

      expect(error1).toBeDefined();
      expect(error2).toBeDefined();
      expect(error1.code).not.toBe(error2.code);
    });
  });
});