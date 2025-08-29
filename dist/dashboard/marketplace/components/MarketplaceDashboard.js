"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const MarketplaceDashboard = () => {
    const [plugins, setPlugins] = (0, react_1.useState)([]);
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    const [selectedCategory, setSelectedCategory] = (0, react_1.useState)('all');
    const [sortBy, setSortBy] = (0, react_1.useState)('relevance');
    const [viewMode, setViewMode] = (0, react_1.useState)('grid');
    const [filters, setFilters] = (0, react_1.useState)({
        intelligentOnly: false,
        freeOnly: false,
        minRating: 0
    });
    const [marketplaceStats, setMarketplaceStats] = (0, react_1.useState)({
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
    const featuredPlugins = [
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
    (0, react_1.useEffect)(() => {
        setPlugins(featuredPlugins);
    }, []);
    const handleSearch = (query) => {
        setSearchQuery(query);
        // TODO: Implement actual search logic with API
    };
    const handleInstall = async (pluginId) => {
        // TODO: Implement actual installation logic
        console.log(`Installing plugin: ${pluginId}`);
        // Simulate installation
        setPlugins(plugins.map(plugin => plugin.id === pluginId
            ? { ...plugin, isInstalled: true }
            : plugin));
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-gray-50", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-white shadow-sm border-b", children: (0, jsx_runtime_1.jsx)("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: (0, jsx_runtime_1.jsx)("div", { className: "py-6", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900", children: "MCP Plugin Marketplace" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-gray-600", children: "Discover intelligent MCP tools that save 70-90% tokens while improving results" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "hidden lg:flex space-x-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-blue-600", children: marketplaceStats.totalPlugins }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500", children: "Smart Plugins" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-2xl font-bold text-green-600", children: [(marketplaceStats.tokensSavedToday / 1000000).toFixed(1), "M"] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500", children: "Tokens Saved Today" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-2xl font-bold text-purple-600", children: [(marketplaceStats.activeDevelopers / 1000).toFixed(1), "K"] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500", children: "Happy Developers" })] })] })] }) }) }) }), (0, jsx_runtime_1.jsx)("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col lg:flex-row gap-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "lg:w-64 space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Describe what you want to analyze...", className: "w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent", value: searchQuery, onChange: (e) => handleSearch(e.target.value) })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 text-xs text-gray-500", children: "\uD83D\uDCA1 Try: \"analyze security\", \"optimize performance\"" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border p-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-medium text-gray-900 mb-3", children: "Categories" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-1", children: categories.map(category => ((0, jsx_runtime_1.jsxs)("button", { onClick: () => setSelectedCategory(category.id), className: `w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between hover:bg-gray-50 ${selectedCategory === category.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`, children: [(0, jsx_runtime_1.jsx)("span", { children: category.name }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs bg-gray-100 px-2 py-1 rounded-full", children: category.count })] }, category.id))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border p-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-medium text-gray-900 mb-3", children: "Filters" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: filters.intelligentOnly, onChange: (e) => setFilters({ ...filters, intelligentOnly: e.target.checked }), className: "rounded border-gray-300 text-blue-600 focus:ring-blue-500" }), (0, jsx_runtime_1.jsxs)("span", { className: "ml-2 text-sm text-gray-700", children: ["AI-Powered Only", (0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "inline w-4 h-4 ml-1 text-blue-500" })] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: filters.freeOnly, onChange: (e) => setFilters({ ...filters, freeOnly: e.target.checked }), className: "rounded border-gray-300 text-blue-600 focus:ring-blue-500" }), (0, jsx_runtime_1.jsx)("span", { className: "ml-2 text-sm text-gray-700", children: "Free Plugins Only" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm text-gray-700 mb-1", children: "Minimum Rating" }), (0, jsx_runtime_1.jsxs)("select", { value: filters.minRating, onChange: (e) => setFilters({ ...filters, minRating: Number(e.target.value) }), className: "w-full text-sm border border-gray-200 rounded px-2 py-1", children: [(0, jsx_runtime_1.jsx)("option", { value: 0, children: "Any Rating" }), (0, jsx_runtime_1.jsx)("option", { value: 3, children: "3+ Stars" }), (0, jsx_runtime_1.jsx)("option", { value: 4, children: "4+ Stars" }), (0, jsx_runtime_1.jsx)("option", { value: 4.5, children: "4.5+ Stars" })] })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-medium text-gray-900", children: selectedCategory === 'all' ? 'All Plugins' : `${categories.find(c => c.id === selectedCategory)?.name} Plugins` }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-gray-500", children: [filteredPlugins.length, " plugins found"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [(0, jsx_runtime_1.jsxs)("select", { value: sortBy, onChange: (e) => setSortBy(e.target.value), className: "text-sm border border-gray-200 rounded px-3 py-2", children: [(0, jsx_runtime_1.jsx)("option", { value: "relevance", children: "Sort by Relevance" }), (0, jsx_runtime_1.jsx)("option", { value: "rating", children: "Sort by Rating" }), (0, jsx_runtime_1.jsx)("option", { value: "downloads", children: "Sort by Downloads" }), (0, jsx_runtime_1.jsx)("option", { value: "savings", children: "Sort by Token Savings" }), (0, jsx_runtime_1.jsx)("option", { value: "newest", children: "Sort by Newest" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex border border-gray-200 rounded-md", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => setViewMode('grid'), className: `p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Grid, { className: "w-4 h-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setViewMode('list'), className: `p-2 border-l ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`, children: (0, jsx_runtime_1.jsx)(lucide_react_1.List, { className: "w-4 h-4" }) })] })] })] }), selectedCategory === 'all' && !searchQuery && ((0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-lg font-medium text-gray-900 mb-4 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Star, { className: "w-5 h-5 text-yellow-400 mr-2" }), "Featured Plugins"] }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: featuredPlugins.slice(0, 3).map(plugin => ((0, jsx_runtime_1.jsx)(PluginCard, { plugin: plugin, onInstall: handleInstall, featured: true }, plugin.id))) })] })), (0, jsx_runtime_1.jsx)("div", { className: viewMode === 'grid'
                                        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                                        : 'space-y-4', children: filteredPlugins.map(plugin => ((0, jsx_runtime_1.jsx)(PluginCard, { plugin: plugin, onInstall: handleInstall, listView: viewMode === 'list' }, plugin.id))) }), filteredPlugins.length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-12", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-gray-400 mb-4", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "w-16 h-16 mx-auto" }) }), (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "No plugins found" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-500", children: "Try adjusting your search terms or filters" })] }))] })] }) })] }));
};
const PluginCard = ({ plugin, onInstall, featured = false, listView = false }) => {
    if (listView) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1 min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3 mb-2", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-medium text-gray-900 truncate", children: plugin.name }), plugin.intelligence.hasAISelection && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "w-3 h-3 mr-1" }), "SMART"] })), plugin.price === 0 && ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800", children: "FREE" }))] }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-3 line-clamp-2", children: plugin.description }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-6 text-sm text-gray-500", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Star, { className: "w-4 h-4 text-yellow-400 mr-1" }), plugin.rating, " (", plugin.downloads.toLocaleString(), " downloads)"] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.DollarSign, { className: "w-4 h-4 text-green-500 mr-1" }), plugin.tokenSavings, "% savings"] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Zap, { className: "w-4 h-4 text-blue-500 mr-1" }), plugin.intelligence.executionSpeed] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3 ml-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-right", children: plugin.price > 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-lg font-bold text-gray-900", children: ["$", plugin.price, "/mo"] })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-lg font-bold text-green-600", children: "Free" })) }), (0, jsx_runtime_1.jsx)("button", { onClick: () => onInstall(plugin.id), disabled: plugin.isInstalled, className: `px-4 py-2 rounded-lg font-medium transition-colors ${plugin.isInstalled
                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'}`, children: plugin.isInstalled ? 'Installed' : 'Install' })] })] }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: `bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow ${featured ? 'ring-2 ring-yellow-200' : ''}`, children: [featured && ((0, jsx_runtime_1.jsx)("div", { className: "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-3 py-1 text-xs font-medium rounded-t-lg", children: "\u2B50 Featured Plugin" })), (0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1 min-w-0", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-medium text-gray-900 mb-1 truncate", children: plugin.name }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2 mb-2", children: [plugin.intelligence.hasAISelection && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "w-3 h-3 mr-1" }), "SMART"] })), plugin.price === 0 && ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800", children: "FREE" }))] })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-right ml-4", children: plugin.price > 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-lg font-bold text-gray-900", children: ["$", plugin.price, "/mo"] })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-lg font-bold text-green-600", children: "Free" })) })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 text-sm mb-4 line-clamp-3", children: plugin.description }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-500", children: "Token Savings" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium text-green-600", children: [plugin.tokenSavings, "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-500", children: "Avg Relevance" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium text-blue-600", children: [plugin.intelligence.avgRelevance, "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-500", children: "Speed" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-purple-600", children: plugin.intelligence.executionSpeed })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4 mb-4 text-sm text-gray-500", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Star, { className: "w-4 h-4 text-yellow-400 mr-1" }), plugin.rating] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "w-4 h-4 mr-1" }), (plugin.downloads / 1000).toFixed(1), "K"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => onInstall(plugin.id), disabled: plugin.isInstalled, className: `flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${plugin.isInstalled
                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'}`, children: plugin.isInstalled ? 'Installed' : 'Install' }), (0, jsx_runtime_1.jsx)("button", { className: "px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors", children: "Preview" })] })] })] }));
};
exports.default = MarketplaceDashboard;
//# sourceMappingURL=MarketplaceDashboard.js.map