/**
 * Coding Patterns Analyzer - SOLID Principles Implementation
 * Single Responsibility: Detect and rank coding patterns from indexed code
 * Dependency Inversion: Depends on storage abstractions, not concrete implementations
 */

import { IVectorStore } from '../../../storage/interfaces';

export interface CodingPattern {
  pattern: string;
  category: 'validation' | 'error-handling' | 'logging' | 'testing' | 'react-patterns' | 'state-management' | 'api-patterns';
  usage_count: number;
  files: string[]; // file:line format
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  code_example?: string;
  import_statement?: string;
  alternatives?: Array<{
    pattern: string;
    usage_count: number;
    recommendation: string;
  }>;
}

interface PatternInfo {
  count: number;
  files: Set<string>;
  examples: string[];
}

export class CodingPatternsAnalyzer {
  constructor(private vectorStore: IVectorStore) {}

  /**
   * Analyze all coding patterns in the project
   */
  async analyzePatterns(projectId: string): Promise<Map<string, CodingPattern[]>> {
    const patterns = new Map<string, CodingPattern[]>();

    try {
      // Analyze each category
      patterns.set('validation', await this.detectValidationPatterns(projectId));
      patterns.set('error-handling', await this.detectErrorHandlingPatterns(projectId));
      patterns.set('logging', await this.detectLoggingPatterns(projectId));
      patterns.set('testing', await this.detectTestingPatterns(projectId));
      patterns.set('react-patterns', await this.detectReactPatterns(projectId));
      patterns.set('state-management', await this.detectStateManagementPatterns(projectId));
      patterns.set('api-patterns', await this.detectApiPatterns(projectId));
    } catch (error) {
      console.warn('Pattern analysis warning:', error instanceof Error ? error.message : 'Unknown error');
      // Return partial results if some categories fail
    }

    return patterns;
  }

