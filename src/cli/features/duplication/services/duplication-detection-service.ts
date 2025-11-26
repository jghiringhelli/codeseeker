/**
 * Duplication Detection Service
 * SOLID Principles: Single Responsibility - Handle duplication detection algorithms only
 */

import { createHash } from 'crypto';
import { Logger } from '../../../../utils/logger';
import {
  IDuplicationDetectionService,
  CodeBlock,
  DuplicationGroup,
  DuplicationType,
  CodeLocation
} from '../interfaces/index';

export class DuplicationDetectionService implements IDuplicationDetectionService {
  private logger = Logger.getInstance();

  findExactDuplicates(codeBlocks: CodeBlock[]): DuplicationGroup[] {
    const groups: DuplicationGroup[] = [];
    const hashMap = new Map<string, CodeBlock[]>();

    // Group blocks by hash
    for (const block of codeBlocks) {
      const hash = block.hash;
      if (!hashMap.has(hash)) {
        hashMap.set(hash, []);
      }
      hashMap.get(hash)!.push(block);
    }

    // Create duplication groups for blocks with identical hashes
    for (const [hash, blocks] of hashMap.entries()) {
      if (blocks.length > 1) {
        const group = this.createDuplicationGroup(
          DuplicationType.EXACT,
          1.0, // 100% similarity
          blocks,
          hash
        );
        groups.push(group);
      }
    }

    this.logger.debug(`Found ${groups.length} exact duplicate groups`);
    return groups;
  }

  findStructuralDuplicates(codeBlocks: CodeBlock[], threshold: number): DuplicationGroup[] {
    const groups: DuplicationGroup[] = [];
    const structuralMap = new Map<string, CodeBlock[]>();

    // Group blocks by structural fingerprint
    for (const block of codeBlocks) {
      const structuralKey = this.generateStructuralKey(block);
      if (!structuralMap.has(structuralKey)) {
        structuralMap.set(structuralKey, []);
      }
      structuralMap.get(structuralKey)!.push(block);
    }

    // Create groups for structurally similar blocks
    for (const [key, blocks] of structuralMap.entries()) {
      if (blocks.length > 1) {
        // Calculate average similarity within the group
        const similarity = this.calculateStructuralSimilarity(blocks);

        if (similarity >= threshold) {
          const group = this.createDuplicationGroup(
            DuplicationType.STRUCTURAL,
            similarity,
            blocks,
            key
          );
          groups.push(group);
        }
      }
    }

    this.logger.debug(`Found ${groups.length} structural duplicate groups`);
    return groups;
  }

  async findSemanticDuplicates(codeBlocks: CodeBlock[], threshold: number): Promise<DuplicationGroup[]> {
    const groups: DuplicationGroup[] = [];

    try {
      // Compare each block with every other block for semantic similarity
      const processed = new Set<string>();

      for (let i = 0; i < codeBlocks.length; i++) {
        const block1 = codeBlocks[i];
        if (processed.has(block1.hash)) continue;

        const similarBlocks: CodeBlock[] = [block1];

        for (let j = i + 1; j < codeBlocks.length; j++) {
          const block2 = codeBlocks[j];
          if (processed.has(block2.hash)) continue;

          const similarity = await this.calculateSemanticSimilarity(block1, block2);

          if (similarity >= threshold) {
            similarBlocks.push(block2);
            processed.add(block2.hash);
          }
        }

        if (similarBlocks.length > 1) {
          const avgSimilarity = await this.calculateAverageSemanticSimilarity(similarBlocks);
          const group = this.createDuplicationGroup(
            DuplicationType.SEMANTIC,
            avgSimilarity,
            similarBlocks,
            `semantic_${i}`
          );
          groups.push(group);

          // Mark all blocks in this group as processed
          for (const block of similarBlocks) {
            processed.add(block.hash);
          }
        }
      }

      this.logger.debug(`Found ${groups.length} semantic duplicate groups`);
      return groups;

    } catch (error) {
      this.logger.error('Failed to find semantic duplicates:', error);
      return [];
    }
  }

  findRenamedDuplicates(codeBlocks: CodeBlock[], threshold: number): DuplicationGroup[] {
    const groups: DuplicationGroup[] = [];

    try {
      const normalizedMap = new Map<string, CodeBlock[]>();

      // Normalize blocks by removing identifier names
      for (const block of codeBlocks) {
        const normalized = this.normalizeIdentifiers(block.content);
        const hash = createHash('md5').update(normalized).digest('hex');

        if (!normalizedMap.has(hash)) {
          normalizedMap.set(hash, []);
        }
        normalizedMap.get(hash)!.push(block);
      }

      // Create groups for blocks that are identical after normalization
      for (const [hash, blocks] of normalizedMap.entries()) {
        if (blocks.length > 1) {
          // Verify that these are actually different (not exact duplicates)
          const hasActualDifferences = this.hasActualDifferences(blocks);

          if (hasActualDifferences) {
            const similarity = this.calculateRenamedSimilarity(blocks);

            if (similarity >= threshold) {
              const group = this.createDuplicationGroup(
                DuplicationType.RENAMED,
                similarity,
                blocks,
                hash
              );
              groups.push(group);
            }
          }
        }
      }

      this.logger.debug(`Found ${groups.length} renamed duplicate groups`);
      return groups;

    } catch (error) {
      this.logger.error('Failed to find renamed duplicates:', error);
      return [];
    }
  }

  private createDuplicationGroup(
    type: DuplicationType,
    similarity: number,
    blocks: CodeBlock[],
    id: string
  ): DuplicationGroup {
    const locations: CodeLocation[] = blocks.map(block => block.location);

    // Calculate metadata
    const totalLines = blocks.reduce((sum, block) => sum + (block.location.endLine - block.location.startLine + 1), 0);
    const totalTokens = blocks.reduce((sum, block) => sum + block.tokens.length, 0);
    const avgComplexity = this.calculateComplexity(blocks);

    return {
      id: `dup_${type}_${id.substring(0, 8)}`,
      type,
      similarity,
      locations,
      metadata: {
        linesOfCode: totalLines,
        tokenCount: totalTokens,
        complexity: avgComplexity
      }
    };
  }

  private generateStructuralKey(block: CodeBlock): string {
    const { structure } = block;
    return `${structure.functionCount}_${structure.classCount}_${structure.variableCount}_${structure.controlFlowHash}`;
  }

  private calculateStructuralSimilarity(blocks: CodeBlock[]): number {
    if (blocks.length < 2) return 1.0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < blocks.length - 1; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const sim = this.compareStructuralFingerprints(blocks[i].structure, blocks[j].structure);
        totalSimilarity += sim;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private compareStructuralFingerprints(fp1: any, fp2: any): number {
    let matches = 0;
    let total = 0;

    // Compare function counts
    const functionDiff = Math.abs(fp1.functionCount - fp2.functionCount);
    const maxFunctions = Math.max(fp1.functionCount, fp2.functionCount, 1);
    matches += Math.max(0, 1 - functionDiff / maxFunctions);
    total += 1;

    // Compare class counts
    const classDiff = Math.abs(fp1.classCount - fp2.classCount);
    const maxClasses = Math.max(fp1.classCount, fp2.classCount, 1);
    matches += Math.max(0, 1 - classDiff / maxClasses);
    total += 1;

    // Compare variable counts
    const varDiff = Math.abs(fp1.variableCount - fp2.variableCount);
    const maxVars = Math.max(fp1.variableCount, fp2.variableCount, 1);
    matches += Math.max(0, 1 - varDiff / maxVars);
    total += 1;

    // Compare control flow
    if (fp1.controlFlowHash === fp2.controlFlowHash) {
      matches += 1;
    }
    total += 1;

    return total > 0 ? matches / total : 0;
  }

  private async calculateSemanticSimilarity(block1: CodeBlock, block2: CodeBlock): Promise<number> {
    try {
      // Token-based similarity
      const tokenSim = this.calculateTokenSimilarity(block1.tokens, block2.tokens);

      // AST-based similarity (if available)
      let astSim = 0;
      if (block1.astInfo && block2.astInfo) {
        astSim = this.calculateASTSimilarity(block1.astInfo, block2.astInfo);
      }

      // Content similarity
      const contentSim = this.calculateContentSimilarity(block1.content, block2.content);

      // Weighted average
      const weights = { token: 0.4, ast: 0.3, content: 0.3 };
      return (tokenSim * weights.token + astSim * weights.ast + contentSim * weights.content);

    } catch (error) {
      this.logger.debug('Failed to calculate semantic similarity:', error);
      return 0;
    }
  }

  private calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const intersection = new Set([...set1].filter(token => set2.has(token)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(content1, content2);
    const maxLength = Math.max(content1.length, content2.length);
    return maxLength > 0 ? 1 - distance / maxLength : 1;
  }

  private calculateASTSimilarity(ast1: any, ast2: any): number {
    // Simplified AST comparison - would need more sophisticated analysis
    if (!ast1 || !ast2) return 0;

    const symbols1 = ast1.symbols || [];
    const symbols2 = ast2.symbols || [];

    return this.calculateTokenSimilarity(
      symbols1.map((s: any) => s.name || ''),
      symbols2.map((s: any) => s.name || '')
    );
  }

  private async calculateAverageSemanticSimilarity(blocks: CodeBlock[]): Promise<number> {
    if (blocks.length < 2) return 1.0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < blocks.length - 1; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const sim = await this.calculateSemanticSimilarity(blocks[i], blocks[j]);
        totalSimilarity += sim;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private normalizeIdentifiers(content: string): string {
    // Replace identifiers with placeholders
    return content
      .replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g, 'IDENTIFIER')
      .replace(/\b\d+\b/g, 'NUMBER')
      .replace(/["'].*?["']/g, 'STRING')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasActualDifferences(blocks: CodeBlock[]): boolean {
    // Check if blocks have actual differences beyond normalization
    const originalHashes = blocks.map(block => block.hash);
    const uniqueHashes = new Set(originalHashes);
    return uniqueHashes.size > 1;
  }

  private calculateRenamedSimilarity(blocks: CodeBlock[]): number {
    // For renamed duplicates, similarity is based on structure after normalization
    const normalizedContents = blocks.map(block => this.normalizeIdentifiers(block.content));
    const uniqueNormalized = new Set(normalizedContents);

    // If all normalize to the same thing, they're highly similar
    if (uniqueNormalized.size === 1) {
      return 0.95; // High similarity but not 100% since they're not identical
    }

    // Calculate average similarity between normalized versions
    let totalSim = 0;
    let comparisons = 0;

    for (let i = 0; i < normalizedContents.length - 1; i++) {
      for (let j = i + 1; j < normalizedContents.length; j++) {
        const sim = this.calculateContentSimilarity(normalizedContents[i], normalizedContents[j]);
        totalSim += sim;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSim / comparisons : 0;
  }

  private calculateComplexity(blocks: CodeBlock[]): number {
    // Simple complexity calculation based on control flow elements
    const avgControlFlow = blocks.reduce((sum, block) => {
      const controlFlowCount = (block.content.match(/(?:if|for|while|switch|try)/g) || []).length;
      return sum + controlFlowCount;
    }, 0) / blocks.length;

    return Math.min(10, Math.max(1, avgControlFlow * 2));
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    // Create matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}