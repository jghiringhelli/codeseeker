"use strict";
/**
 * TypeScript/JavaScript Parser using Babel AST
 * Single Responsibility: Parse TS/JS files only
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScriptParser = void 0;
const parser = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
const ilanguage_parser_1 = require("./ilanguage-parser");
class TypeScriptParser extends ilanguage_parser_1.BaseLanguageParser {
    async parse(content, filePath) {
        const structure = this.createBaseStructure(filePath, this.detectLanguage(filePath));
        try {
            const ast = parser.parse(content, {
                sourceType: 'module',
                plugins: [
                    'typescript',
                    'jsx',
                    'decorators-legacy',
                    'classProperties',
                    'objectRestSpread',
                    'asyncGenerators',
                    'functionBind',
                    'exportDefaultFrom',
                    'exportNamespaceFrom',
                    'dynamicImport'
                ]
            });
            this.extractStructure(ast, structure);
        }
        catch (error) {
            console.warn(`Failed to parse ${filePath}: ${error.message}`);
            // Return basic structure even if parsing fails
        }
        return structure;
    }
    getSupportedExtensions() {
        return ['ts', 'tsx', 'js', 'jsx'];
    }
    detectLanguage(filePath) {
        const ext = this.getFileExtension(filePath);
        return ext.startsWith('ts') ? 'typescript' : 'javascript';
    }
    extractStructure(ast, structure) {
        (0, traverse_1.default)(ast, {
            // Extract imports
            ImportDeclaration: (path) => {
                this.extractImports(path.node, structure);
            },
            // Extract exports
            ExportNamedDeclaration: (path) => {
                this.extractNamedExports(path.node, structure);
            },
            ExportDefaultDeclaration: (path) => {
                this.extractDefaultExport(path.node, structure);
            },
            // Extract classes
            ClassDeclaration: (path) => {
                this.extractClass(path.node, structure);
            },
            // Extract functions
            FunctionDeclaration: (path) => {
                this.extractFunction(path.node, structure);
            },
            // Extract arrow functions assigned to variables
            VariableDeclarator: (path) => {
                if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
                    this.extractFunctionFromVariable(path.node, structure);
                }
            },
            // Extract interfaces
            TSInterfaceDeclaration: (path) => {
                if (path.node.id?.name) {
                    structure.interfaces.push(path.node.id.name);
                }
            }
        });
    }
    extractImports(node, structure) {
        if (!node.source?.value)
            return;
        const from = node.source.value;
        node.specifiers?.forEach((spec) => {
            const importInfo = {
                name: '',
                from,
                isDefault: false
            };
            if (t.isImportDefaultSpecifier(spec)) {
                importInfo.name = spec.local.name;
                importInfo.isDefault = true;
            }
            else if (t.isImportSpecifier(spec)) {
                importInfo.name = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
                importInfo.alias = spec.local.name !== (t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value) ? spec.local.name : undefined;
            }
            else if (t.isImportNamespaceSpecifier(spec)) {
                importInfo.name = '*';
                importInfo.alias = spec.local.name;
            }
            structure.imports.push(importInfo);
            // Add to dependencies if it's a relative import
            if (from.startsWith('./') || from.startsWith('../')) {
                structure.dependencies.push(from);
            }
        });
    }
    extractNamedExports(node, structure) {
        if (node.declaration) {
            // export const, export function, export class, etc.
            this.extractExportFromDeclaration(node.declaration, structure, false);
        }
        else if (node.specifiers) {
            // export { name1, name2 }
            node.specifiers.forEach((spec) => {
                if (t.isExportSpecifier(spec)) {
                    structure.exports.push({
                        name: t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value,
                        isDefault: false,
                        type: 'variable' // Default to variable, could be enhanced
                    });
                }
            });
        }
    }
    extractDefaultExport(node, structure) {
        if (node.declaration) {
            this.extractExportFromDeclaration(node.declaration, structure, true);
        }
    }
    extractExportFromDeclaration(declaration, structure, isDefault) {
        let name = 'default';
        let type = 'variable';
        if (t.isClassDeclaration(declaration) && declaration.id) {
            name = declaration.id.name;
            type = 'class';
        }
        else if (t.isFunctionDeclaration(declaration) && declaration.id) {
            name = declaration.id.name;
            type = 'function';
        }
        else if (t.isVariableDeclaration(declaration)) {
            const declarator = declaration.declarations[0];
            if (t.isIdentifier(declarator.id)) {
                name = declarator.id.name;
                type = 'variable';
            }
        }
        else if (t.isTSInterfaceDeclaration(declaration)) {
            name = declaration.id.name;
            type = 'interface';
        }
        structure.exports.push({
            name,
            isDefault,
            type
        });
    }
    extractClass(node, structure) {
        if (!node.id?.name)
            return;
        const classInfo = {
            name: node.id.name,
            methods: [],
            properties: []
        };
        // Extract extends
        if (node.superClass && t.isIdentifier(node.superClass)) {
            classInfo.extends = node.superClass.name;
        }
        // Extract implements
        if (node.implements) {
            classInfo.implements = node.implements
                .filter((impl) => t.isIdentifier(impl.id))
                .map((impl) => impl.id.name);
        }
        // Extract methods and properties
        node.body.body.forEach((member) => {
            if (t.isClassMethod(member) || (member.type === 'MethodDefinition')) {
                if (t.isIdentifier(member.key)) {
                    classInfo.methods.push(member.key.name);
                }
            }
            else if (t.isClassProperty && t.isClassProperty(member) || (member.type === 'PropertyDefinition')) {
                if (t.isIdentifier(member.key)) {
                    classInfo.properties.push(member.key.name);
                }
            }
        });
        structure.classes.push(classInfo);
    }
    extractFunction(node, structure) {
        if (!node.id?.name)
            return;
        const functionInfo = {
            name: node.id.name,
            parameters: node.params
                .filter((param) => t.isIdentifier(param))
                .map((param) => param.name),
            isAsync: node.async || false,
            isExported: false // Will be determined by export detection
        };
        structure.functions.push(functionInfo);
    }
    extractFunctionFromVariable(node, structure) {
        if (!t.isIdentifier(node.id))
            return;
        const functionInfo = {
            name: node.id.name,
            parameters: node.init?.params
                ?.filter((param) => t.isIdentifier(param))
                ?.map((param) => param.name) || [],
            isAsync: node.init?.async || false,
            isExported: false
        };
        structure.functions.push(functionInfo);
    }
}
exports.TypeScriptParser = TypeScriptParser;
//# sourceMappingURL=typescript-parser.js.map