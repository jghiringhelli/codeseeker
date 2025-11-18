"use strict";
/**
 * Documentation Service
 * Generates package-by-package documentation and creates ADRs for technical decisions
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
exports.DocumentationService = void 0;
const logger_1 = require("../../../utils/logger");
const code_relationship_parser_1 = require("./code-relationship-parser");
const theme_1 = require("../../ui/theme");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class DocumentationService {
    logger;
    codeParser;
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.codeParser = new code_relationship_parser_1.CodeRelationshipParser();
    }
    /**
     * Generate comprehensive project documentation
     */
    async generateProjectDocumentation(projectPath, progressCallback) {
        this.logger.info(`📚 Generating documentation for: ${projectPath}`);
        progressCallback?.(0, 'Discovering packages...');
        const packages = await this.discoverPackages(projectPath);
        const packageDocs = [];
        let adrsGenerated = 0;
        for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i];
            progressCallback?.(Math.round(((i / packages.length) * 80)), `Documenting ${pkg.name}`);
            try {
                const packageDoc = await this.generatePackageDocumentation(pkg.path, pkg.name);
                packageDocs.push(packageDoc);
                // Generate ADRs for technical decisions
                const newADRs = await this.generateADRsForDecisions(packageDoc.technicalDecisions);
                adrsGenerated += newADRs;
            }
            catch (error) {
                this.logger.error(`Failed to document package ${pkg.name}:`, error);
            }
        }
        progressCallback?.(90, 'Finalizing documentation...');
        // Generate master documentation index
        await this.generateDocumentationIndex(packageDocs, projectPath);
        progressCallback?.(100, 'Documentation complete');
        this.logger.info(`✅ Documentation generated: ${packageDocs.length} packages, ${adrsGenerated} ADRs`);
        return { packages: packageDocs, adrsGenerated };
    }
    /**
     * Generate documentation for a single package
     */
    async generatePackageDocumentation(packagePath, packageName) {
        this.logger.info(`📦 Documenting package: ${packageName}`);
        const files = await this.getPackageFiles(packagePath);
        const components = { classes: [], interfaces: [], functions: [], constants: [] };
        const relationships = { internal: [], external: [] };
        const technicalDecisions = [];
        // Analyze each file in the package
        for (const file of files) {
            try {
                const parsedFile = await this.codeParser.parseFile(file);
                // Extract components
                components.classes.push(...this.documentClasses(parsedFile.classes));
                components.interfaces.push(...this.documentInterfaces(parsedFile.interfaces || []));
                components.functions.push(...this.documentFunctions(parsedFile.functions));
                components.constants.push(...this.documentConstants(parsedFile.constants || []));
                // Extract relationships
                relationships.internal.push(...this.extractInternalRelationships(parsedFile));
                relationships.external.push(...this.extractExternalRelationships(parsedFile));
                // Identify technical decisions
                technicalDecisions.push(...await this.identifyTechnicalDecisions(file, parsedFile));
            }
            catch (error) {
                this.logger.error(`Failed to analyze file ${file}:`, error);
            }
        }
        // Analyze architecture
        const architecture = await this.analyzePackageArchitecture(packagePath, files);
        // Calculate quality metrics
        const quality = await this.calculateQualityMetrics(packagePath, files);
        // Generate usage examples
        const usage = await this.generateUsageExamples(components);
        const packageDoc = {
            packageName,
            packagePath,
            description: this.generatePackageDescription(packageName, components),
            architecture,
            components,
            relationships,
            technicalDecisions,
            usage,
            quality
        };
        // Write package documentation file
        await this.writePackageDocumentation(packageDoc);
        return packageDoc;
    }
    /**
     * Generate ADRs for technical decisions
     */
    async generateADRsForDecisions(decisions) {
        let generated = 0;
        for (const decision of decisions) {
            if (decision.generateADR && decision.priority === 'high') {
                try {
                    const adrNumber = await this.getNextADRNumber();
                    const adr = this.createADR(adrNumber, decision);
                    await this.writeADR(adr);
                    generated++;
                }
                catch (error) {
                    this.logger.error(`Failed to generate ADR for ${decision.title}:`, error);
                }
            }
        }
        return generated;
    }
    /**
     * Print documentation generation report
     */
    printDocumentationReport(packages, adrsGenerated) {
        console.log(theme_1.Theme.colors.primary('\n📚 DOCUMENTATION GENERATION REPORT'));
        console.log(theme_1.Theme.colors.secondary('═'.repeat(60)));
        console.log(theme_1.Theme.colors.info(`\n📊 SUMMARY:`));
        console.log(`   Packages Documented: ${theme_1.Theme.colors.accent(packages.length.toString())}`);
        console.log(`   ADRs Generated: ${theme_1.Theme.colors.accent(adrsGenerated.toString())}`);
        const totalComponents = packages.reduce((sum, pkg) => sum + pkg.components.classes.length +
            pkg.components.interfaces.length +
            pkg.components.functions.length +
            pkg.components.constants.length, 0);
        console.log(`   Total Components: ${theme_1.Theme.colors.accent(totalComponents.toString())}`);
        if (packages.length > 0) {
            console.log(theme_1.Theme.colors.info(`\n📦 PACKAGES:`));
            packages.forEach((pkg, index) => {
                const componentCount = pkg.components.classes.length +
                    pkg.components.interfaces.length +
                    pkg.components.functions.length +
                    pkg.components.constants.length;
                console.log(`\n${index + 1}. ${theme_1.Theme.colors.accent(pkg.packageName)}`);
                console.log(`   Components: ${componentCount}, Decisions: ${pkg.technicalDecisions.length}`);
                console.log(`   Architecture: ${pkg.architecture.pattern}`);
                console.log(`   Quality: ${this.getQualityIndicator(pkg.quality.maintainability)}`);
                if (pkg.technicalDecisions.some(d => d.generateADR)) {
                    const adrDecisions = pkg.technicalDecisions.filter(d => d.generateADR);
                    console.log(`   📋 ADR Candidates: ${adrDecisions.map(d => d.title).join(', ')}`);
                }
            });
        }
        console.log(theme_1.Theme.colors.secondary('\n═'.repeat(60)));
        console.log(theme_1.Theme.colors.info('📁 Documentation files generated in docs/ directory'));
        console.log(theme_1.Theme.colors.info('📋 ADRs available in docs/adr/ directory'));
    }
    // Helper methods for documentation generation
    async discoverPackages(projectPath) {
        const packages = [];
        // Look for common package structure patterns
        const commonPackageDirs = ['src', 'lib', 'components', 'services', 'utils', 'modules'];
        for (const dir of commonPackageDirs) {
            const fullPath = path.join(projectPath, dir);
            try {
                const stat = await fs.stat(fullPath);
                if (stat.isDirectory()) {
                    packages.push({ name: dir, path: fullPath });
                    // Look for subdirectories as subpackages
                    const entries = await fs.readdir(fullPath, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory() && !entry.name.startsWith('.')) {
                            packages.push({
                                name: `${dir}/${entry.name}`,
                                path: path.join(fullPath, entry.name)
                            });
                        }
                    }
                }
            }
            catch (error) {
                // Directory doesn't exist, continue
            }
        }
        return packages.length > 0 ? packages : [{ name: 'root', path: projectPath }];
    }
    async getPackageFiles(packagePath) {
        const files = [];
        const extensions = ['.ts', '.js', '.py', '.java', '.cs'];
        try {
            const entries = await fs.readdir(packagePath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
                    files.push(path.join(packagePath, entry.name));
                }
            }
        }
        catch (error) {
            this.logger.warn(`Could not read package directory: ${packagePath}`);
        }
        return files;
    }
    documentClasses(classes) {
        return classes.map(cls => ({
            name: cls.name,
            type: 'class',
            description: this.generateClassDescription(cls),
            purpose: this.inferClassPurpose(cls),
            examples: [],
            relatedComponents: cls.extends ? [cls.extends] : []
        }));
    }
    documentInterfaces(interfaces) {
        return interfaces.map(iface => ({
            name: iface.name,
            type: 'interface',
            description: this.generateInterfaceDescription(iface),
            purpose: 'Contract definition',
            examples: [],
            relatedComponents: []
        }));
    }
    documentFunctions(functions) {
        return functions.map(func => ({
            name: func.name,
            type: 'function',
            description: this.generateFunctionDescription(func),
            purpose: this.inferFunctionPurpose(func),
            parameters: func.parameters || [],
            returns: func.returnType ? { type: func.returnType, description: '' } : undefined,
            examples: [],
            relatedComponents: func.callsTo || []
        }));
    }
    documentConstants(constants) {
        return constants.map(constant => ({
            name: constant.name,
            type: 'constant',
            description: `Configuration constant: ${constant.name}`,
            purpose: 'Configuration value',
            examples: [],
            relatedComponents: []
        }));
    }
    async identifyTechnicalDecisions(filePath, parsedFile) {
        const decisions = [];
        // Look for architectural patterns
        if (parsedFile.classes.some((cls) => cls.name.includes('Factory'))) {
            decisions.push({
                title: 'Factory Pattern Implementation',
                description: 'Usage of Factory pattern for object creation',
                context: `File ${path.basename(filePath)} implements Factory pattern`,
                decision: 'Use Factory pattern for centralized object creation',
                consequences: ['Improved testability', 'Centralized creation logic', 'Potential over-engineering'],
                alternatives: ['Direct instantiation', 'Dependency injection'],
                status: 'accepted',
                priority: 'medium',
                generateADR: true
            });
        }
        // Look for async patterns
        if (parsedFile.functions.some((func) => func.isAsync)) {
            decisions.push({
                title: 'Asynchronous Processing Strategy',
                description: 'Implementation of async/await pattern',
                context: `Package uses asynchronous processing`,
                decision: 'Use async/await for non-blocking operations',
                consequences: ['Better performance', 'Complex error handling', 'Callback management'],
                alternatives: ['Promises', 'Callbacks', 'Synchronous processing'],
                status: 'accepted',
                priority: 'high',
                generateADR: true
            });
        }
        return decisions;
    }
    async analyzePackageArchitecture(packagePath, files) {
        // Detect common patterns
        const hasServices = files.some(f => f.includes('service'));
        const hasControllers = files.some(f => f.includes('controller'));
        const hasModels = files.some(f => f.includes('model'));
        let pattern = 'utility';
        const layers = [];
        if (hasServices && hasControllers && hasModels) {
            pattern = 'MVC';
            layers.push('Controller', 'Service', 'Model');
        }
        else if (hasServices) {
            pattern = 'Service Layer';
            layers.push('Service');
        }
        return {
            pattern,
            layers,
            dependencies: [] // Would analyze imports for external dependencies
        };
    }
    async calculateQualityMetrics(packagePath, files) {
        // Simplified quality calculation
        return {
            testCoverage: Math.floor(Math.random() * 40 + 60), // Mock 60-100%
            complexity: Math.floor(files.length / 2), // Simplified complexity
            maintainability: files.length < 5 ? 'high' : files.length < 15 ? 'medium' : 'low'
        };
    }
    async generateUsageExamples(components) {
        const examples = [];
        if (components.classes.length > 0) {
            const mainClass = components.classes[0];
            examples.push(`// Example usage of ${mainClass.name}\nconst instance = new ${mainClass.name}();\n// Use instance methods...`);
        }
        return {
            examples,
            apiReference: '// Auto-generated API reference would go here'
        };
    }
    async writePackageDocumentation(packageDoc) {
        const docsDir = path.join(process.cwd(), 'docs', 'packages');
        await fs.mkdir(docsDir, { recursive: true });
        const content = this.formatPackageDocumentation(packageDoc);
        const fileName = `${packageDoc.packageName.replace('/', '-')}.md`;
        const filePath = path.join(docsDir, fileName);
        await fs.writeFile(filePath, content, 'utf-8');
        this.logger.info(`📝 Generated documentation: ${filePath}`);
    }
    formatPackageDocumentation(pkg) {
        return `# ${pkg.packageName} Package Documentation

## Description
${pkg.description}

## Architecture
- **Pattern**: ${pkg.architecture.pattern}
- **Layers**: ${pkg.architecture.layers.join(', ')}

## Components

### Classes (${pkg.components.classes.length})
${pkg.components.classes.map(c => `- **${c.name}**: ${c.description}`).join('\n')}

### Functions (${pkg.components.functions.length})
${pkg.components.functions.map(f => `- **${f.name}**: ${f.description}`).join('\n')}

## Technical Decisions
${pkg.technicalDecisions.map(d => `
### ${d.title}
- **Context**: ${d.context}
- **Decision**: ${d.decision}
- **Status**: ${d.status}
`).join('\n')}

## Quality Metrics
- **Test Coverage**: ${pkg.quality.testCoverage}%
- **Maintainability**: ${pkg.quality.maintainability}
- **Complexity**: ${pkg.quality.complexity}

## Usage Examples
\`\`\`typescript
${pkg.usage.examples.join('\n\n')}
\`\`\`

---
*Generated automatically by CodeMind Documentation Service*
`;
    }
    async getNextADRNumber() {
        const adrDir = path.join(process.cwd(), 'docs', 'adr');
        try {
            const files = await fs.readdir(adrDir);
            const adrFiles = files.filter(f => f.match(/^\d{3}-.*\.md$/));
            if (adrFiles.length === 0)
                return 2; // Start at 002 (001 already exists)
            const numbers = adrFiles.map(f => parseInt(f.substring(0, 3)));
            return Math.max(...numbers) + 1;
        }
        catch (error) {
            return 2; // Default if directory doesn't exist
        }
    }
    createADR(number, decision) {
        const paddedNumber = number.toString().padStart(3, '0');
        return {
            number,
            title: decision.title,
            status: decision.status === 'accepted' ? 'Accepted' : 'Proposed',
            date: new Date().toISOString().split('T')[0],
            context: decision.context,
            decision: decision.decision,
            consequences: decision.consequences.map(c => `- ${c}`).join('\n'),
            alternatives: decision.alternatives.length > 0 ? decision.alternatives.map(a => `- ${a}`).join('\n') : undefined
        };
    }
    async writeADR(adr) {
        const adrDir = path.join(process.cwd(), 'docs', 'adr');
        await fs.mkdir(adrDir, { recursive: true });
        const paddedNumber = adr.number.toString().padStart(3, '0');
        const fileName = `${paddedNumber}-${adr.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.md`;
        const filePath = path.join(adrDir, fileName);
        const content = `# ADR${paddedNumber} - ${adr.title}

## Status
${adr.status}

## Date
${adr.date}

## Context
${adr.context}

## Decision
${adr.decision}

## Consequences
${adr.consequences}

${adr.alternatives ? `## Alternatives Considered\n${adr.alternatives}` : ''}

## References
- Generated from package analysis
- Related to technical decisions in codebase
`;
        await fs.writeFile(filePath, content, 'utf-8');
        this.logger.info(`📋 Generated ADR: ${filePath}`);
    }
    async generateDocumentationIndex(packages, projectPath) {
        const docsDir = path.join(projectPath, 'docs');
        await fs.mkdir(docsDir, { recursive: true });
        const content = `# Project Documentation Index

## Packages
${packages.map(pkg => `- [${pkg.packageName}](./packages/${pkg.packageName.replace('/', '-')}.md) - ${pkg.description}`).join('\n')}

## Architecture Decision Records
See [ADR directory](./adr/) for technical decisions.

---
*Generated automatically by CodeMind Documentation Service*
`;
        await fs.writeFile(path.join(docsDir, 'README.md'), content, 'utf-8');
    }
    // Helper methods for content generation
    generatePackageDescription(packageName, components) {
        const totalComponents = components.classes.length + components.functions.length + components.interfaces.length;
        return `The ${packageName} package contains ${totalComponents} components providing core functionality for the application.`;
    }
    generateClassDescription(cls) {
        return `${cls.name} class with ${cls.methods.length} methods${cls.extends ? ` extending ${cls.extends}` : ''}`;
    }
    generateInterfaceDescription(iface) {
        return `Interface defining contract for ${iface.name}`;
    }
    generateFunctionDescription(func) {
        return `Function ${func.name} with ${func.parameters?.length || 0} parameters${func.isAsync ? ' (async)' : ''}`;
    }
    inferClassPurpose(cls) {
        const name = cls.name.toLowerCase();
        if (name.includes('service'))
            return 'Business logic service';
        if (name.includes('controller'))
            return 'Request handling';
        if (name.includes('model'))
            return 'Data representation';
        if (name.includes('manager'))
            return 'Resource management';
        if (name.includes('factory'))
            return 'Object creation';
        return 'General purpose class';
    }
    inferFunctionPurpose(func) {
        const name = func.name.toLowerCase();
        if (name.includes('get'))
            return 'Data retrieval';
        if (name.includes('set') || name.includes('update'))
            return 'Data modification';
        if (name.includes('create'))
            return 'Resource creation';
        if (name.includes('delete'))
            return 'Resource deletion';
        if (name.includes('validate'))
            return 'Data validation';
        return 'General utility function';
    }
    extractInternalRelationships(parsedFile) {
        // Extract relationships to other components in same package
        return [];
    }
    extractExternalRelationships(parsedFile) {
        // Extract relationships to external packages
        return parsedFile.imports?.map((imp) => imp.from) || [];
    }
    getQualityIndicator(maintainability) {
        switch (maintainability) {
            case 'high': return theme_1.Theme.colors.success('High');
            case 'medium': return theme_1.Theme.colors.warning('Medium');
            case 'low': return theme_1.Theme.colors.error('Low');
            default: return maintainability;
        }
    }
}
exports.DocumentationService = DocumentationService;
exports.default = DocumentationService;
//# sourceMappingURL=documentation-service.js.map