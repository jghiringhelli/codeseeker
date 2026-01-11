/**
 * Language Support Service Tests
 *
 * Tests the dynamic parser installation and project language detection.
 *
 * Run with: npm test -- tests/cli/services/language-support-service.test.ts
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { LanguageSupportService } from '../../../src/cli/services/project/language-support-service';

// Test fixtures
const TEST_DIR = path.join(os.tmpdir(), `codeseeker-lang-test-${Date.now()}`);

describe('LanguageSupportService', () => {
  let service: LanguageSupportService;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    service = new LanguageSupportService();
  });

  afterAll(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getSupportedLanguages', () => {
    it('should return a list of supported languages', () => {
      const languages = service.getSupportedLanguages();

      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);

      // Verify structure
      const first = languages[0];
      expect(first).toHaveProperty('language');
      expect(first).toHaveProperty('extensions');
      expect(first).toHaveProperty('npmPackage');
      expect(first).toHaveProperty('quality');
    });

    it('should include TypeScript and JavaScript as always installed', () => {
      const languages = service.getSupportedLanguages();

      const ts = languages.find(l => l.language === 'TypeScript');
      const js = languages.find(l => l.language === 'JavaScript');

      expect(ts).toBeDefined();
      expect(ts?.installed).toBe(true);
      expect(ts?.quality).toBe('excellent');

      expect(js).toBeDefined();
      expect(js?.installed).toBe(true);
    });

    it('should include common languages', () => {
      const languages = service.getSupportedLanguages();
      const languageNames = languages.map(l => l.language);

      expect(languageNames).toContain('Python');
      expect(languageNames).toContain('Java');
      expect(languageNames).toContain('C#');
      expect(languageNames).toContain('Go');
      expect(languageNames).toContain('Rust');
    });
  });

  describe('getParserInfo', () => {
    it('should return parser info for known language', () => {
      const info = service.getParserInfo('Python');

      expect(info).toBeDefined();
      expect(info?.language).toBe('Python');
      expect(info?.extensions).toContain('py');
      expect(info?.npmPackage).toBe('tree-sitter-python');
    });

    it('should be case-insensitive', () => {
      const lower = service.getParserInfo('python');
      const upper = service.getParserInfo('PYTHON');
      const mixed = service.getParserInfo('PyThOn');

      expect(lower).toBeDefined();
      expect(upper).toBeDefined();
      expect(mixed).toBeDefined();
      expect(lower?.language).toBe(upper?.language);
    });

    it('should return undefined for unknown language', () => {
      const info = service.getParserInfo('Brainfuck');
      expect(info).toBeUndefined();
    });
  });

  describe('checkInstalledParsers', () => {
    it('should return parser status for all languages', async () => {
      const parsers = await service.checkInstalledParsers();

      expect(Array.isArray(parsers)).toBe(true);
      expect(parsers.length).toBeGreaterThan(0);

      // TypeScript/JavaScript should always be installed (bundled)
      const ts = parsers.find(p => p.language === 'TypeScript');
      expect(ts?.installed).toBe(true);
    });

    it('should correctly identify Babel as installed', async () => {
      const parsers = await service.checkInstalledParsers();

      const babelParsers = parsers.filter(p => p.npmPackage === '@babel/parser');
      expect(babelParsers.length).toBe(2); // TypeScript and JavaScript

      babelParsers.forEach(p => {
        expect(p.installed).toBe(true);
      });
    });
  });

  describe('analyzeProjectLanguages', () => {
    beforeAll(async () => {
      // Create test project with multiple languages
      const projectPath = path.join(TEST_DIR, 'multi-lang-project');
      await fs.mkdir(projectPath, { recursive: true });
      await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
      await fs.mkdir(path.join(projectPath, 'scripts'), { recursive: true });

      // Create TypeScript files
      await fs.writeFile(
        path.join(projectPath, 'src', 'index.ts'),
        'export const hello = "world";'
      );
      await fs.writeFile(
        path.join(projectPath, 'src', 'app.tsx'),
        'export const App = () => <div>Hello</div>;'
      );

      // Create Python files
      await fs.writeFile(
        path.join(projectPath, 'scripts', 'build.py'),
        'print("Building...")'
      );

      // Create Go files
      await fs.writeFile(
        path.join(projectPath, 'main.go'),
        'package main\nfunc main() {}'
      );
    });

    it('should detect languages in a project', async () => {
      const projectPath = path.join(TEST_DIR, 'multi-lang-project');
      const analysis = await service.analyzeProjectLanguages(projectPath);

      expect(analysis).toBeDefined();
      expect(analysis.detectedLanguages).toBeDefined();
      expect(Array.isArray(analysis.detectedLanguages)).toBe(true);
    });

    it('should calculate language percentages', async () => {
      const projectPath = path.join(TEST_DIR, 'multi-lang-project');
      const analysis = await service.analyzeProjectLanguages(projectPath);

      // Each detected language should have fileCount and percentage
      for (const lang of analysis.detectedLanguages) {
        expect(lang).toHaveProperty('language');
        expect(lang).toHaveProperty('fileCount');
        expect(lang).toHaveProperty('percentage');
        expect(lang.percentage).toBeGreaterThanOrEqual(0);
        expect(lang.percentage).toBeLessThanOrEqual(100);
      }
    });

    it('should identify installed parsers', async () => {
      const projectPath = path.join(TEST_DIR, 'multi-lang-project');
      const analysis = await service.analyzeProjectLanguages(projectPath);

      expect(analysis.installedParsers).toBeDefined();
      expect(Array.isArray(analysis.installedParsers)).toBe(true);

      // TypeScript should be installed
      expect(analysis.installedParsers).toContain('TypeScript');
    });

    it('should suggest missing parsers for detected languages', async () => {
      const projectPath = path.join(TEST_DIR, 'multi-lang-project');
      const analysis = await service.analyzeProjectLanguages(projectPath);

      expect(analysis.missingParsers).toBeDefined();
      expect(Array.isArray(analysis.missingParsers)).toBe(true);

      // Missing parsers should have npm package info
      for (const parser of analysis.missingParsers) {
        expect(parser).toHaveProperty('language');
        expect(parser).toHaveProperty('npmPackage');
        expect(parser).toHaveProperty('quality');
      }
    });

    it('should generate recommendations', async () => {
      const projectPath = path.join(TEST_DIR, 'multi-lang-project');
      const analysis = await service.analyzeProjectLanguages(projectPath);

      expect(analysis.recommendations).toBeDefined();
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });
  });

  describe('installLanguageParsers', () => {
    it('should handle already-installed languages', async () => {
      const result = await service.installLanguageParsers(['TypeScript', 'JavaScript']);

      expect(result.success).toBe(true);
      expect(result.installed.length).toBe(2);
      expect(result.installed.some(i => i.includes('bundled'))).toBe(true);
    });

    it('should return error for unknown language', async () => {
      const result = await service.installLanguageParsers(['UnknownLang']);

      expect(result.failed.length).toBe(1);
      expect(result.failed[0].package).toBe('UnknownLang');
      expect(result.failed[0].error).toBe('Unknown language');
    });

    it('should generate appropriate message', async () => {
      const result = await service.installLanguageParsers(['TypeScript']);

      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('Extension mapping', () => {
    it('should map common extensions to languages', () => {
      const languages = service.getSupportedLanguages();

      // Build extension map
      const extMap = new Map<string, string>();
      for (const lang of languages) {
        for (const ext of lang.extensions) {
          extMap.set(ext, lang.language);
        }
      }

      // Test common mappings
      expect(extMap.get('ts')).toBe('TypeScript');
      expect(extMap.get('tsx')).toBe('TypeScript');
      expect(extMap.get('js')).toBe('JavaScript');
      expect(extMap.get('jsx')).toBe('JavaScript');
      expect(extMap.get('py')).toBe('Python');
      expect(extMap.get('java')).toBe('Java');
      expect(extMap.get('cs')).toBe('C#');
      expect(extMap.get('go')).toBe('Go');
      expect(extMap.get('rs')).toBe('Rust');
      expect(extMap.get('rb')).toBe('Ruby');
      expect(extMap.get('php')).toBe('PHP');
    });
  });
});
