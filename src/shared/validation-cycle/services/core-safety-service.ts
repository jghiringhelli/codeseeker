/**
 * Core Safety Service
 * SOLID Principles: Single Responsibility - Handle critical safety validations only
 */

import { Logger } from '../../logger';
import { CompilationVerifier } from '../../../cli/features/compilation/verifier';
import {
  ICoreSafetyService,
  ProjectContext,
  CycleResult,
  SafetyCheckResult,
  ValidationError,
  ValidationWarning
} from '../interfaces/index';

export class CoreSafetyService implements ICoreSafetyService {
  private logger = Logger.getInstance();
  private compilationVerifier: CompilationVerifier;

  constructor(compilationVerifier?: CompilationVerifier) {
    this.compilationVerifier = compilationVerifier || new CompilationVerifier();
  }

  async runCoreSafetyChecks(context: ProjectContext): Promise<CycleResult> {
    const startTime = Date.now();
    this.logger.info('🔄 Running Core Safety Cycle...');

    const results: CycleResult = {
      success: true,
      duration: 0,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      // Run critical safety checks in parallel for speed
      const [compilationCheck, structureCheck, safetyCheck] = await Promise.all([
        this.validateCompilation(context),
        this.validateProjectStructure(context),
        this.validateBasicSafety(context)
      ]);

      // Aggregate results
      this.aggregateCheckResult(results, compilationCheck);
      this.aggregateCheckResult(results, structureCheck);
      this.aggregateCheckResult(results, safetyCheck);

      // Check if any critical errors occurred
      const criticalErrors = results.errors.filter(error => error.blocking);
      if (criticalErrors.length > 0) {
        results.success = false;
        this.logger.warn(`❌ Core safety cycle failed with ${criticalErrors.length} blocking errors`);
      }

      results.duration = Date.now() - startTime;
      this.logger.info(`✅ Core safety cycle completed in ${results.duration}ms`);

      return results;
    } catch (error) {
      results.duration = Date.now() - startTime;
      results.success = false;
      results.errors.push({
        type: 'system_error',
        message: `Core safety cycle failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        blocking: true
      });

      this.logger.error('❌ Core safety cycle failed:', error);
      return results;
    }
  }

  async validateCompilation(context: ProjectContext): Promise<SafetyCheckResult> {
    try {
      this.logger.debug('🔧 Validating compilation...');

      // Skip compilation check for non-code modifications
      if (context.requestType !== 'code_modification') {
        return {
          passed: true,
          issues: [],
          warnings: [],
          checkType: 'compilation'
        };
      }

      const config = { projectPath: context.projectPath };
      const result = await this.compilationVerifier.verifyCompilation(config);

      const issues: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (!result.success && result.errors.length > 0) {
        issues.push({
          type: 'compilation_error',
          message: `Compilation failed: ${result.errors.join(', ')}`,
          blocking: true
        });
      }

      if (result.warnings.length > 0) {
        warnings.push({
          type: 'compilation_warning',
          message: `Compilation warnings: ${result.warnings.join(', ')}`,
          severity: 'warning' as const
        });
      }

      return {
        passed: result.success,
        issues,
        warnings,
        checkType: 'compilation'
      };
    } catch (error) {
      return {
        passed: false,
        issues: [{
          type: 'compilation_check_failed',
          message: `Compilation validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          blocking: false
        }],
        warnings: [],
        checkType: 'compilation'
      };
    }
  }

  async validateProjectStructure(context: ProjectContext): Promise<SafetyCheckResult> {
    try {
      this.logger.debug('📁 Validating project structure...');

      const issues: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Check if project path exists
      const fs = await import('fs/promises');
      try {
        await fs.access(context.projectPath);
      } catch {
        issues.push({
          type: 'project_not_found',
          message: `Project path does not exist: ${context.projectPath}`,
          blocking: true
        });
      }

      // Check for essential files based on project type
      await this.validateEssentialFiles(context, issues, warnings);

      // Check for suspicious patterns
      await this.checkSuspiciousPatterns(context, warnings);

      return {
        passed: issues.length === 0,
        issues,
        warnings,
        checkType: 'project_structure'
      };
    } catch (error) {
      return {
        passed: false,
        issues: [{
          type: 'structure_check_failed',
          message: `Project structure validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          blocking: false
        }],
        warnings: [],
        checkType: 'project_structure'
      };
    }
  }

  async validateBasicSafety(context: ProjectContext): Promise<SafetyCheckResult> {
    try {
      this.logger.debug('🛡️ Performing basic safety checks...');

      const issues: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Check for potentially dangerous operations
      if (context.changedFiles) {
        for (const file of context.changedFiles) {
          await this.checkFileForDangerousOperations(file, issues, warnings);
        }
      }

      // Check for security concerns
      await this.performBasicSecurityCheck(context, warnings);

      return {
        passed: issues.filter(i => i.blocking).length === 0,
        issues,
        warnings,
        checkType: 'basic_safety'
      };
    } catch (error) {
      return {
        passed: false,
        issues: [{
          type: 'safety_check_failed',
          message: `Basic safety validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          blocking: false
        }],
        warnings: [],
        checkType: 'basic_safety'
      };
    }
  }

  private aggregateCheckResult(results: CycleResult, checkResult: SafetyCheckResult): void {
    results.errors.push(...checkResult.issues);
    results.warnings.push(...checkResult.warnings);
  }

  private async validateEssentialFiles(
    context: ProjectContext,
    issues: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Check for package.json in Node.js projects
    if (context.language === 'typescript' || context.language === 'javascript') {
      const packageJsonPath = path.join(context.projectPath, 'package.json');
      try {
        await fs.access(packageJsonPath);
      } catch {
        warnings.push({
          type: 'missing_package_json',
          message: 'package.json not found - this may not be a Node.js project',
          severity: 'warning'
        });
      }
    }

    // Check for tsconfig.json in TypeScript projects
    if (context.language === 'typescript') {
      const tsconfigPath = path.join(context.projectPath, 'tsconfig.json');
      try {
        await fs.access(tsconfigPath);
      } catch {
        warnings.push({
          type: 'missing_tsconfig',
          message: 'tsconfig.json not found - TypeScript compilation may fail',
          severity: 'warning'
        });
      }
    }
  }

  private async checkSuspiciousPatterns(
    context: ProjectContext,
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Check for suspicious directory patterns
    const suspiciousPatterns = ['node_modules', '.git', 'dist', 'build'];

    if (context.changedFiles) {
      for (const file of context.changedFiles) {
        for (const pattern of suspiciousPatterns) {
          if (file.includes(pattern)) {
            warnings.push({
              type: 'suspicious_file_location',
              message: `File in suspicious location: ${file}`,
              file,
              severity: 'warning'
            });
          }
        }
      }
    }
  }

  private async checkFileForDangerousOperations(
    filePath: string,
    issues: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for dangerous operations
      const dangerousPatterns = [
        { pattern: /rm\s+-rf\s+\//, message: 'Dangerous file deletion command found' },
        { pattern: /eval\s*\(/, message: 'Use of eval() function detected' },
        { pattern: /exec\s*\(/, message: 'Use of exec() function detected' },
        { pattern: /process\.exit\s*\(/, message: 'Process exit call found' }
      ];

      for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(content)) {
          warnings.push({
            type: 'dangerous_operation',
            message: `${message} in ${filePath}`,
            file: filePath,
            severity: 'warning'
          });
        }
      }

      // Check for hardcoded secrets patterns
      const secretPatterns = [
        { pattern: /password\s*=\s*["'][^"']+["']/, message: 'Potential hardcoded password' },
        { pattern: /api[_-]?key\s*=\s*["'][^"']+["']/, message: 'Potential hardcoded API key' },
        { pattern: /secret\s*=\s*["'][^"']+["']/, message: 'Potential hardcoded secret' }
      ];

      for (const { pattern, message } of secretPatterns) {
        if (pattern.test(content)) {
          warnings.push({
            type: 'potential_secret',
            message: `${message} in ${filePath}`,
            file: filePath,
            severity: 'error'
          });
        }
      }
    } catch (error) {
      // File might not exist or be readable - not critical for safety
      this.logger.debug(`Could not read file for safety check: ${filePath}`);
    }
  }

  private async performBasicSecurityCheck(
    context: ProjectContext,
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Basic security checks
    if (context.userIntent) {
      const suspiciousKeywords = ['delete', 'remove', 'drop', 'truncate', 'format'];
      const userIntentLower = context.userIntent.toLowerCase();

      for (const keyword of suspiciousKeywords) {
        if (userIntentLower.includes(keyword)) {
          warnings.push({
            type: 'potentially_destructive_intent',
            message: `User intent contains potentially destructive keyword: ${keyword}`,
            severity: 'warning'
          });
        }
      }
    }

    // Check for elevated permissions requirements
    if (context.projectPath.includes('/usr/') || context.projectPath.includes('/etc/')) {
      warnings.push({
        type: 'elevated_permissions',
        message: 'Project is in a system directory that may require elevated permissions',
        severity: 'warning'
      });
    }
  }
}