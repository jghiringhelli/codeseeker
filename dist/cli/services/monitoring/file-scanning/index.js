"use strict";
/**
 * File Scanner Module - Barrel Export
 * Clean exports following SOLID principles
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTypeDetector = exports.ConfigurableExclusionFilter = exports.DirectoryScanner = exports.ProjectFileScanner = void 0;
// Main scanner facade
var project_file_scanner_1 = require("./project-file-scanner");
Object.defineProperty(exports, "ProjectFileScanner", { enumerable: true, get: function () { return project_file_scanner_1.ProjectFileScanner; } });
// Core interfaces (Interface Segregation)
__exportStar(require("./file-scanner-interfaces"), exports);
// Concrete implementations
var directory_scanner_1 = require("./directory-scanner");
Object.defineProperty(exports, "DirectoryScanner", { enumerable: true, get: function () { return directory_scanner_1.DirectoryScanner; } });
var configurable_exclusion_filter_1 = require("./configurable-exclusion-filter");
Object.defineProperty(exports, "ConfigurableExclusionFilter", { enumerable: true, get: function () { return configurable_exclusion_filter_1.ConfigurableExclusionFilter; } });
var file_type_detector_1 = require("./file-type-detector");
Object.defineProperty(exports, "FileTypeDetector", { enumerable: true, get: function () { return file_type_detector_1.FileTypeDetector; } });
//# sourceMappingURL=index.js.map