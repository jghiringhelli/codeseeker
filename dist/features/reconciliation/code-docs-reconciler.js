"use strict";
/**
 * Code-Documentation Reconciliation System
 * Bidirectional synchronization between code implementation and documentation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeDocsReconciler = exports.CodeDocumentationReconciler = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
class CodeDocumentationReconciler {
    projectPath;
    options;
    codePatterns;
    docPatterns;
    excludePatterns;
    constructor(options) {
        this.projectPath = options.codeDirectory;
        this.options = options;
        this.codePatterns = options.codePatterns || [
            '**/*.ts', '**/*.js', '**/*.py', '**/*.java', '**/*.cs', '**/*.go', '**/*.rs'
        ];
        this.docPatterns = options.docPatterns || [
            '**/*.md', '**/*.rst', '**/*.txt', '**/README*', '**/SPEC*', '**/API*'
        ];
        this.excludePatterns = options.excludePatterns || [
            'node_modules/**', 'dist/**', 'build/**', '.git/**', '**/*.min.*'
        ];
    }
    async reconcile() {
        console.log('🔄 Starting code-documentation reconciliation...');
        // 1. Analyze code structure
        const codeElements = await this.analyzeCodeStructure();
        console.log(`📁 Found ${codeElements.length} code elements`);
        // 2. Parse documentation
        const docElements = await this.parseDocumentation();
        console.log(`📚 Found ${docElements.length} documentation elements`);
        // 3. Extract features from both sources
        const features = await this.extractFeatures(codeElements, docElements);
        console.log(`🎯 Identified ${features.length} features`);
        // 4. Perform feature-by-feature reconciliation
        const results = [];
        for (const feature of features) {
            const result = await this.reconcileFeature(feature, codeElements, docElements);
            results.push(result);
        }
        console.log('✅ Reconciliation completed');
        return results;
    }
    async analyzeCodeStructure() {
        const elements = [];
        // Find all code files
        const codeFiles = await (0, glob_1.glob)(this.codePatterns, {
            cwd: this.projectPath,
            ignore: this.excludePatterns,
            absolute: true
        });
        for (const filePath of codeFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const fileElements = this.parseCodeFile(filePath, content);
                elements.push(...fileElements);
            }
            catch (error) {
                console.warn(`Warning: Could not parse ${filePath}:`, error.message);
            }
        }
        return elements;
    }
    parseCodeFile(filePath, content) {
        const elements = [];
        const lines = content.split('\n');
        const ext = path.extname(filePath);
        // TypeScript/JavaScript parsing
        if (['.ts', '.js'].includes(ext)) {
            elements.push(...this.parseTypeScriptFile(filePath, content, lines));
        }
        // Python parsing
        else if (ext === '.py') {
            elements.push(...this.parsePythonFile(filePath, content, lines));
        }
        // Add more language parsers as needed
        return elements;
    }
    parseTypeScriptFile(filePath, content, lines) {
        const elements = [];
        // Extract classes
        const classMatches = Array.from(content.matchAll(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g));
        for (const match of classMatches) {
            const lineNumber = this.findLineNumber(lines, match.index);
            elements.push({
                id: `class_${match[1]}_${filePath}`,
                name: match[1],
                type: 'class',
                signature: match[0],
                filePath,
                lineNumber,
                complexity: this.calculateComplexity(content, match.index),
                documentation: this.extractJSDoc(content, match.index)
            });
        }
        // Extract functions
        const functionMatches = Array.from(content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/g));
        for (const match of functionMatches) {
            const lineNumber = this.findLineNumber(lines, match.index);
            const params = this.parseParameters(match[0]);
            elements.push({
                id: `function_${match[1]}_${filePath}`,
                name: match[1],
                type: 'function',
                signature: match[0],
                parameters: params,
                returnType: this.extractReturnType(match[0]),
                filePath,
                lineNumber,
                complexity: this.calculateComplexity(content, match.index),
                documentation: this.extractJSDoc(content, match.index)
            });
        }
        // Extract methods within classes
        const methodMatches = Array.from(content.matchAll(/(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/g));
        for (const match of methodMatches) {
            const lineNumber = this.findLineNumber(lines, match.index);
            const params = this.parseParameters(match[0]);
            elements.push({
                id: `method_${match[1]}_${filePath}_${lineNumber}`,
                name: match[1],
                type: 'method',
                signature: match[0],
                parameters: params,
                returnType: this.extractReturnType(match[0]),
                filePath,
                lineNumber,
                complexity: this.calculateComplexity(content, match.index),
                documentation: this.extractJSDoc(content, match.index)
            });
        }
        return elements;
    }
    parsePythonFile(filePath, content, lines) {
        const elements = [];
        // Extract classes
        const classMatches = Array.from(content.matchAll(/class\s+(\w+)(?:\([^)]*\))?\s*:/g));
        for (const match of classMatches) {
            const lineNumber = this.findLineNumber(lines, match.index);
            elements.push({
                id: `class_${match[1]}_${filePath}`,
                name: match[1],
                type: 'class',
                signature: match[0],
                filePath,
                lineNumber,
                complexity: this.calculateComplexity(content, match.index),
                documentation: this.extractPythonDocstring(content, match.index)
            });
        }
        // Extract functions
        const functionMatches = Array.from(content.matchAll(/def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?\s*:/g));
        for (const match of functionMatches) {
            const lineNumber = this.findLineNumber(lines, match.index);
            const params = this.parsePythonParameters(match[0]);
            elements.push({
                id: `function_${match[1]}_${filePath}`,
                name: match[1],
                type: 'function',
                signature: match[0],
                parameters: params,
                returnType: this.extractPythonReturnType(match[0]),
                filePath,
                lineNumber,
                complexity: this.calculateComplexity(content, match.index),
                documentation: this.extractPythonDocstring(content, match.index)
            });
        }
        return elements;
    }
    async parseDocumentation() {
        const elements = [];
        // Find all documentation files
        const docFiles = await (0, glob_1.glob)(this.docPatterns, {
            cwd: this.projectPath,
            ignore: this.excludePatterns,
            absolute: true
        });
        for (const filePath of docFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const fileElements = this.parseDocumentationFile(filePath, content);
                elements.push(...fileElements);
            }
            catch (error) {
                console.warn(`Warning: Could not parse documentation ${filePath}:`, error.message);
            }
        }
        return elements;
    }
    parseDocumentationFile(filePath, content) {
        const elements = [];
        // Parse markdown sections
        if (filePath.endsWith('.md')) {
            elements.push(...this.parseMarkdown(filePath, content));
        }
        return elements;
    }
    parseMarkdown(filePath, content) {
        const elements = [];
        const sections = content.split(/^#+\s/m);
        for (let i = 1; i < sections.length; i++) {
            const section = sections[i];
            const titleMatch = section.match(/^(.+)/);
            const title = titleMatch ? titleMatch[1].trim() : `Section ${i}`;
            // Extract code references
            const codeReferences = this.extractCodeReferences(section);
            // Extract API specifications
            const apiSpecs = this.extractAPISpecifications(section);
            // Determine documentation type
            const type = this.determineDocumentationType(title, section);
            elements.push({
                id: `doc_${title.replace(/\s+/g, '_')}_${filePath}`,
                title,
                description: section.substring(title.length).trim(),
                type,
                filePath,
                section: title,
                codeReferences,
                expectedImplementation: apiSpecs.implementation,
                examples: apiSpecs.examples
            });
        }
        return elements;
    }
    async extractFeatures(codeElements, docElements) {
        const features = [];
        const featureMap = new Map();
        // Extract features from code
        for (const element of codeElements) {
            const featureName = this.inferFeatureName(element);
            if (!featureMap.has(featureName)) {
                featureMap.set(featureName, {
                    id: `feature_${featureName}`,
                    name: featureName,
                    description: element.description || `Feature inferred from ${element.name}`,
                    type: this.inferFeatureType(element),
                    status: 'implemented',
                    priority: this.inferPriority(element)
                });
            }
        }
        // Extract features from documentation
        for (const element of docElements) {
            const featureName = this.inferFeatureNameFromDoc(element);
            if (!featureMap.has(featureName)) {
                featureMap.set(featureName, {
                    id: `feature_${featureName}`,
                    name: featureName,
                    description: element.description,
                    type: this.inferFeatureTypeFromDoc(element),
                    status: 'documented',
                    priority: this.inferPriorityFromDoc(element)
                });
            }
            else {
                // Feature exists in both code and docs
                const feature = featureMap.get(featureName);
                feature.status = 'partial';
                feature.description = element.description || feature.description;
            }
        }
        return Array.from(featureMap.values());
    }
    async reconcileFeature(feature, codeElements, docElements) {
        // Find related code and documentation elements
        const relatedCode = this.findRelatedCodeElements(feature, codeElements);
        const relatedDocs = this.findRelatedDocElements(feature, docElements);
        // Analyze discrepancies
        const discrepancies = this.analyzeDiscrepancies(feature, relatedCode, relatedDocs);
        // Generate recommendations
        const recommendations = this.generateRecommendations(feature, relatedCode, relatedDocs, discrepancies);
        // Generate sync options
        const syncOptions = this.generateSyncOptions(feature, relatedCode, relatedDocs, discrepancies);
        return {
            feature,
            codeElements: relatedCode,
            docElements: relatedDocs,
            discrepancies,
            recommendations,
            syncOptions
        };
    }
    analyzeDiscrepancies(feature, codeElements, docElements) {
        const discrepancies = [];
        // Check for missing implementation
        if (docElements.length > 0 && codeElements.length === 0) {
            discrepancies.push({
                type: 'missing_implementation',
                severity: 'high',
                description: `Feature "${feature.name}" is documented but not implemented`,
                docLocation: { file: docElements[0].filePath, section: docElements[0].section },
                suggestedFix: 'Implement the feature based on documentation specifications'
            });
        }
        // Check for missing documentation
        if (codeElements.length > 0 && docElements.length === 0) {
            discrepancies.push({
                type: 'missing_documentation',
                severity: 'medium',
                description: `Feature "${feature.name}" is implemented but not documented`,
                codeLocation: { file: codeElements[0].filePath, line: codeElements[0].lineNumber },
                suggestedFix: 'Create documentation based on the implemented code'
            });
        }
        // Check for signature mismatches
        for (const codeEl of codeElements) {
            for (const docEl of docElements) {
                if (this.hasSignatureMismatch(codeEl, docEl)) {
                    discrepancies.push({
                        type: 'signature_mismatch',
                        severity: 'high',
                        description: `Signature mismatch between implementation and documentation for ${codeEl.name}`,
                        codeLocation: { file: codeEl.filePath, line: codeEl.lineNumber },
                        docLocation: { file: docEl.filePath, section: docEl.section },
                        suggestedFix: 'Update either code signature or documentation to match'
                    });
                }
            }
        }
        return discrepancies;
    }
    generateRecommendations(feature, codeElements, docElements, discrepancies) {
        const recommendations = [];
        for (const discrepancy of discrepancies) {
            switch (discrepancy.type) {
                case 'missing_implementation':
                    recommendations.push({
                        action: 'implement_from_docs',
                        priority: 'high',
                        description: `Implement ${feature.name} based on documentation`,
                        effort: 'medium',
                        impact: 'high',
                        generatedCode: this.generateCodeFromDocs(docElements)
                    });
                    break;
                case 'missing_documentation':
                    recommendations.push({
                        action: 'update_docs_from_code',
                        priority: 'medium',
                        description: `Document ${feature.name} based on implementation`,
                        effort: 'low',
                        impact: 'medium',
                        generatedDocs: this.generateDocsFromCode(codeElements)
                    });
                    break;
                case 'signature_mismatch':
                    recommendations.push({
                        action: 'refactor_code',
                        priority: 'high',
                        description: `Update implementation to match documented API`,
                        effort: 'medium',
                        impact: 'high',
                        generatedCode: this.generateRefactoredCode(codeElements, docElements)
                    });
                    break;
            }
        }
        return recommendations;
    }
    generateSyncOptions(feature, codeElements, docElements, discrepancies) {
        const syncOptions = [];
        // Code-to-docs sync option
        if (codeElements.length > 0) {
            syncOptions.push({
                direction: 'code_to_docs',
                description: `Update documentation to match current implementation of ${feature.name}`,
                preview: this.generateDocsFromCode(codeElements),
                confidence: this.calculateSyncConfidence(codeElements, docElements),
                risks: ['May lose documented future features', 'Could miss business context'],
                benefits: ['Documentation matches actual behavior', 'Reduces confusion for developers'],
                action: 'update_documentation'
            });
        }
        // Docs-to-code sync option
        if (docElements.length > 0) {
            syncOptions.push({
                direction: 'docs_to_code',
                description: `Update implementation to match documented specification of ${feature.name}`,
                preview: this.generateCodeFromDocs(docElements),
                confidence: this.calculateSyncConfidence(docElements, codeElements),
                risks: ['May break existing functionality', 'Could introduce bugs'],
                benefits: ['Implementation matches intended design', 'Fulfills documented promises'],
                action: 'update_implementation'
            });
        }
        return syncOptions;
    }
    // Helper methods for parsing and analysis
    findLineNumber(lines, index) {
        const beforeIndex = lines.slice(0, index).join('\n').length;
        return lines.findIndex((_, i) => lines.slice(0, i + 1).join('\n').length >= beforeIndex) + 1;
    }
    calculateComplexity(content, startIndex) {
        // Simple cyclomatic complexity calculation
        const segment = content.substring(startIndex, startIndex + 1000);
        const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||'];
        return complexityKeywords.reduce((count, keyword) => count + (segment.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length, 1);
    }
    extractJSDoc(content, index) {
        const beforeCode = content.substring(0, index);
        const jsdocMatch = beforeCode.match(/\/\*\*[\s\S]*?\*\/\s*$/);
        return jsdocMatch ? jsdocMatch[0] : undefined;
    }
    extractPythonDocstring(content, index) {
        const afterFunction = content.substring(index);
        const docstringMatch = afterFunction.match(/"""[\s\S]*?"""|'''[\s\S]*?'''/);
        return docstringMatch ? docstringMatch[0] : undefined;
    }
    parseParameters(signature) {
        const paramMatch = signature.match(/\(([^)]*)\)/);
        if (!paramMatch)
            return [];
        const params = paramMatch[1].split(',').map(p => p.trim()).filter(p => p);
        return params.map(param => {
            const [name, type] = param.split(':').map(p => p.trim());
            const hasDefault = name?.includes('=');
            const cleanName = hasDefault ? name.split('=')[0].trim() : name;
            return {
                name: cleanName || param,
                type: type || 'any',
                required: !hasDefault,
                defaultValue: hasDefault ? name.split('=')[1]?.trim() : undefined
            };
        });
    }
    parsePythonParameters(signature) {
        const paramMatch = signature.match(/\(([^)]*)\)/);
        if (!paramMatch)
            return [];
        const params = paramMatch[1].split(',').map(p => p.trim()).filter(p => p && p !== 'self');
        return params.map(param => {
            const hasDefault = param.includes('=');
            const hasType = param.includes(':');
            let name = param;
            let type = 'any';
            let defaultValue;
            if (hasType) {
                [name, type] = param.split(':').map(p => p.trim());
            }
            if (hasDefault) {
                [name, defaultValue] = name.split('=').map(p => p.trim());
            }
            return {
                name,
                type,
                required: !hasDefault,
                defaultValue
            };
        });
    }
    extractReturnType(signature) {
        const returnMatch = signature.match(/:\s*([^{]+)/);
        return returnMatch ? returnMatch[1].trim() : 'void';
    }
    extractPythonReturnType(signature) {
        const returnMatch = signature.match(/->\s*([^:]+)/);
        return returnMatch ? returnMatch[1].trim() : 'None';
    }
    extractCodeReferences(text) {
        const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
        const inlineCode = text.match(/`[^`]+`/g) || [];
        return [...codeBlocks, ...inlineCode].map(code => code.replace(/```|`/g, '').trim());
    }
    extractAPISpecifications(text) {
        const examples = text.match(/```[\s\S]*?```/g) || [];
        return {
            implementation: examples.find(ex => ex.includes('function') || ex.includes('class')),
            examples: examples.map(ex => ex.replace(/```|`/g, '').trim())
        };
    }
    determineDocumentationType(title, content) {
        const lowerTitle = title.toLowerCase();
        const lowerContent = content.toLowerCase();
        if (lowerTitle.includes('api') || lowerContent.includes('endpoint'))
            return 'api';
        if (lowerTitle.includes('guide') || lowerTitle.includes('tutorial'))
            return 'guide';
        if (lowerTitle.includes('spec') || lowerTitle.includes('requirement'))
            return 'specification';
        if (lowerContent.includes('example') || lowerContent.includes('usage'))
            return 'example';
        return 'guide';
    }
    inferFeatureName(element) {
        // Extract feature name from code element
        return element.name.replace(/([A-Z])/g, ' $1').trim().toLowerCase().replace(/\s+/g, '_');
    }
    inferFeatureNameFromDoc(element) {
        return element.title.toLowerCase().replace(/\s+/g, '_');
    }
    inferFeatureType(element) {
        switch (element.type) {
            case 'class': return 'component';
            case 'function': return 'function';
            default: return 'module';
        }
    }
    inferFeatureTypeFromDoc(element) {
        switch (element.type) {
            case 'api': return 'api';
            case 'specification': return 'workflow';
            default: return 'module';
        }
    }
    inferPriority(element) {
        // Infer priority based on complexity and usage
        if (element.complexity > 10)
            return 'high';
        if (element.complexity > 5)
            return 'medium';
        return 'low';
    }
    inferPriorityFromDoc(element) {
        const content = element.description.toLowerCase();
        if (content.includes('critical') || content.includes('must'))
            return 'critical';
        if (content.includes('important') || content.includes('should'))
            return 'high';
        if (content.includes('nice') || content.includes('could'))
            return 'low';
        return 'medium';
    }
    findRelatedCodeElements(feature, codeElements) {
        const featureName = feature.name.toLowerCase();
        return codeElements.filter(element => element.name.toLowerCase().includes(featureName) ||
            featureName.includes(element.name.toLowerCase()));
    }
    findRelatedDocElements(feature, docElements) {
        const featureName = feature.name.toLowerCase();
        return docElements.filter(element => element.title.toLowerCase().includes(featureName) ||
            element.description.toLowerCase().includes(featureName));
    }
    hasSignatureMismatch(codeElement, docElement) {
        // Check if documented API matches implemented API
        const docCodeRefs = docElement.codeReferences;
        const codeSignature = codeElement.signature.toLowerCase();
        return docCodeRefs.some(ref => ref.includes(codeElement.name) && !ref.includes(codeSignature.substring(0, 50)));
    }
    generateCodeFromDocs(docElements) {
        // Generate implementation code based on documentation
        let code = '// Generated from documentation\n\n';
        for (const doc of docElements) {
            if (doc.expectedImplementation) {
                code += `/**\n * ${doc.description}\n */\n`;
                code += doc.expectedImplementation + '\n\n';
            }
        }
        return code;
    }
    generateDocsFromCode(codeElements) {
        // Generate documentation based on code implementation
        let docs = '# Generated Documentation\n\n';
        for (const element of codeElements) {
            docs += `## ${element.name}\n\n`;
            if (element.description) {
                docs += `${element.description}\n\n`;
            }
            docs += '```typescript\n';
            docs += element.signature + '\n';
            docs += '```\n\n';
            if (element.parameters && element.parameters.length > 0) {
                docs += '### Parameters\n\n';
                for (const param of element.parameters) {
                    docs += `- **${param.name}** (${param.type}): ${param.description || 'No description'}\n`;
                }
                docs += '\n';
            }
        }
        return docs;
    }
    generateRefactoredCode(codeElements, docElements) {
        // Generate refactored code to match documentation
        let code = '// Refactored to match documentation\n\n';
        // This would contain sophisticated logic to merge code and docs
        // For now, return a placeholder
        code += '// TODO: Implement refactoring logic\n';
        return code;
    }
    calculateSyncConfidence(sourceElements, targetElements) {
        if (sourceElements.length === 0)
            return 0;
        if (targetElements.length === 0)
            return 1;
        // Calculate confidence based on element matching
        const matchingElements = sourceElements.filter(src => targetElements.some(tgt => this.elementsMatch(src, tgt)));
        return Math.min(0.9, matchingElements.length / sourceElements.length);
    }
    elementsMatch(element1, element2) {
        return element1.name === element2.name ||
            element1.title === element2.title;
    }
    /**
     * Applies a synchronization option to reconcile code and documentation
     */
    async applySyncOption(feature, syncDirection, options = {}) {
        try {
            const changes = [];
            const { selectedSyncOption, preview = false, dryRun = false, backupFiles = true } = options;
            if (preview || dryRun) {
                // Return preview of changes without applying them
                return {
                    success: true,
                    changes: [`Preview: Would sync ${feature.name} from ${syncDirection}`],
                    details: {
                        preview: true,
                        feature: feature.name,
                        direction: syncDirection,
                        action: selectedSyncOption?.action || 'default_sync'
                    }
                };
            }
            if (syncDirection === 'code-to-docs') {
                // Sync from code to documentation
                const result = await this.syncCodeToDocumentation(feature, selectedSyncOption);
                changes.push(`Updated documentation for ${feature.name}`);
                return {
                    success: result.success,
                    changes: changes,
                    updatedContent: result.updatedContent,
                    details: result.details
                };
            }
            else if (syncDirection === 'docs-to-code') {
                // Sync from documentation to code
                const result = await this.syncDocumentationToCode(feature, selectedSyncOption);
                changes.push(`Updated code implementation for ${feature.name}`);
                return {
                    success: result.success,
                    changes: changes,
                    updatedContent: result.updatedContent,
                    details: result.details
                };
            }
            else {
                return {
                    success: false,
                    error: `Invalid sync direction: ${syncDirection}`,
                    details: { supportedDirections: ['code-to-docs', 'docs-to-code'] }
                };
            }
        }
        catch (error) {
            console.error('Error applying sync option:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during sync operation',
                details: { feature: feature.name, direction: syncDirection }
            };
        }
    }
    /**
     * Syncs code implementation to documentation
     */
    async syncCodeToDocumentation(feature, syncOption) {
        const fs = require('fs').promises;
        const path = require('path');
        try {
            // Find the documentation file to update
            const docFile = await this.findDocumentationFileForFeature(feature);
            if (!docFile) {
                return {
                    success: false,
                    details: { error: 'No documentation file found for feature' }
                };
            }
            // Read current documentation content
            const currentContent = await fs.readFile(docFile, 'utf-8');
            // Generate updated documentation based on code
            const updatedContent = await this.generateDocumentationFromCode(feature, currentContent);
            // Write updated content
            await fs.writeFile(docFile, updatedContent, 'utf-8');
            return {
                success: true,
                updatedContent: updatedContent,
                details: {
                    updatedFile: docFile,
                    action: 'code_to_docs_sync'
                }
            };
        }
        catch (error) {
            return {
                success: false,
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    action: 'code_to_docs_sync'
                }
            };
        }
    }
    /**
     * Syncs documentation to code implementation
     */
    async syncDocumentationToCode(feature, syncOption) {
        const fs = require('fs').promises;
        const path = require('path');
        try {
            // Find the code file to update
            const codeFile = await this.findCodeFileForFeature(feature);
            if (!codeFile) {
                return {
                    success: false,
                    details: { error: 'No code file found for feature' }
                };
            }
            // Read current code content
            const currentContent = await fs.readFile(codeFile, 'utf-8');
            // Generate updated code based on documentation
            const updatedContent = await this.generateCodeFromDocumentation(feature, currentContent);
            // Write updated content
            await fs.writeFile(codeFile, updatedContent, 'utf-8');
            return {
                success: true,
                updatedContent: updatedContent,
                details: {
                    updatedFile: codeFile,
                    action: 'docs_to_code_sync'
                }
            };
        }
        catch (error) {
            return {
                success: false,
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    action: 'docs_to_code_sync'
                }
            };
        }
    }
    /**
     * Helper methods for file operations
     */
    async findDocumentationFileForFeature(feature) {
        const fs = require('fs').promises;
        const path = require('path');
        // Simple implementation - looks for README.md or feature-specific docs
        const possiblePaths = [
            path.join(this.options.documentationDirectory, 'README.md'),
            path.join(this.options.documentationDirectory, `${feature.name.toLowerCase()}.md`),
            path.join(this.options.documentationDirectory, 'features', `${feature.name.toLowerCase()}.md`)
        ];
        for (const filePath of possiblePaths) {
            try {
                await fs.access(filePath);
                return filePath;
            }
            catch {
                // File doesn't exist, continue
            }
        }
        return possiblePaths[0]; // Return default path for creation
    }
    async findCodeFileForFeature(feature) {
        const fs = require('fs').promises;
        const path = require('path');
        // Simple implementation - looks for feature-specific files
        const possiblePaths = [
            path.join(this.options.codeDirectory, `${feature.name.toLowerCase()}.ts`),
            path.join(this.options.codeDirectory, `${feature.name.toLowerCase()}.js`),
            path.join(this.options.codeDirectory, 'src', `${feature.name.toLowerCase()}.ts`),
            path.join(this.options.codeDirectory, 'lib', `${feature.name.toLowerCase()}.ts`)
        ];
        for (const filePath of possiblePaths) {
            try {
                await fs.access(filePath);
                return filePath;
            }
            catch {
                // File doesn't exist, continue
            }
        }
        return possiblePaths[0]; // Return default path for creation
    }
    async generateDocumentationFromCode(feature, currentContent) {
        // Simple implementation - adds or updates a feature section
        const featureSection = `## ${feature.name}

${feature.description}

**Type**: ${feature.type}  
**Status**: ${feature.status}  
**Priority**: ${feature.priority}

### Implementation Details

This feature is implemented in the codebase. See the relevant code files for specific implementation details.

*Last updated: ${new Date().toISOString()}*

`;
        // Check if the feature section already exists
        const featureHeaderRegex = new RegExp(`## ${feature.name}`, 'i');
        if (featureHeaderRegex.test(currentContent)) {
            // Replace existing section (simplified - just replaces the header)
            return currentContent.replace(featureHeaderRegex, featureSection.trim());
        }
        else {
            // Append new section
            return currentContent + '\n\n' + featureSection;
        }
    }
    async generateCodeFromDocumentation(feature, currentContent) {
        // Simple implementation - adds a placeholder implementation
        const implementationCode = `
// ${feature.name} - ${feature.description}
// Auto-generated from documentation on ${new Date().toISOString()}

/**
 * ${feature.description}
 * 
 * @type ${feature.type}
 * @status ${feature.status}
 * @priority ${feature.priority}
 */
${feature.type === 'function' ? this.generateFunctionImplementation(feature) :
            feature.type === 'class' ? this.generateClassImplementation(feature) :
                this.generateGenericImplementation(feature)}
`;
        return currentContent + '\n' + implementationCode;
    }
    generateFunctionImplementation(feature) {
        const functionName = feature.name.replace(/\s+/g, '').charAt(0).toLowerCase() +
            feature.name.replace(/\s+/g, '').slice(1);
        return `function ${functionName}() {
    // TODO: Implement ${feature.name}
    // ${feature.description}
    throw new Error('${feature.name} not yet implemented');
}

export { ${functionName} };`;
    }
    generateClassImplementation(feature) {
        const className = feature.name.replace(/\s+/g, '');
        return `class ${className} {
    /**
     * ${feature.description}
     */
    constructor() {
        // TODO: Initialize ${feature.name}
    }

    // TODO: Add methods based on documentation
}

export { ${className} };`;
    }
    generateGenericImplementation(feature) {
        return `// ${feature.name} implementation
// TODO: Implement based on documentation requirements
// ${feature.description}

export const ${feature.name.replace(/\s+/g, '')} = {
    // Implementation needed
};`;
    }
}
exports.CodeDocumentationReconciler = CodeDocumentationReconciler;
exports.default = CodeDocumentationReconciler;
exports.CodeDocsReconciler = CodeDocumentationReconciler;
//# sourceMappingURL=code-docs-reconciler.js.map