"use strict";
/**
 * Language Parser Interface - Interface Segregation Principle
 * Each language parser implements only what it needs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseLanguageParser = void 0;
/**
 * Base parser with common functionality
 * Follows Template Method pattern
 */
class BaseLanguageParser {
    canParse(filePath) {
        const ext = this.getFileExtension(filePath);
        return this.getSupportedExtensions().includes(ext);
    }
    getFileExtension(filePath) {
        return filePath.split('.').pop()?.toLowerCase() || '';
    }
    createBaseStructure(filePath, language) {
        return {
            filePath,
            language,
            imports: [],
            exports: [],
            classes: [],
            functions: [],
            interfaces: [],
            variables: [],
            dependencies: []
        };
    }
}
exports.BaseLanguageParser = BaseLanguageParser;
//# sourceMappingURL=ilanguage-parser.js.map