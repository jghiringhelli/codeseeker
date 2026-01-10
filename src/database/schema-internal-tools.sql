-- Internal Tools Schema for codeseeker
-- Distinguishes between internal analysis tools and external CLI tools

-- ============================================
-- INTERNAL TOOL MANAGEMENT SYSTEM
-- ============================================

-- Internal analysis tools - built-in codeseeker analyzers
CREATE TABLE IF NOT EXISTS internal_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id VARCHAR(100) UNIQUE NOT NULL, -- use-cases-analyzer, compilation-verifier, etc.
  tool_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL CHECK (
    category IN (
      'analysis', 'architecture', 'compilation', 'frontend', 
      'backend', 'testing', 'documentation', 'security'
    )
  ),
  module_path TEXT NOT NULL, -- e.g., 'features/use-cases/analyzer'
  class_name VARCHAR(100) NOT NULL, -- e.g., 'UseCasesAnalyzer'
  methods TEXT[] DEFAULT ARRAY[]::TEXT[], -- available methods
  languages TEXT[] DEFAULT ARRAY[]::TEXT[], -- supported languages
  frameworks TEXT[] DEFAULT ARRAY[]::TEXT[], -- supported frameworks
  purposes TEXT[] DEFAULT ARRAY[]::TEXT[], -- what the tool analyzes
  capabilities JSONB DEFAULT '{}'::jsonb, -- detailed capabilities
  output_format VARCHAR(50) DEFAULT 'json' CHECK (
    output_format IN ('json', 'text', 'mermaid', 'markdown', 'html')
  ),
  performance_impact VARCHAR(20) DEFAULT 'low' CHECK (
    performance_impact IN ('minimal', 'low', 'medium', 'high')
  ),
  token_usage VARCHAR(20) DEFAULT 'medium' CHECK (
    token_usage IN ('minimal', 'low', 'medium', 'high', 'variable')
  ),
  version VARCHAR(50) DEFAULT '1.0.0',
  is_semantic BOOLEAN DEFAULT false, -- uses semantic analysis
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Internal tool executions - track usage and results
CREATE TABLE IF NOT EXISTS internal_tool_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tool_id VARCHAR(100) REFERENCES internal_tools(tool_id) ON DELETE CASCADE,
  execution_type VARCHAR(50) NOT NULL CHECK (
    execution_type IN ('analysis', 'validation', 'generation', 'transformation')
  ),
  input_params JSONB NOT NULL,
  output_result JSONB,
  mermaid_diagrams JSONB, -- Store any generated Mermaid diagrams
  execution_time_ms INTEGER,
  token_count INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  insights JSONB, -- Key insights from the analysis
  recommendations TEXT[], -- Specific recommendations generated
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool combinations - track which tools work well together
CREATE TABLE IF NOT EXISTS tool_combinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  primary_tool VARCHAR(100) NOT NULL,
  secondary_tool VARCHAR(100) NOT NULL,
  tool_type VARCHAR(20) NOT NULL CHECK (
    tool_type IN ('internal', 'external', 'mixed')
  ),
  use_case TEXT NOT NULL,
  effectiveness_score DECIMAL(3,2), -- 0.00 to 1.00
  typical_workflow JSONB,
  prerequisites TEXT[],
  recommended_order INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(primary_tool, secondary_tool, use_case)
);

