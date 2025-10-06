"use strict";
/**
 * Java Parser using Regex-based parsing
 * Single Responsibility: Parse Java files only
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaParser = void 0;
const ILanguageParser_1 = require("./ILanguageParser");
class JavaParser extends ILanguageParser_1.BaseLanguageParser {
    async parse(content, filePath) {
        const structure = this.createBaseStructure(filePath, 'java');
        try {
            await this.parseWithRegex(content, structure);
        }
        catch (error) {
            console.warn(`Failed to parse Java file ${filePath}: ${error.message}`);
        }
        return structure;
    }
    getSupportedExtensions() {
        return ['java'];
    }
    async parseWithRegex(content, structure) {
        // Remove comments to avoid false matches
        const cleanContent = this.removeComments(content);
        // Parse package declaration
        this.parsePackage(cleanContent, structure);
        // Parse imports
        this.parseImports(cleanContent, structure);
        // Parse classes and interfaces
        this.parseClassesAndInterfaces(cleanContent, structure);
        // Parse methods
        this.parseMethods(cleanContent, structure);
    }
    removeComments(content) {
        // Remove single-line comments
        content = content.replace(/\/\/.*$/gm, '');
        // Remove multi-line comments
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        return content;
    }
    parsePackage(content, structure) {
        const packageMatch = content.match(/package\s+([\w.]+);/);
        if (packageMatch) {
            // Store package info for relationship building
            structure.variables.push(`package:${packageMatch[1]}`);
        }
    }
    parseImports(content, structure) {
        const importRegex = /import\s+(?:static\s+)?([\w.*]+);/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            const importName = importPath.split('.').pop() || importPath;
            structure.imports.push({
                name: importName,
                from: importPath,
                isDefault: false
            });
            // External dependencies (non-standard library)
            if (!importPath.startsWith('java.') && !importPath.startsWith('javax.')) {
                structure.dependencies.push(importPath);
            }
        }
    }
    parseClassesAndInterfaces(content, structure) {
        // Parse classes
        const classRegex = /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{/g;
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            const className = match[1];
            const extendsClass = match[2];
            const implementsString = match[3];
            const classInfo = {
                name: className,
                methods: [],
                properties: [],
                extends: extendsClass,
                implements: implementsString ? implementsString.split(',').map(i => i.trim()) : undefined
            };
            // Find methods and fields in this class
            this.parseClassMembers(content, className, classInfo);
            structure.classes.push(classInfo);
        }
        // Parse interfaces
        const interfaceRegex = /(?:public\s+|private\s+|protected\s+)?interface\s+(\w+)(?:\s+extends\s+([\w,\s]+))?\s*\{/g;
        while ((match = interfaceRegex.exec(content)) !== null) {
            const interfaceName = match[1];
            structure.interfaces.push(interfaceName);
        }
    }
    parseClassMembers(content, className, classInfo) {
        // This is a simplified approach - find class block and parse its contents
        const classPattern = new RegExp(`class\\s+${className}\\s*(?:extends\\s+\\w+)?(?:\\s+implements\\s+[\\w,\\s]+)?\\s*\\{`, 'g');
        const classMatch = classPattern.exec(content);
        if (!classMatch)
            return;
        const classStart = classMatch.index + classMatch[0].length;
        const classEnd = this.findMatchingBrace(content, classStart - 1);
        const classBody = content.substring(classStart, classEnd);
        // Parse methods in class body
        const methodRegex = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:abstract\s+)?(?:final\s+)?[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*[{;]/g;
        let methodMatch;
        while ((methodMatch = methodRegex.exec(classBody)) !== null) {
            const methodName = methodMatch[1];
            if (methodName !== className) { // Exclude constructors
                classInfo.methods.push(methodName);
            }
        }
        // Parse fields
        const fieldRegex = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?[\w<>\[\]]+\s+(\w+)\s*[=;]/g;
        let fieldMatch;
        while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
            const fieldName = fieldMatch[1];
            classInfo.properties.push(fieldName);
        }
    }
    parseMethods(content, structure) {
        // Parse standalone methods (though Java doesn't really have these outside classes)
        const methodRegex = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g;
        let match;
        while ((match = methodRegex.exec(content)) !== null) {
            const methodName = match[1];
            const paramString = match[2];
            // Skip if this is likely a class name (starts with capital letter and has no params)
            if (/^[A-Z]/.test(methodName) && !paramString.trim()) {
                continue;
            }
            const parameters = [];
            if (paramString.trim()) {
                const params = paramString.split(',');
                for (const param of params) {
                    const paramParts = param.trim().split(/\s+/);
                    if (paramParts.length >= 2) {
                        parameters.push(paramParts[paramParts.length - 1]); // Last part is parameter name
                    }
                }
            }
            const functionInfo = {
                name: methodName,
                parameters,
                isAsync: false, // Java doesn't have native async functions
                isExported: content.includes(`public`) && content.includes(methodName)
            };
            structure.functions.push(functionInfo);
        }
    }
    findMatchingBrace(content, startIndex) {
        let braceCount = 1;
        let index = startIndex + 1;
        while (index < content.length && braceCount > 0) {
            if (content[index] === '{') {
                braceCount++;
            }
            else if (content[index] === '}') {
                braceCount--;
            }
            index++;
        }
        return index - 1;
    }
}
exports.JavaParser = JavaParser;
//# sourceMappingURL=JavaParser.js.map