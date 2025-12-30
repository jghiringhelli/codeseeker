/**
 * Error Interfaces Tests
 * Tests for SOLID-compliant error handling interfaces
 */

import {
  BaseError,
  DatabaseError,
  FileSystemError,
  ValidationError,
  NetworkError,
  ProjectError,
  SemanticAnalysisError,
  ClaudeCodeError,
  CodeMindError,
  SuccessResult,
  ErrorResult,
  Result,
} from '../../../src/core/interfaces/error-interfaces';

describe('Error Interfaces', () => {
  describe('BaseError', () => {
    it('should have required properties', () => {
      const error: BaseError = {
        code: 'TEST_001',
        message: 'Test error message',
        timestamp: new Date().toISOString(),
      };

      expect(error.code).toBe('TEST_001');
      expect(error.message).toBe('Test error message');
      expect(error.timestamp).toBeDefined();
    });

    it('should allow optional context', () => {
      const error: BaseError = {
        code: 'TEST_002',
        message: 'Test error with context',
        timestamp: new Date().toISOString(),
        context: { additionalInfo: 'test data' },
      };

      expect(error.context).toEqual({ additionalInfo: 'test data' });
    });
  });

  describe('DatabaseError', () => {
    it('should extend BaseError with database-specific properties', () => {
      const dbError: DatabaseError = {
        type: 'database',
        code: 'DB_001',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
        operation: 'connect',
        table: 'users',
        query: 'SELECT * FROM users',
      };

      expect(dbError.type).toBe('database');
      expect(dbError.operation).toBe('connect');
      expect(dbError.table).toBe('users');
      expect(dbError.query).toBe('SELECT * FROM users');
    });
  });

  describe('FileSystemError', () => {
    it('should handle file operation errors', () => {
      const fsError: FileSystemError = {
        type: 'filesystem',
        code: 'FS_001',
        message: 'File not found',
        timestamp: new Date().toISOString(),
        operation: 'read',
        path: '/test/file.txt',
        permissions: false,
      };

      expect(fsError.type).toBe('filesystem');
      expect(fsError.operation).toBe('read');
      expect(fsError.path).toBe('/test/file.txt');
      expect(fsError.permissions).toBe(false);
    });
  });

  describe('ValidationError', () => {
    it('should handle validation failures', () => {
      const validationError: ValidationError = {
        type: 'validation',
        code: 'VAL_001',
        message: 'Invalid email format',
        timestamp: new Date().toISOString(),
        field: 'email',
        value: 'invalid-email',
        expected: 'valid email format',
      };

      expect(validationError.type).toBe('validation');
      expect(validationError.field).toBe('email');
      expect(validationError.value).toBe('invalid-email');
      expect(validationError.expected).toBe('valid email format');
    });
  });

  describe('NetworkError', () => {
    it('should handle network operation errors', () => {
      const networkError: NetworkError = {
        type: 'network',
        code: 'NET_001',
        message: 'Request timeout',
        timestamp: new Date().toISOString(),
        url: 'https://api.example.com',
        method: 'GET',
        statusCode: 408,
        timeout: true,
      };

      expect(networkError.type).toBe('network');
      expect(networkError.url).toBe('https://api.example.com');
      expect(networkError.method).toBe('GET');
      expect(networkError.statusCode).toBe(408);
      expect(networkError.timeout).toBe(true);
    });
  });

  describe('ProjectError', () => {
    it('should handle project-specific errors', () => {
      const projectError: ProjectError = {
        type: 'project',
        code: 'PROJ_001',
        message: 'Project initialization failed',
        timestamp: new Date().toISOString(),
        operation: 'initialize',
        projectId: 'test-project-123',
        projectPath: '/test/project',
      };

      expect(projectError.type).toBe('project');
      expect(projectError.operation).toBe('initialize');
      expect(projectError.projectId).toBe('test-project-123');
      expect(projectError.projectPath).toBe('/test/project');
    });
  });

  describe('SemanticAnalysisError', () => {
    it('should handle semantic analysis errors', () => {
      const semanticError: SemanticAnalysisError = {
        type: 'semantic',
        code: 'SEM_001',
        message: 'Parsing failed at lexical stage',
        timestamp: new Date().toISOString(),
        filePath: '/test/code.ts',
        language: 'typescript',
        parseStage: 'lexical',
      };

      expect(semanticError.type).toBe('semantic');
      expect(semanticError.filePath).toBe('/test/code.ts');
      expect(semanticError.language).toBe('typescript');
      expect(semanticError.parseStage).toBe('lexical');
    });
  });

  describe('ClaudeCodeError', () => {
    it('should handle Claude Code integration errors', () => {
      const claudeError: ClaudeCodeError = {
        type: 'claude',
        code: 'CLAUDE_001',
        message: 'API request failed',
        timestamp: new Date().toISOString(),
        operation: 'process_request',
        prompt: 'Test prompt',
        apiError: true,
      };

      expect(claudeError.type).toBe('claude');
      expect(claudeError.operation).toBe('process_request');
      expect(claudeError.prompt).toBe('Test prompt');
      expect(claudeError.apiError).toBe(true);
    });
  });

  describe('Result Pattern', () => {
    describe('SuccessResult', () => {
      it('should represent successful operations', () => {
        const successResult: SuccessResult<string> = {
          success: true,
          data: 'operation completed',
        };

        expect(successResult.success).toBe(true);
        expect(successResult.data).toBe('operation completed');
      });

      it('should work with complex data types', () => {
        const complexData = { id: 1, name: 'test', items: [1, 2, 3] };
        const successResult: SuccessResult<typeof complexData> = {
          success: true,
          data: complexData,
        };

        expect(successResult.success).toBe(true);
        expect(successResult.data).toEqual(complexData);
      });
    });

    describe('ErrorResult', () => {
      it('should represent failed operations', () => {
        const error: ProjectError = {
          type: 'project',
          code: 'PROJ_001',
          message: 'Test error',
          timestamp: new Date().toISOString(),
          operation: 'test',
        };

        const errorResult: ErrorResult = {
          success: false,
          error,
        };

        expect(errorResult.success).toBe(false);
        expect(errorResult.error).toEqual(error);
      });
    });

    describe('Result Union Type', () => {
      it('should allow type-safe result handling', () => {
        const handleResult = (result: Result<string>): string => {
          if (result.success) {
            return result.data;
          }
          return `Error: ${(result as ErrorResult).error.message}`;
        };

        const successResult: Result<string> = {
          success: true,
          data: 'success data',
        };

        const errorResult: Result<string> = {
          success: false,
          error: {
            type: 'project',
            code: 'PROJ_001',
            message: 'Test error',
            timestamp: new Date().toISOString(),
            operation: 'test',
          } as ProjectError,
        };

        expect(handleResult(successResult)).toBe('success data');
        expect(handleResult(errorResult)).toBe('Error: Test error');
      });
    });
  });

  describe('CodeMindError Union Type', () => {
    it('should accept all error types', () => {
      const errors: CodeMindError[] = [
        {
          type: 'database',
          code: 'DB_001',
          message: 'DB error',
          timestamp: new Date().toISOString(),
          operation: 'connect',
        } as DatabaseError,
        {
          type: 'filesystem',
          code: 'FS_001',
          message: 'FS error',
          timestamp: new Date().toISOString(),
          operation: 'read',
          path: '/test',
        } as FileSystemError,
        {
          type: 'validation',
          code: 'VAL_001',
          message: 'Validation error',
          timestamp: new Date().toISOString(),
          field: 'test',
          value: 'invalid',
          expected: 'valid',
        } as ValidationError,
      ];

      expect(errors).toHaveLength(3);
      expect(errors[0].type).toBe('database');
      expect(errors[1].type).toBe('filesystem');
      expect(errors[2].type).toBe('validation');
    });
  });
});