  /**
   * Detect validation patterns (email, phone, URL, Zod schemas, etc.)
   */
  private async detectValidationPatterns(projectId: string): Promise<CodingPattern[]> {
    // Search for both traditional validation AND modern schema validation (Zod, Yup)
    const results = await this.vectorStore.searchByText(
      'validation validate email phone url number input check zod schema zodResolver useForm',
      projectId,
      100 // Get many results to analyze patterns thoroughly
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // === Zod Patterns (modern TypeScript validation) ===

      // Pattern: z.object() schema definition
      if (content.match(/z\.object\s*\(\s*\{/)) {
        this.trackPattern(patternCounts, 'Zod z.object() schema', filePath, content, "import { z } from 'zod';");
      }

      // Pattern: z.string() with validation
      if (content.match(/z\.string\(\)\.(min|max|email|url|regex|nonempty)/)) {
        this.trackPattern(patternCounts, 'Zod z.string() validators', filePath, content, "import { z } from 'zod';");
      }

      // Pattern: z.number() with validation
      if (content.match(/z\.number\(\)\.(min|max|positive|negative|int)/)) {
        this.trackPattern(patternCounts, 'Zod z.number() validators', filePath, content, "import { z } from 'zod';");
      }

      // Pattern: zodResolver with react-hook-form
      if (content.match(/zodResolver\s*\(/)) {
        this.trackPattern(patternCounts, 'zodResolver (react-hook-form)', filePath, content, "import { zodResolver } from '@hookform/resolvers/zod';");
      }

      // Pattern: Zod infer for TypeScript types
      if (content.match(/z\.infer\s*<\s*typeof/)) {
        this.trackPattern(patternCounts, 'Zod z.infer<typeof schema>', filePath, content, "import { z } from 'zod';");
      }

      // === Yup Patterns (alternative to Zod) ===

      // Pattern: yup.object() schema
      if (content.match(/yup\.object\s*\(\s*\{/) || content.match(/Yup\.object\s*\(\s*\{/)) {
        this.trackPattern(patternCounts, 'Yup object schema', filePath, content, "import * as yup from 'yup';");
      }

      // Pattern: yupResolver with react-hook-form
      if (content.match(/yupResolver\s*\(/)) {
        this.trackPattern(patternCounts, 'yupResolver (react-hook-form)', filePath, content, "import { yupResolver } from '@hookform/resolvers/yup';");
      }

      // === Traditional Validator.js Patterns ===

      // Pattern: validator.isEmail()
      if (content.match(/validator\.isEmail\s*\(/)) {
        this.trackPattern(patternCounts, 'validator.isEmail()', filePath, content, "const validator = require('validator');");
      }

      // Pattern: validator.isMobilePhone()
      if (content.match(/validator\.isMobilePhone\s*\(/)) {
        this.trackPattern(patternCounts, 'validator.isMobilePhone()', filePath, content, "const validator = require('validator');");
      }

      // Pattern: validator.isURL()
      if (content.match(/validator\.isURL\s*\(/)) {
        this.trackPattern(patternCounts, 'validator.isURL()', filePath, content, "const validator = require('validator');");
      }

      // === Joi Patterns ===

      // Pattern: Joi.object() schema
      if (content.match(/Joi\.object\s*\(\s*\{/)) {
        this.trackPattern(patternCounts, 'Joi.object() schema', filePath, content, "const Joi = require('joi');");
      }

      // Pattern: Joi.string().email()
      if (content.match(/Joi\.string\(\)\.email\(\)/)) {
        this.trackPattern(patternCounts, 'Joi.string().email()', filePath, content, "const Joi = require('joi');");
      }

      // === Regex/Manual Patterns ===

      // Pattern: Email regex
      if (content.match(/\/\^[^\s@]+@[^\s@]+\.[^\s@]+\$\//)) {
        this.trackPattern(patternCounts, 'email-regex: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/', filePath, content);
      }

      // Pattern: Simple includes('@')
      if (content.match(/\.includes\s*\(\s*['"]@['"]\s*\)/)) {
        this.trackPattern(patternCounts, 'email.includes(\'@\')', filePath, content);
      }
    }

    return this.rankPatterns(patternCounts, 'validation');
  }

  /**
   * Detect error handling patterns
   */
  private async detectErrorHandlingPatterns(projectId: string): Promise<CodingPattern[]> {
    const results = await this.vectorStore.searchByText(
      'error exception throw catch try finally handling',
      projectId,
      100
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // Pattern: res.status().json({ error })
      if (content.match(/res\.status\s*\(\s*\d+\s*\)\.json\s*\(\s*\{\s*error/)) {
        this.trackPattern(patternCounts, 'res.status(code).json({ error })', filePath, content);
      }

      // Pattern: try-catch with logging
      if (content.match(/try\s*\{[\s\S]*?\}\s*catch[\s\S]*?console\.(log|error)/)) {
        this.trackPattern(patternCounts, 'try-catch with console logging', filePath, content);
      }

      // Pattern: Custom error classes
      if (content.match(/class\s+\w+Error\s+extends\s+Error/)) {
        this.trackPattern(patternCounts, 'Custom Error class extends Error', filePath, content);
      }
    }

    return this.rankPatterns(patternCounts, 'error-handling');
  }

  /**
   * Detect logging patterns
   */
  private async detectLoggingPatterns(projectId: string): Promise<CodingPattern[]> {
    const results = await this.vectorStore.searchByText(
      'log logging logger console debug info warn error',
      projectId,
      100
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // Pattern: console.log/error/warn
      if (content.match(/console\.(log|error|warn|info|debug)/)) {
        this.trackPattern(patternCounts, 'console.log/error/warn', filePath, content);
      }

      // Pattern: Winston logger
      if (content.match(/logger\.(info|error|warn|debug)/)) {
        this.trackPattern(patternCounts, 'logger.info/error/warn (Winston/Bunyan)', filePath, content);
      }
    }

    return this.rankPatterns(patternCounts, 'logging');
  }

  /**
   * Detect testing patterns
   */
  private async detectTestingPatterns(projectId: string): Promise<CodingPattern[]> {
    const results = await this.vectorStore.searchByText(
      'test spec describe it expect jest mocha beforeEach',
      projectId,
      100
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // Pattern: Jest with beforeEach
      if (content.match(/describe\s*\([\s\S]*?beforeEach/)) {
        this.trackPattern(patternCounts, 'Jest/Mocha with beforeEach setup', filePath, content);
      }

      // Pattern: expect() assertions
      if (content.match(/expect\s*\([^)]*\)\.(toBe|toEqual|toContain|toMatch)/)) {
        this.trackPattern(patternCounts, 'expect().toBe/toEqual assertions', filePath, content);
      }
    }

    return this.rankPatterns(patternCounts, 'testing');
  }

  /**
   * Detect React patterns (hooks, components, optimization)
   */
  private async detectReactPatterns(projectId: string): Promise<CodingPattern[]> {
    const results = await this.vectorStore.searchByText(
      'React useState useEffect useCallback useMemo useRef forwardRef memo component hook',
      projectId,
      100
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // Pattern: useState hook
      if (content.match(/const\s+\[\s*\w+\s*,\s*set\w+\s*\]\s*=\s*useState/)) {
        this.trackPattern(patternCounts, 'useState hook', filePath, content, "import { useState } from 'react';");
      }

      // Pattern: useEffect hook
      if (content.match(/useEffect\s*\(\s*\(\s*\)\s*=>/)) {
        this.trackPattern(patternCounts, 'useEffect hook', filePath, content, "import { useEffect } from 'react';");
      }

      // Pattern: useCallback for memoization
      if (content.match(/useCallback\s*\(/)) {
        this.trackPattern(patternCounts, 'useCallback memoization', filePath, content, "import { useCallback } from 'react';");
      }

      // Pattern: useMemo for computed values
      if (content.match(/useMemo\s*\(/)) {
        this.trackPattern(patternCounts, 'useMemo computed values', filePath, content, "import { useMemo } from 'react';");
      }

      // Pattern: useRef for DOM refs
      if (content.match(/useRef\s*[<(]/)) {
        this.trackPattern(patternCounts, 'useRef hook', filePath, content, "import { useRef } from 'react';");
      }

      // Pattern: Custom hooks (use* functions)
      if (content.match(/(?:export\s+)?(?:const|function)\s+use[A-Z]\w*\s*[=(]/)) {
        this.trackPattern(patternCounts, 'Custom hook (use* pattern)', filePath, content);
      }

      // Pattern: React.memo for component memoization
      if (content.match(/React\.memo\s*\(/) || content.match(/memo\s*\(\s*(?:function|\()/)) {
        this.trackPattern(patternCounts, 'React.memo component', filePath, content, "import { memo } from 'react';");
      }

      // Pattern: forwardRef
      if (content.match(/forwardRef\s*[<(]/)) {
        this.trackPattern(patternCounts, 'forwardRef component', filePath, content, "import { forwardRef } from 'react';");
      }

      // Pattern: useContext
      if (content.match(/useContext\s*\(/)) {
        this.trackPattern(patternCounts, 'useContext hook', filePath, content, "import { useContext } from 'react';");
      }

      // Pattern: useReducer
      if (content.match(/useReducer\s*\(/)) {
        this.trackPattern(patternCounts, 'useReducer hook', filePath, content, "import { useReducer } from 'react';");
      }
    }

    return this.rankPatterns(patternCounts, 'react-patterns');
  }

  /**
   * Detect state management patterns (Redux, Zustand, Context, etc.)
   */
  private async detectStateManagementPatterns(projectId: string): Promise<CodingPattern[]> {
    const results = await this.vectorStore.searchByText(
      'redux store dispatch action reducer slice zustand create context provider useSelector',
      projectId,
      100
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // Pattern: Redux Toolkit createSlice
      if (content.match(/createSlice\s*\(\s*\{/)) {
        this.trackPattern(patternCounts, 'Redux Toolkit createSlice', filePath, content, "import { createSlice } from '@reduxjs/toolkit';");
      }

      // Pattern: useSelector hook
      if (content.match(/useSelector\s*\(/)) {
        this.trackPattern(patternCounts, 'useSelector (Redux)', filePath, content, "import { useSelector } from 'react-redux';");
      }

      // Pattern: useDispatch hook
      if (content.match(/useDispatch\s*\(\s*\)/)) {
        this.trackPattern(patternCounts, 'useDispatch (Redux)', filePath, content, "import { useDispatch } from 'react-redux';");
      }

      // Pattern: Zustand create store
      if (content.match(/create\s*\(\s*\(\s*set\s*(?:,\s*get)?\s*\)\s*=>/)) {
        this.trackPattern(patternCounts, 'Zustand store', filePath, content, "import { create } from 'zustand';");
      }

      // Pattern: React Context Provider
      if (content.match(/createContext\s*[<(]/)) {
        this.trackPattern(patternCounts, 'React Context', filePath, content, "import { createContext } from 'react';");
      }

      // Pattern: Context Provider component
      if (content.match(/\.Provider\s+value\s*=/)) {
        this.trackPattern(patternCounts, 'Context Provider pattern', filePath, content);
      }

      // Pattern: Jotai atoms
      if (content.match(/atom\s*\(/)) {
        this.trackPattern(patternCounts, 'Jotai atom', filePath, content, "import { atom } from 'jotai';");
      }

      // Pattern: Recoil atoms
      if (content.match(/atom\s*\(\s*\{\s*key:/)) {
        this.trackPattern(patternCounts, 'Recoil atom', filePath, content, "import { atom } from 'recoil';");
      }

      // Pattern: TanStack Query useQuery
      if (content.match(/useQuery\s*\(\s*\{/)) {
        this.trackPattern(patternCounts, 'TanStack Query useQuery', filePath, content, "import { useQuery } from '@tanstack/react-query';");
      }

      // Pattern: TanStack Query useMutation
      if (content.match(/useMutation\s*\(\s*\{/)) {
        this.trackPattern(patternCounts, 'TanStack Query useMutation', filePath, content, "import { useMutation } from '@tanstack/react-query';");
      }
    }

    return this.rankPatterns(patternCounts, 'state-management');
  }

  /**
   * Detect API and data fetching patterns
   */
  private async detectApiPatterns(projectId: string): Promise<CodingPattern[]> {
    const results = await this.vectorStore.searchByText(
      'fetch axios api endpoint route handler middleware express next server action',
      projectId,
      100
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // Pattern: fetch API
      if (content.match(/fetch\s*\(\s*['"`]/)) {
        this.trackPattern(patternCounts, 'Fetch API', filePath, content);
      }

      // Pattern: axios
      if (content.match(/axios\.(get|post|put|patch|delete)\s*\(/)) {
        this.trackPattern(patternCounts, 'Axios HTTP client', filePath, content, "import axios from 'axios';");
      }

      // Pattern: Express router
      if (content.match(/router\.(get|post|put|patch|delete)\s*\(/)) {
        this.trackPattern(patternCounts, 'Express Router', filePath, content, "import { Router } from 'express';");
      }

      // Pattern: Express app routes
      if (content.match(/app\.(get|post|put|patch|delete)\s*\(\s*['"`]/)) {
        this.trackPattern(patternCounts, 'Express app routes', filePath, content);
      }

      // Pattern: Next.js API routes
      if (content.match(/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/)) {
        this.trackPattern(patternCounts, 'Next.js API route handler', filePath, content);
      }

      // Pattern: Next.js server actions
      if (content.match(/['"]use server['"]/)) {
        this.trackPattern(patternCounts, 'Next.js Server Action', filePath, content);
      }

      // Pattern: Express middleware
      if (content.match(/\(\s*req\s*,\s*res\s*,\s*next\s*\)\s*=>/)) {
        this.trackPattern(patternCounts, 'Express middleware pattern', filePath, content);
      }

      // Pattern: tRPC router
      if (content.match(/\.query\s*\(\s*\{/) || content.match(/\.mutation\s*\(\s*\{/)) {
        this.trackPattern(patternCounts, 'tRPC procedure', filePath, content);
      }

      // Pattern: GraphQL resolver
      if (content.match(/Query\s*:\s*\{/) || content.match(/Mutation\s*:\s*\{/)) {
        this.trackPattern(patternCounts, 'GraphQL resolver', filePath, content);
      }
    }

    return this.rankPatterns(patternCounts, 'api-patterns');
  }

  /**
   * Track pattern occurrence
   */
  private trackPattern(
    patternCounts: Map<string, PatternInfo>,
    pattern: string,
    filePath: string,
    content: string,
    importStatement?: string
  ): void {
    if (!patternCounts.has(pattern)) {
      patternCounts.set(pattern, { count: 0, files: new Set(), examples: [] });
    }
    const info = patternCounts.get(pattern);
    info.count++;
    info.files.add(filePath);

    // Store first 3 examples
    if (info.examples.length < 3) {
      // Extract relevant lines (up to 3 lines of context)
      const lines = content.split('\n').slice(0, 3);
      const example = lines.join('\n').trim();
      if (example && !info.examples.includes(example)) {
        info.examples.push(example);
      }
    }
  }

  /**
   * Rank patterns by frequency and generate final pattern objects
   */
  private rankPatterns(
    patternCounts: Map<string, PatternInfo>,
    category: CodingPattern['category']
  ): CodingPattern[] {
    const ranked = [...patternCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([pattern, info]): CodingPattern => ({
        pattern,
        category,
        usage_count: info.count,
        files: Array.from(info.files),
        confidence: this.calculateConfidence(info.count),
        rationale: this.generateRationale(pattern, info.count, category),
        code_example: info.examples[0],
        import_statement: this.detectImportStatement(pattern),
        alternatives: []  // Will be populated below for top patterns
      }));

    // Add alternatives to top pattern
    if (ranked.length > 1) {
      ranked[0].alternatives = ranked.slice(1, 4).map(p => ({
        pattern: p.pattern,
        usage_count: p.usage_count,
        recommendation: p.usage_count < ranked[0].usage_count
          ? `Consider using "${ranked[0].pattern}" instead (${ranked[0].usage_count} vs ${p.usage_count} occurrences)`
          : 'Alternative pattern with similar usage'
      }));
    }

    return ranked;
  }

  /**
   * Calculate confidence based on usage count
   */
  private calculateConfidence(count: number): 'high' | 'medium' | 'low' {
    if (count >= 3) return 'high';
    if (count >= 2) return 'medium';
    return 'low';
  }

  /**
   * Generate rationale for pattern
   */
  private generateRationale(pattern: string, count: number, category: string): string {
    // Zod patterns
    if (pattern.includes('Zod z.object')) {
      return `Project uses Zod schemas in ${count} files. Type-safe validation with TypeScript inference.`;
    }
    if (pattern.includes('zodResolver')) {
      return `Project uses zodResolver for react-hook-form in ${count} files. Integrates Zod validation with form state management.`;
    }
    if (pattern.includes('Zod z.string') || pattern.includes('Zod z.number')) {
      return `Project uses Zod type validators in ${count} files. Chainable validation with automatic TypeScript types.`;
    }
    if (pattern.includes('Zod z.infer')) {
      return `Project derives TypeScript types from Zod schemas in ${count} files. Single source of truth for types and validation.`;
    }

    // Yup patterns
    if (pattern.includes('Yup') || pattern.includes('yup')) {
      return `Project uses Yup schema validation in ${count} files. Declarative validation similar to Zod.`;
    }
    if (pattern.includes('yupResolver')) {
      return `Project uses yupResolver for react-hook-form in ${count} files. Integrates Yup validation with form state.`;
    }

    // Validator.js patterns
    if (pattern.includes('validator.')) {
      return `Project standard - uses validator library in ${count} files. Battle-tested validation with comprehensive edge case handling.`;
    }

    // Joi patterns
    if (pattern.includes('Joi.')) {
      return `Project uses Joi schema validation in ${count} files. Declarative validation with detailed error messages.`;
    }

    // Manual patterns
    if (pattern.includes('regex')) {
      return `Custom regex validation found in ${count} files. Consider using a validation library for better maintainability.`;
    }
    if (pattern.includes('includes(')) {
      return `Simple string check found in ${count} files. Consider more robust validation for production use.`;
    }

    // Error handling
    if (category === 'error-handling' && pattern.includes('res.status')) {
      return `Standard Express.js error response pattern used in ${count} files.`;
    }

    // Logging
    if (category === 'logging' && pattern.includes('logger.')) {
      return `Structured logging with dedicated logger found in ${count} files. Preferred over console.log.`;
    }

    // Testing
    if (category === 'testing' && pattern.includes('beforeEach')) {
      return `Test setup pattern found in ${count} files. Ensures clean state for each test.`;
    }

    // React patterns
    if (pattern.includes('useState')) {
      return `useState hook used in ${count} files for local component state management.`;
    }
    if (pattern.includes('useEffect')) {
      return `useEffect hook used in ${count} files for side effects and lifecycle management.`;
    }
    if (pattern.includes('useCallback')) {
      return `useCallback used in ${count} files for memoizing callbacks to prevent unnecessary re-renders.`;
    }
    if (pattern.includes('useMemo')) {
      return `useMemo used in ${count} files for memoizing expensive computations.`;
    }
    if (pattern.includes('useRef')) {
      return `useRef used in ${count} files for DOM refs or mutable values that don't trigger re-renders.`;
    }
    if (pattern.includes('Custom hook')) {
      return `Custom hooks (use* pattern) found in ${count} files. Reusable stateful logic across components.`;
    }
    if (pattern.includes('React.memo')) {
      return `React.memo used in ${count} files for component memoization to prevent unnecessary re-renders.`;
    }
    if (pattern.includes('forwardRef')) {
      return `forwardRef used in ${count} files for forwarding refs to child DOM elements.`;
    }
    if (pattern.includes('useContext')) {
      return `useContext used in ${count} files for consuming React Context values.`;
    }
    if (pattern.includes('useReducer')) {
      return `useReducer used in ${count} files for complex state logic with actions.`;
    }

    // State management patterns
    if (pattern.includes('createSlice')) {
      return `Redux Toolkit createSlice used in ${count} files. Modern Redux with immer for immutable updates.`;
    }
    if (pattern.includes('useSelector')) {
      return `useSelector used in ${count} files to access Redux store state.`;
    }
    if (pattern.includes('useDispatch')) {
      return `useDispatch used in ${count} files to dispatch Redux actions.`;
    }
    if (pattern.includes('Zustand')) {
      return `Zustand store used in ${count} files. Lightweight state management without boilerplate.`;
    }
    if (pattern.includes('React Context')) {
      return `React Context used in ${count} files for prop-drilling-free state sharing.`;
    }
    if (pattern.includes('TanStack Query')) {
      return `TanStack Query (React Query) used in ${count} files for server state management with caching.`;
    }
    if (pattern.includes('Jotai') || pattern.includes('Recoil')) {
      return `Atomic state management used in ${count} files. Fine-grained reactivity for complex state.`;
    }

    // API patterns
    if (pattern.includes('Fetch API')) {
      return `Native Fetch API used in ${count} files for HTTP requests.`;
    }
    if (pattern.includes('Axios')) {
      return `Axios HTTP client used in ${count} files. Features include interceptors and automatic transforms.`;
    }
    if (pattern.includes('Express Router') || pattern.includes('Express app')) {
      return `Express.js routing used in ${count} files for handling HTTP endpoints.`;
    }
    if (pattern.includes('Next.js API')) {
      return `Next.js API routes used in ${count} files for serverless API endpoints.`;
    }
    if (pattern.includes('Server Action')) {
      return `Next.js Server Actions used in ${count} files for server-side mutations.`;
    }
    if (pattern.includes('middleware')) {
      return `Express middleware pattern used in ${count} files for request/response processing.`;
    }
    if (pattern.includes('tRPC')) {
      return `tRPC used in ${count} files for end-to-end typesafe APIs.`;
    }
    if (pattern.includes('GraphQL')) {
      return `GraphQL resolvers used in ${count} files for flexible data querying.`;
    }

    return `Pattern found in ${count} files across the project.`;
  }

  /**
   * Detect import statement for pattern
   */
  private detectImportStatement(pattern: string): string | undefined {
    // Zod
    if (pattern.includes('Zod z.')) {
      return "import { z } from 'zod';";
    }
    if (pattern.includes('zodResolver')) {
      return "import { zodResolver } from '@hookform/resolvers/zod';";
    }

    // Yup
    if (pattern.includes('Yup') || pattern.includes('yup.')) {
      return "import * as yup from 'yup';";
    }
    if (pattern.includes('yupResolver')) {
      return "import { yupResolver } from '@hookform/resolvers/yup';";
    }

    // Validator.js
    if (pattern.includes('validator.')) {
      return "const validator = require('validator');";
    }

    // Joi
    if (pattern.includes('Joi.')) {
      return "const Joi = require('joi');";
    }

    // React hooks (imports already tracked in trackPattern, but add fallbacks)
    if (pattern.includes('useState') || pattern.includes('useEffect') ||
        pattern.includes('useCallback') || pattern.includes('useMemo') ||
        pattern.includes('useRef') || pattern.includes('useContext') ||
        pattern.includes('useReducer')) {
      return `import { ${pattern.split(' ')[0]} } from 'react';`;
    }
    if (pattern.includes('React.memo') || pattern.includes('memo')) {
      return "import { memo } from 'react';";
    }
    if (pattern.includes('forwardRef')) {
      return "import { forwardRef } from 'react';";
    }

    // Redux
    if (pattern.includes('createSlice')) {
      return "import { createSlice } from '@reduxjs/toolkit';";
    }
    if (pattern.includes('useSelector')) {
      return "import { useSelector } from 'react-redux';";
    }
    if (pattern.includes('useDispatch')) {
      return "import { useDispatch } from 'react-redux';";
    }

    // Zustand
    if (pattern.includes('Zustand')) {
      return "import { create } from 'zustand';";
    }

    // TanStack Query
    if (pattern.includes('useQuery')) {
      return "import { useQuery } from '@tanstack/react-query';";
    }
    if (pattern.includes('useMutation')) {
      return "import { useMutation } from '@tanstack/react-query';";
    }

    // Axios
    if (pattern.includes('Axios')) {
      return "import axios from 'axios';";
    }

    // Express
    if (pattern.includes('Express Router')) {
      return "import { Router } from 'express';";
    }

    return undefined;
  }
}
