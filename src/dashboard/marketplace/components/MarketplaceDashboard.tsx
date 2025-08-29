import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Star, 
  Download, 
  TrendingUp, 
  DollarSign, 
  Zap,
  Brain,
  Filter,
  Grid,
  List,
  ChevronRight
} from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  rating: number;
  downloads: number;
  tokenSavings: number;
  price: number;
  author: string;
  tags: string[];
  intelligence: {
    hasAISelection: boolean;
    avgTokenSavings: number;
    avgRelevance: number;
    executionSpeed: string;
  };
  screenshots: string[];
  lastUpdated: string;
  isInstalled?: boolean;
  isFeatured?: boolean;
}

interface MarketplaceStats {
  totalPlugins: number;
  totalDownloads: number;
  tokensSavedToday: number;
  activeDevelopers: number;
}

const MarketplaceDashboard: React.FC = () => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState({
    intelligentOnly: false,
    freeOnly: false,
    minRating: 0
  });
  const [marketplaceStats, setMarketplaceStats] = useState<MarketplaceStats>({
    totalPlugins: 47,
    totalDownloads: 125000,
    tokensSavedToday: 2800000,
    activeDevelopers: 12500
  });

  const categories = [
    { id: 'all', name: 'All Categories', count: 47 },
    { id: 'code-analysis', name: 'Code Analysis', count: 12 },
    { id: 'security', name: 'Security', count: 8 },
    { id: 'performance', name: 'Performance', count: 6 },
    { id: 'documentation', name: 'Documentation', count: 4 },
    { id: 'testing', name: 'Testing', count: 7 },
    { id: 'deployment', name: 'Deployment', count: 5 },
    { id: 'monitoring', name: 'Monitoring', count: 5 }
  ];

  const featuredPlugins: Plugin[] = [
    {
      id: 'smart-codebase-analyst',
      name: 'Smart Codebase Analyst',
      description: 'AI-powered codebase analysis with 89% token savings through intelligent tool selection',
      version: '2.1.0',
      category: 'code-analysis',
      rating: 4.9,
      downloads: 12500,
      tokenSavings: 89,
      price: 19,
      author: 'CodeMind Team',
      tags: ['AI-powered', 'Code Quality', 'Token Optimization'],
      intelligence: {
        hasAISelection: true,
        avgTokenSavings: 89,
        avgRelevance: 94.2,
        executionSpeed: '2.3s avg'
      },
      screenshots: ['/screenshots/smart-analyst-1.png'],
      lastUpdated: '2024-01-15',
      isFeatured: true,
      isInstalled: false
    },
    {
      id: 'intelligent-security-scanner',
      name: 'Intelligent Security Scanner',
      description: 'Smart security analysis with AI-powered vulnerability prioritization and 82% token savings',
      version: '1.8.3',
      category: 'security',
      rating: 4.7,
      downloads: 8200,
      tokenSavings: 82,
      price: 29,
      author: 'SecureDev Inc',
      tags: ['Security', 'Vulnerability Scanning', 'AI-powered'],
      intelligence: {
        hasAISelection: true,
        avgTokenSavings: 82,
        avgRelevance: 91.7,
        executionSpeed: '3.1s avg'
      },
      screenshots: ['/screenshots/security-scanner-1.png'],
      lastUpdated: '2024-01-12',
      isFeatured: true,
      isInstalled: true
    },
    {
      id: 'adaptive-performance-analyzer',
      name: 'Adaptive Performance Analyzer',
      description: 'Performance analysis with intelligent bottleneck detection and optimization suggestions',
      version: '1.5.2',
      category: 'performance',
      rating: 4.6,
      downloads: 5800,
      tokenSavings: 79,
      price: 24,
      author: 'PerfOpt Labs',
      tags: ['Performance', 'Optimization', 'Bottleneck Detection'],
      intelligence: {
        hasAISelection: true,
        avgTokenSavings: 79,
        avgRelevance: 88.3,
        executionSpeed: '4.2s avg'
      },
      screenshots: ['/screenshots/perf-analyzer-1.png'],
      lastUpdated: '2024-01-10',
      isFeatured: true,
      isInstalled: false
    }
  ];

  useEffect(() => {
    setPlugins(featuredPlugins);
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // TODO: Implement actual search logic with API
  };

  const handleInstall = async (pluginId: string) => {
    // TODO: Implement actual installation logic
    console.log(`Installing plugin: ${pluginId}`);
    
    // Simulate installation
    setPlugins(plugins.map(plugin => 
      plugin.id === pluginId 
        ? { ...plugin, isInstalled: true }
        : plugin
    ));
  };

  const filteredPlugins = plugins.filter(plugin => {
    if (searchQuery && !plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !plugin.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    if (selectedCategory !== 'all' && plugin.category !== selectedCategory) {
      return false;
    }
    
    if (filters.intelligentOnly && !plugin.intelligence.hasAISelection) {
      return false;
    }
    
    if (filters.freeOnly && plugin.price > 0) {
      return false;
    }
    
    if (plugin.rating < filters.minRating) {
      return false;
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">MCP Plugin Marketplace</h1>
                <p className="mt-2 text-gray-600">
                  Discover intelligent MCP tools that save 70-90% tokens while improving results
                </p>
              </div>
              
              {/* Quick Stats */}
              <div className="hidden lg:flex space-x-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{marketplaceStats.totalPlugins}</div>
                  <div className="text-sm text-gray-500">Smart Plugins</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(marketplaceStats.tokensSavedToday / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-sm text-gray-500">Tokens Saved Today</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {(marketplaceStats.activeDevelopers / 1000).toFixed(1)}K
                  </div>
                  <div className="text-sm text-gray-500">Happy Developers</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar - Filters and Categories */}
          <div className="lg:w-64 space-y-6">
            
            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Describe what you want to analyze..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500">
                💡 Try: "analyze security", "optimize performance"
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-medium text-gray-900 mb-3">Categories</h3>
              <div className="space-y-1">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between hover:bg-gray-50 ${
                      selectedCategory === category.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <span>{category.name}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                      {category.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-medium text-gray-900 mb-3">Filters</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.intelligentOnly}
                    onChange={(e) => setFilters({...filters, intelligentOnly: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    AI-Powered Only
                    <Brain className="inline w-4 h-4 ml-1 text-blue-500" />
                  </span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.freeOnly}
                    onChange={(e) => setFilters({...filters, freeOnly: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Free Plugins Only</span>
                </label>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Minimum Rating</label>
                  <select
                    value={filters.minRating}
                    onChange={(e) => setFilters({...filters, minRating: Number(e.target.value)})}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                  >
                    <option value={0}>Any Rating</option>
                    <option value={3}>3+ Stars</option>
                    <option value={4}>4+ Stars</option>
                    <option value={4.5}>4.5+ Stars</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            
            {/* Controls */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  {selectedCategory === 'all' ? 'All Plugins' : `${categories.find(c => c.id === selectedCategory)?.name} Plugins`}
                </h2>
                <p className="text-sm text-gray-500">{filteredPlugins.length} plugins found</p>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border border-gray-200 rounded px-3 py-2"
                >
                  <option value="relevance">Sort by Relevance</option>
                  <option value="rating">Sort by Rating</option>
                  <option value="downloads">Sort by Downloads</option>
                  <option value="savings">Sort by Token Savings</option>
                  <option value="newest">Sort by Newest</option>
                </select>
                
                {/* View Mode */}
                <div className="flex border border-gray-200 rounded-md">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 border-l ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Featured Section */}
            {selectedCategory === 'all' && !searchQuery && (
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Star className="w-5 h-5 text-yellow-400 mr-2" />
                  Featured Plugins
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredPlugins.slice(0, 3).map(plugin => (
                    <PluginCard key={plugin.id} plugin={plugin} onInstall={handleInstall} featured />
                  ))}
                </div>
              </div>
            )}

            {/* Plugin Grid/List */}
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
              : 'space-y-4'
            }>
              {filteredPlugins.map(plugin => (
                <PluginCard 
                  key={plugin.id} 
                  plugin={plugin} 
                  onInstall={handleInstall}
                  listView={viewMode === 'list'}
                />
              ))}
            </div>

            {/* Empty State */}
            {filteredPlugins.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Search className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No plugins found</h3>
                <p className="text-gray-500">
                  Try adjusting your search terms or filters
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PluginCardProps {
  plugin: Plugin;
  onInstall: (pluginId: string) => void;
  featured?: boolean;
  listView?: boolean;
}

const PluginCard: React.FC<PluginCardProps> = ({ plugin, onInstall, featured = false, listView = false }) => {
  if (listView) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-medium text-gray-900 truncate">{plugin.name}</h3>
              {plugin.intelligence.hasAISelection && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <Brain className="w-3 h-3 mr-1" />
                  SMART
                </span>
              )}
              {plugin.price === 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  FREE
                </span>
              )}
            </div>
            
            <p className="text-gray-600 mb-3 line-clamp-2">{plugin.description}</p>
            
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center">
                <Star className="w-4 h-4 text-yellow-400 mr-1" />
                {plugin.rating} ({plugin.downloads.toLocaleString()} downloads)
              </div>
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 text-green-500 mr-1" />
                {plugin.tokenSavings}% savings
              </div>
              <div className="flex items-center">
                <Zap className="w-4 h-4 text-blue-500 mr-1" />
                {plugin.intelligence.executionSpeed}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 ml-6">
            <div className="text-right">
              {plugin.price > 0 ? (
                <div className="text-lg font-bold text-gray-900">${plugin.price}/mo</div>
              ) : (
                <div className="text-lg font-bold text-green-600">Free</div>
              )}
            </div>
            
            <button
              onClick={() => onInstall(plugin.id)}
              disabled={plugin.isInstalled}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                plugin.isInstalled
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {plugin.isInstalled ? 'Installed' : 'Install'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow ${
      featured ? 'ring-2 ring-yellow-200' : ''
    }`}>
      {featured && (
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-3 py-1 text-xs font-medium rounded-t-lg">
          ⭐ Featured Plugin
        </div>
      )}
      
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 mb-1 truncate">{plugin.name}</h3>
            <div className="flex items-center space-x-2 mb-2">
              {plugin.intelligence.hasAISelection && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <Brain className="w-3 h-3 mr-1" />
                  SMART
                </span>
              )}
              {plugin.price === 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  FREE
                </span>
              )}
            </div>
          </div>
          
          <div className="text-right ml-4">
            {plugin.price > 0 ? (
              <div className="text-lg font-bold text-gray-900">${plugin.price}/mo</div>
            ) : (
              <div className="text-lg font-bold text-green-600">Free</div>
            )}
          </div>
        </div>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">{plugin.description}</p>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Token Savings</span>
            <span className="font-medium text-green-600">{plugin.tokenSavings}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Avg Relevance</span>
            <span className="font-medium text-blue-600">{plugin.intelligence.avgRelevance}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Speed</span>
            <span className="font-medium text-purple-600">{plugin.intelligence.executionSpeed}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 mb-4 text-sm text-gray-500">
          <div className="flex items-center">
            <Star className="w-4 h-4 text-yellow-400 mr-1" />
            {plugin.rating}
          </div>
          <div className="flex items-center">
            <Download className="w-4 h-4 mr-1" />
            {(plugin.downloads / 1000).toFixed(1)}K
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => onInstall(plugin.id)}
            disabled={plugin.isInstalled}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              plugin.isInstalled
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {plugin.isInstalled ? 'Installed' : 'Install'}
          </button>
          <button className="px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceDashboard;