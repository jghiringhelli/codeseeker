"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const UserDashboard = () => {
    const [userStats, setUserStats] = (0, react_1.useState)({
        tokensSavedThisMonth: 487000,
        moneySavedThisMonth: 146.10,
        activePlugins: 8,
        totalQueries: 156,
        avgRelevance: 91.3,
        timeSavedHours: 23.4,
        efficiencyImprovement: 847,
        trendsVsLastMonth: {
            tokensSaved: 23,
            queries: 18,
            relevance: 4.2
        }
    });
    const [pluginPerformance, setPluginPerformance] = (0, react_1.useState)([
        {
            id: 'smart-codebase-analyst',
            name: 'Smart Codebase Analyst',
            icon: '🧠',
            uses: 45,
            tokensSaved: 156000,
            moneySaved: 46.80,
            avgRelevance: 94.1,
            timeSaved: 8.2,
            status: 'active',
            lastUsed: '2024-01-15',
            hasUpdate: false,
            intelligence: {
                hasAISelection: true,
                avgTokenSavings: 89
            }
        },
        {
            id: 'intelligent-security-scanner',
            name: 'Intelligent Security Scanner',
            icon: '🔒',
            uses: 23,
            tokensSaved: 89000,
            moneySaved: 26.70,
            avgRelevance: 91.7,
            timeSaved: 6.1,
            status: 'active',
            lastUsed: '2024-01-14',
            hasUpdate: true,
            intelligence: {
                hasAISelection: true,
                avgTokenSavings: 82
            }
        },
        {
            id: 'adaptive-performance-analyzer',
            name: 'Performance Analyzer',
            icon: '⚡',
            uses: 18,
            tokensSaved: 67000,
            moneySaved: 20.10,
            avgRelevance: 88.3,
            timeSaved: 4.8,
            status: 'active',
            lastUsed: '2024-01-13',
            hasUpdate: false,
            intelligence: {
                hasAISelection: true,
                avgTokenSavings: 79
            }
        },
        {
            id: 'legacy-code-scanner',
            name: 'Legacy Code Scanner',
            icon: '📊',
            uses: 8,
            tokensSaved: 12000,
            moneySaved: 3.60,
            avgRelevance: 67.2,
            timeSaved: 1.2,
            status: 'outdated',
            lastUsed: '2024-01-08',
            hasUpdate: true,
            intelligence: {
                hasAISelection: false,
                avgTokenSavings: 45
            }
        }
    ]);
    const [recommendations, setRecommendations] = (0, react_1.useState)([
        {
            type: 'optimization',
            title: 'Optimize Your Workflow',
            description: 'Based on your usage patterns, you could save an additional 12% tokens by combining smart-codebase-analyst with intelligent-context-builder.',
            potentialSavings: 18.40,
            confidence: 94,
            actionText: 'Try Combination',
            actionUrl: '/marketplace/combos/analysis-context'
        },
        {
            type: 'plugin',
            title: 'New Plugin Suggestion',
            description: 'adaptive-performance-analyzer would be perfect for your Node.js projects. 89% of similar users found it valuable.',
            potentialSavings: 24.80,
            confidence: 89,
            actionText: 'Learn More',
            actionUrl: '/marketplace/plugin/adaptive-performance-analyzer'
        },
        {
            type: 'upgrade',
            title: 'Plugin Update Available',
            description: 'Intelligent Security Scanner v1.9.0 includes improved vulnerability detection and 5% better token efficiency.',
            potentialSavings: 8.20,
            confidence: 98,
            actionText: 'Update Now',
            actionUrl: '/dashboard/plugins/intelligent-security-scanner/update'
        }
    ]);
    const [timeframe, setTimeframe] = (0, react_1.useState)('30d');
    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'inactive': return 'text-gray-600 bg-gray-100';
            case 'outdated': return 'text-orange-600 bg-orange-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };
    const getRecommendationIcon = (type) => {
        switch (type) {
            case 'optimization': return (0, jsx_runtime_1.jsx)(lucide_react_1.Target, { className: "w-5 h-5 text-blue-500" });
            case 'plugin': return (0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "w-5 h-5 text-green-500" });
            case 'combination': return (0, jsx_runtime_1.jsx)(lucide_react_1.Zap, { className: "w-5 h-5 text-purple-500" });
            case 'upgrade': return (0, jsx_runtime_1.jsx)(lucide_react_1.TrendingUp, { className: "w-5 h-5 text-orange-500" });
            default: return (0, jsx_runtime_1.jsx)(lucide_react_1.Info, { className: "w-5 h-5 text-gray-500" });
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "min-h-screen bg-gray-50", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-white shadow-sm border-b", children: (0, jsx_runtime_1.jsx)("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: (0, jsx_runtime_1.jsx)("div", { className: "py-6", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900", children: "My Plugin Dashboard" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-gray-600", children: "Track your plugin performance, token savings, and optimization opportunities" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [(0, jsx_runtime_1.jsxs)("select", { value: timeframe, onChange: (e) => setTimeframe(e.target.value), className: "border border-gray-200 rounded-lg px-3 py-2 text-sm", children: [(0, jsx_runtime_1.jsx)("option", { value: "7d", children: "Last 7 days" }), (0, jsx_runtime_1.jsx)("option", { value: "30d", children: "Last 30 days" }), (0, jsx_runtime_1.jsx)("option", { value: "90d", children: "Last 90 days" })] }), (0, jsx_runtime_1.jsx)("button", { className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors", children: "Export Report" })] })] }) }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: "Tokens Saved This Month" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-3xl font-bold text-gray-900", children: [(userStats.tokensSavedThisMonth / 1000).toFixed(0), "K"] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-green-600 font-medium", children: ["$", userStats.moneySavedThisMonth.toFixed(2), " saved"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "bg-green-100 rounded-full p-3", children: (0, jsx_runtime_1.jsx)(lucide_react_1.DollarSign, { className: "w-6 h-6 text-green-600" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center text-sm", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.TrendingUp, { className: "w-4 h-4 text-green-500 mr-1" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-green-600", children: ["+", userStats.trendsVsLastMonth.tokensSaved, "% vs last month"] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: "Active Plugins" }), (0, jsx_runtime_1.jsx)("p", { className: "text-3xl font-bold text-gray-900", children: userStats.activePlugins }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-gray-500", children: [pluginPerformance.filter(p => p.intelligence.hasAISelection).length, " smart, ", pluginPerformance.filter(p => !p.intelligence.hasAISelection).length, " traditional"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "bg-blue-100 rounded-full p-3", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Activity, { className: "w-6 h-6 text-blue-600" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center text-sm", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "w-4 h-4 text-blue-500 mr-1" }), (0, jsx_runtime_1.jsx)("span", { className: "text-blue-600", children: "All plugins healthy" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: "Avg Relevance" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-3xl font-bold text-gray-900", children: [userStats.avgRelevance, "%"] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-gray-500", children: [userStats.totalQueries, " queries analyzed"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "bg-purple-100 rounded-full p-3", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Target, { className: "w-6 h-6 text-purple-600" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center text-sm", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.TrendingUp, { className: "w-4 h-4 text-green-500 mr-1" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-green-600", children: ["+", userStats.trendsVsLastMonth.relevance, "% improved"] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: "Time Saved" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-3xl font-bold text-gray-900", children: [userStats.timeSavedHours, "h"] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500", children: "This month" })] }), (0, jsx_runtime_1.jsx)("div", { className: "bg-orange-100 rounded-full p-3", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "w-6 h-6 text-orange-600" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex items-center text-sm", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Zap, { className: "w-4 h-4 text-orange-500 mr-1" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-orange-600", children: [userStats.efficiencyImprovement, "% faster execution"] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border", children: [(0, jsx_runtime_1.jsxs)("div", { className: "p-6 border-b", children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-xl font-semibold text-gray-900 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "w-5 h-5 mr-2" }), "Plugin Performance"] }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mt-1", children: "Detailed analytics for your installed plugins" })] }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-gray-50", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Plugin" }), (0, jsx_runtime_1.jsx)("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Uses" }), (0, jsx_runtime_1.jsx)("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Tokens Saved" }), (0, jsx_runtime_1.jsx)("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Avg Relevance" }), (0, jsx_runtime_1.jsx)("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "bg-white divide-y divide-gray-200", children: pluginPerformance.map((plugin) => ((0, jsx_runtime_1.jsxs)("tr", { className: plugin.status === 'outdated' ? 'bg-orange-50' : '', children: [(0, jsx_runtime_1.jsx)("td", { className: "px-6 py-4 whitespace-nowrap", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-2xl mr-3", children: plugin.icon }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-gray-900", children: plugin.name }), plugin.intelligence.hasAISelection && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "w-3 h-3 mr-1" }), "SMART"] })), plugin.hasUpdate && ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800", children: "UPDATE" }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-500", children: ["Last used: ", new Date(plugin.lastUsed).toLocaleDateString()] })] })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: plugin.uses }), (0, jsx_runtime_1.jsxs)("td", { className: "px-6 py-4 whitespace-nowrap", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-sm font-medium text-gray-900", children: [(plugin.tokensSaved / 1000).toFixed(0), "K"] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-green-600", children: ["$", plugin.moneySaved.toFixed(2)] })] }), (0, jsx_runtime_1.jsx)("td", { className: "px-6 py-4 whitespace-nowrap", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-16 bg-gray-200 rounded-full h-2 mr-2", children: (0, jsx_runtime_1.jsx)("div", { className: `h-2 rounded-full ${plugin.avgRelevance >= 90 ? 'bg-green-500' :
                                                                            plugin.avgRelevance >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`, style: { width: `${plugin.avgRelevance}%` } }) }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-gray-900", children: [plugin.avgRelevance, "%"] })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-6 py-4 whitespace-nowrap", children: (0, jsx_runtime_1.jsxs)("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plugin.status)}`, children: [plugin.status === 'active' && (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "w-3 h-3 mr-1" }), plugin.status === 'outdated' && (0, jsx_runtime_1.jsx)(lucide_react_1.AlertCircle, { className: "w-3 h-3 mr-1" }), plugin.status.charAt(0).toUpperCase() + plugin.status.slice(1)] }) }), (0, jsx_runtime_1.jsxs)("td", { className: "px-6 py-4 whitespace-nowrap text-sm space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { className: "text-blue-600 hover:text-blue-900", children: "Configure" }), (0, jsx_runtime_1.jsx)("button", { className: "text-gray-600 hover:text-gray-900", children: "Analytics" }), plugin.hasUpdate && ((0, jsx_runtime_1.jsx)("button", { className: "text-orange-600 hover:text-orange-900", children: "Update" }))] })] }, plugin.id))) })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border", children: [(0, jsx_runtime_1.jsx)("div", { className: "p-6 border-b", children: (0, jsx_runtime_1.jsxs)("h3", { className: "text-lg font-semibold text-gray-900 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.PieChart, { className: "w-5 h-5 mr-2" }), "Token Savings Over Time"] }) }), (0, jsx_runtime_1.jsx)("div", { className: "p-6", children: (0, jsx_runtime_1.jsx)("div", { className: "h-64 bg-gray-100 rounded-lg flex items-center justify-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "w-16 h-16 text-gray-400 mx-auto mb-2" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-500", children: "Token savings chart would appear here" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-gray-400", children: ["Showing progressive savings over ", timeframe] })] }) }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border", children: [(0, jsx_runtime_1.jsx)("div", { className: "p-6 border-b", children: (0, jsx_runtime_1.jsxs)("h3", { className: "text-lg font-semibold text-gray-900 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.PieChart, { className: "w-5 h-5 mr-2" }), "Plugin Usage Distribution"] }) }), (0, jsx_runtime_1.jsx)("div", { className: "p-6", children: (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: pluginPerformance.slice(0, 3).map((plugin, index) => {
                                                const percentage = (plugin.uses / userStats.totalQueries * 100);
                                                return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-lg mr-2", children: plugin.icon }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: plugin.name })] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-gray-500", children: [percentage.toFixed(1), "%"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "w-full bg-gray-200 rounded-full h-2 mt-1", children: (0, jsx_runtime_1.jsx)("div", { className: `h-2 rounded-full ${index === 0 ? 'bg-blue-500' :
                                                                    index === 1 ? 'bg-green-500' : 'bg-purple-500'}`, style: { width: `${percentage}%` } }) })] }, plugin.id));
                                            }) }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border", children: [(0, jsx_runtime_1.jsxs)("div", { className: "p-6 border-b", children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-xl font-semibold text-gray-900 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "w-5 h-5 mr-2 text-blue-500" }), "Smart Recommendations"] }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mt-1", children: "AI-powered suggestions to optimize your workflow" })] }), (0, jsx_runtime_1.jsx)("div", { className: "p-6 space-y-4", children: recommendations.map((rec, index) => ((0, jsx_runtime_1.jsx)("div", { className: "bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start space-x-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex-shrink-0", children: getRecommendationIcon(rec.type) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1 min-w-0", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-base font-medium text-gray-900", children: rec.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mt-1", children: rec.description }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mt-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4 text-sm", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-green-600 font-medium", children: ["Potential monthly savings: +$", rec.potentialSavings.toFixed(2)] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-blue-600", children: [rec.confidence, "% confidence"] })] }), rec.actionText && ((0, jsx_runtime_1.jsxs)("button", { className: "bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center", children: [rec.actionText, (0, jsx_runtime_1.jsx)(lucide_react_1.ExternalLink, { className: "w-4 h-4 ml-1" })] }))] })] })] }) }, index))) })] })] })] }));
};
exports.default = UserDashboard;
//# sourceMappingURL=UserDashboard.js.map