-- Insert our restored internal tools
INSERT INTO internal_tools (
  tool_id, tool_name, description, category, module_path, class_name,
  methods, languages, frameworks, purposes, capabilities, output_format,
  performance_impact, token_usage, version, is_semantic, is_active
) VALUES 
(
  'use-cases-analyzer',
  'Use Cases Analyzer',
  'Analyzes business logic and maps use cases to code implementation',
  'analysis',
  'features/use-cases/analyzer',
  'UseCasesAnalyzer',
  ARRAY['analyzeUseCases', 'discoverUseCases', 'analyzeBusinessLogic'],
  ARRAY['javascript', 'typescript', 'python'],
  ARRAY['any'],
  ARRAY['business-logic', 'use-case-mapping', 'architecture-analysis'],
  '{"extractsFromDocs": true, "infersFromAPI": true, "analyzesCode": true}'::jsonb,
  'json',
  'medium',
  'medium',
  '1.0.0',
  true,
  true
),
(
  'compilation-verifier',
  'Compilation Verifier',
  'Verifies code changes compile successfully before suggesting modifications',
  'compilation',
  'features/compilation/verifier',
  'CompilationVerifier',
  ARRAY['verifyCompilation', 'runTypeCheck', 'runCompilation', 'runLinting'],
  ARRAY['javascript', 'typescript', 'python'],
  ARRAY['react', 'vue', 'angular', 'node', 'django', 'flask'],
  ARRAY['compilation', 'build-verification', 'safety-check'],
  '{"multiStageVerification": true, "frameworkDetection": true, "errorAnalysis": true}'::jsonb,
  'json',
  'high',
  'low',
  '1.0.0',
  false,
  true
),
(
  'ui-navigation-analyzer',
  'UI Navigation Analyzer',
  'Analyzes frontend components and navigation flows with Mermaid diagram generation',
  'frontend',
  'features/ui-navigation/analyzer',
  'UINavigationAnalyzer',
  ARRAY['analyzeUI', 'findUIComponents', 'analyzeNavigationFlows', 'generateMermaidDiagrams'],
  ARRAY['javascript', 'typescript'],
  ARRAY['react', 'vue', 'angular', 'svelte', 'nextjs'],
  ARRAY['ui-analysis', 'navigation-flow', 'component-analysis', 'ux-insights'],
  '{"mermaidGeneration": true, "componentMapping": true, "flowAnalysis": true}'::jsonb,
  'mermaid',
  'low',
  'medium',
  '2.0.0',
  true,
  true
),
(
  'solid-principles-analyzer',
  'SOLID Principles Analyzer',
  'Analyzes code adherence to SOLID principles for architectural guidance',
  'architecture',
  'features/solid-principles/analyzer',
  'SOLIDPrinciplesAnalyzer',
  ARRAY['analyzeSOLID', 'findViolations', 'calculatePrincipleScores'],
  ARRAY['javascript', 'typescript', 'python'],
  ARRAY['any'],
  ARRAY['architecture-analysis', 'code-quality', 'design-patterns'],
  '{"detectsViolations": true, "providesRefactoring": true, "scoresCompliance": true}'::jsonb,
  'json',
  'medium',
  'high',
  '1.0.0',
  true,
  true
),
(
  'enhanced-tree-navigator',
  'Enhanced Tree Navigator',
  'Tree navigation with semantic analysis for deep code understanding',
  'analysis',
  'features/tree-navigation/navigator',
  'TreeNavigator',
  ARRAY['analyze', 'buildDependencyTree', 'enhanceWithSemanticAnalysis'],
  ARRAY['javascript', 'typescript', 'python', 'go', 'rust', 'java'],
  ARRAY['any'],
  ARRAY['dependency-analysis', 'semantic-analysis', 'code-navigation'],
  '{"semanticClustering": true, "similarityDetection": true, "interactiveMode": true}'::jsonb,
  'json',
  'low',
  'variable',
  '2.0.0',
  true,
  true
)
ON CONFLICT (tool_id) DO UPDATE SET
  description = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities,
  version = EXCLUDED.version,
  updated_at = NOW();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_internal_tools_category ON internal_tools(category);
CREATE INDEX IF NOT EXISTS idx_internal_tools_active ON internal_tools(is_active);
CREATE INDEX IF NOT EXISTS idx_internal_tool_executions_project ON internal_tool_executions(project_id);
CREATE INDEX IF NOT EXISTS idx_internal_tool_executions_tool ON internal_tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_combinations_primary ON tool_combinations(primary_tool);
CREATE INDEX IF NOT EXISTS idx_tool_combinations_secondary ON tool_combinations(secondary_tool);

-- Update external_tools table comment to clarify its purpose
COMMENT ON TABLE external_tools IS 'External CLI tools that can be downloaded and executed (eslint, pytest, etc.)';
COMMENT ON TABLE internal_tools IS 'Built-in codeseeker analysis tools for code understanding and insights';