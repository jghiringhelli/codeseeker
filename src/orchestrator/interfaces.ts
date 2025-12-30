/**
 * Tool Database API Interfaces
 * SOLID Principles: Interface Segregation
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// Service Interfaces (SOLID: Interface Segregation)
export interface IToolDataService {
  saveToolData(projectId: string, toolName: string, data: any): Promise<any>;
  getToolData(projectId: string, toolName: string): Promise<any>;
  deleteToolData(projectId: string, toolName: string): Promise<void>;
}

export interface ISemanticSearchService {
  getSemanticSearchData(projectId: string, filters?: any): Promise<any[]>;
  saveSemanticSearchData(projectId: string, data: any[]): Promise<any>;
  deleteSemanticSearchData(projectId: string): Promise<void>;
  saveSemanticSearch(projectId: string, data: any[]): Promise<any>;
  getSemanticSearch(projectId: string, filters?: any): Promise<any[]>;
}

export interface ITreeNavigationService {
  saveTreeNavigation(projectId: string, data: any[]): Promise<any>;
  getTreeNavigation(projectId: string, filters?: any): Promise<any[]>;
  deleteTreeNavigation(projectId: string): Promise<void>;
}

export interface ICodeDuplicationsService {
  saveDuplications(projectId: string, data: any[]): Promise<any>;
  getDuplications(projectId: string, filters?: any): Promise<any[]>;
  deleteDuplications(projectId: string): Promise<void>;
}

export interface ICentralizationService {
  saveCentralization(projectId: string, data: any[]): Promise<any>;
  getCentralization(projectId: string, filters?: any): Promise<any[]>;
  deleteCentralization(projectId: string): Promise<void>;
}

export interface ITestCoverageService {
  saveTestCoverage(projectId: string, data: any[]): Promise<any>;
  getTestCoverage(projectId: string, filters?: any): Promise<any[]>;
  deleteTestCoverage(projectId: string): Promise<void>;
}

export interface ICompilationService {
  saveCompilation(projectId: string, data: any[]): Promise<any>;
  getCompilation(projectId: string, filters?: any): Promise<any[]>;
  deleteCompilation(projectId: string): Promise<void>;
}

export interface ISOLIDViolationsService {
  saveSOLIDViolations(projectId: string, data: any[]): Promise<any>;
  getSOLIDViolations(projectId: string, filters?: any): Promise<any[]>;
  deleteSOLIDViolations(projectId: string): Promise<void>;
}

export interface IDatabaseConnection {
  initialize(): Promise<void>;
  query(text: string, params?: any[]): Promise<any>;
  close(): Promise<void>;
}