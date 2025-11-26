/**
 * Claude Response Parser - SOLID Principles Implementation
 * Single Responsibility: Parse and clean Claude Code JSON responses
 * Open/Closed: Extensible for different response formats
 * Interface Segregation: Focused interface for parsing operations only
 */

import { Logger } from '../../../utils/logger';

export interface ParsedClaudeResponse {
  category?: string;
  confidence?: number;
  params?: any;
  intent?: any;
  taskGroups?: any[];
}

export interface IClaudeResponseParser {
  parseResponse(response: any, userRequest: string): ParsedClaudeResponse;
}

export class ClaudeResponseParser implements IClaudeResponseParser {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance().child('ClaudeResponseParser');
  }

  parseResponse(response: any, userRequest: string): ParsedClaudeResponse {
    if (!response.success) {
      return { category: 'error', confidence: 0.0, params: {} };
    }

    try {
      this.logger.debug(`🔍 Raw Claude Code response (${(response.data || '').length} chars): ${(response.data || '').substring(0, 200)}...`);

      // First, try to clean the response and extract just JSON
      let cleanedResponse = (response.data || '').trim();

      // Remove any markdown code blocks
      cleanedResponse = cleanedResponse.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1');

      // Try pattern-based extraction first
      const patternResult = this.tryPatternExtraction(cleanedResponse);
      if (patternResult) {
        return patternResult;
      }

      // Try advanced brace matching
      const braceResult = this.tryBraceMatching(cleanedResponse);
      if (braceResult) {
        return braceResult;
      }

      // Try parsing the entire response as JSON
      return JSON.parse(cleanedResponse);

    } catch (error) {
      this.logger.warn(`⚠️ JSON parsing failed: ${error.message}`);
      this.logger.debug(`🔍 Raw Claude Code response: ${response.data}`);

      // Fall back to text analysis
      return this.analyzeTextForIntent(response.data, userRequest);
    }
  }

  private tryPatternExtraction(cleanedResponse: string): ParsedClaudeResponse | null {
    const patterns = [
      // Complete comprehensive format - more flexible brace matching
      /\{[\s\S]*?"intent"[\s\S]*?"category"[\s\S]*?"taskGroups"[\s\S]*?\]/,
      // Legacy category format (fallback)
      /\{[^{}]*"category"[^{}]*"confidence"[^{}]*\}/,
      // Simple intent format without taskGroups
      /\{[^{}]*"intent"[^{}]*"category"[^{}]*\}/,
      // Minimal JSON with category
      /\{[^}]*"category"[^}]*\}/
    ];

    for (let i = 0; i < patterns.length; i++) {
      const jsonMatch = cleanedResponse.match(patterns[i]);
      if (jsonMatch) {
        try {
          this.logger.debug(`✅ Found JSON pattern ${i + 1}: ${jsonMatch[0]}`);
          const parsed = JSON.parse(jsonMatch[0]);

          // Handle new comprehensive format
          if (parsed.intent && parsed.taskGroups) {
            this.logger.debug(`✅ Parsed comprehensive workflow response`);
            return this.transformComprehensiveResponse(parsed);
          }

          // Handle legacy category format
          if (parsed.category) {
            this.logger.debug(`✅ Parsed legacy category response`);
            return parsed;
          }
        } catch (parseError) {
          this.logger.debug(`❌ Pattern ${i + 1} failed to parse: ${parseError.message}`);
          continue;
        }
      }
    }

    return null;
  }

  private tryBraceMatching(cleanedResponse: string): ParsedClaudeResponse | null {
    const jsonStart = cleanedResponse.indexOf('{');
    if (jsonStart < 0) {
      return null;
    }

    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    let jsonEnd = jsonStart;
    let hasClosedProperly = false;

    for (let i = jsonStart; i < cleanedResponse.length; i++) {
      const char = cleanedResponse[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            hasClosedProperly = true;
            break;
          }
        }
      }
    }

    // Handle truncated JSON
    if (!hasClosedProperly && braceCount > 0) {
      const repairedResult = this.repairTruncatedJson(cleanedResponse, jsonStart);
      if (repairedResult) {
        return repairedResult;
      }
    }

    if (jsonEnd > jsonStart) {
      const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
      this.logger.debug(`✅ Found JSON via advanced brace matching (${jsonStr.length} chars)`);
      try {
        const parsed = JSON.parse(jsonStr);

        // Handle comprehensive format first
        if (parsed.intent && parsed.taskGroups) {
          this.logger.debug(`✅ Parsed comprehensive workflow response via brace matching`);
          return this.transformComprehensiveResponse(parsed);
        }

        // Handle legacy format
        if (parsed.category) {
          this.logger.debug(`✅ Parsed legacy category response via brace matching`);
          return parsed;
        }
      } catch (parseError) {
        this.logger.debug(`❌ Advanced brace matching failed to parse: ${parseError.message}`);
      }
    }

    return null;
  }

  private repairTruncatedJson(cleanedResponse: string, jsonStart: number): ParsedClaudeResponse | null {
    this.logger.debug(`⚠️ JSON appears truncated, attempting repair...`);

    // Try to find a reasonable stopping point for partial JSON
    let lastValidPosition = jsonStart;
    let tempBraceCount = 0;

    for (let i = jsonStart; i < cleanedResponse.length; i++) {
      const char = cleanedResponse[i];
      if (char === '{') tempBraceCount++;
      else if (char === '}') tempBraceCount--;

      // Look for complete property definitions
      if (char === ',' && tempBraceCount === 1) {
        lastValidPosition = i;
      }
    }

    // Construct a completed JSON by closing at the last valid position
    if (lastValidPosition > jsonStart) {
      const partialJson = cleanedResponse.substring(jsonStart, lastValidPosition);
      const repairedJson = partialJson + '}'; // Close the main object

      this.logger.debug(`🔧 Attempting to parse repaired JSON (${repairedJson.length} chars)`);
      try {
        const parsed = JSON.parse(repairedJson);
        if (parsed.intent || parsed.category) {
          this.logger.debug(`✅ Successfully parsed repaired JSON`);
          return parsed.intent ? this.transformComprehensiveResponse(parsed) : parsed;
        }
      } catch (repairError) {
        this.logger.debug(`❌ Repaired JSON also failed: ${repairError.message}`);
      }
    }

    return null;
  }

  private analyzeTextForIntent(responseText: string, userRequest: string): ParsedClaudeResponse {
    const lowerResponseText = (responseText || '').toLowerCase();
    const userRequestLower = userRequest.toLowerCase();

    // Look for specific intent indicators in the response and original request
    if (lowerResponseText.includes('report') ||
        lowerResponseText.includes('what is') ||
        lowerResponseText.includes('describe') ||
        lowerResponseText.includes('about') ||
        lowerResponseText.includes('explain') ||
        userRequestLower.includes('what is this project about') ||
        userRequestLower.includes('what is') ||
        userRequestLower.includes('describe') ||
        userRequestLower.includes('about')) {
      this.logger.debug('📋 Detected report intent from text analysis');
      return { category: 'report', confidence: 0.8, params: {} };
    }

    if (lowerResponseText.includes('feature') || lowerResponseText.includes('add') || lowerResponseText.includes('implement')) {
      this.logger.debug('🔨 Detected feature_request intent from text analysis');
      return { category: 'feature_request', confidence: 0.7, params: {} };
    }

    if (lowerResponseText.includes('fix') || lowerResponseText.includes('bug') || lowerResponseText.includes('error')) {
      this.logger.debug('🐛 Detected bug_fix intent from text analysis');
      return { category: 'bug_fix', confidence: 0.7, params: {} };
    }

    // Fallback to default intent
    this.logger.debug('❌ Using fallback intent: analysis');
    return { category: 'analysis', confidence: 0.5, params: {} };
  }

  /**
   * Transform comprehensive workflow response to legacy format for backwards compatibility
   */
  private transformComprehensiveResponse(parsed: any): ParsedClaudeResponse {
    // Check if this is already a legacy format
    if (parsed.category && !parsed.intent) {
      return parsed;
    }

    // Transform comprehensive format to legacy format
    const intent = parsed.intent || {};
    const category = intent.category || 'analysis';
    const confidence = intent.confidence || 0.8;

    return {
      category,
      confidence,
      params: {
        originalIntent: intent,
        taskGroups: parsed.taskGroups || [],
        reasoning: intent.reasoning || '',
        assumptions: intent.assumptions || []
      }
    };
  }
}