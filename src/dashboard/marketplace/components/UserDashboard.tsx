import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Clock,
  Zap,
  Settings,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle,
  AlertCircle,
  Info,
  ExternalLink,
  Download,
  Star,
  Brain,
  Target
} from 'lucide-react';

interface UserStats {
  tokensSavedThisMonth: number;
  moneySavedThisMonth: number;
  activePlugins: number;
  totalQueries: number;
  avgRelevance: number;
  timeSavedHours: number;
  efficiencyImprovement: number;
  trendsVsLastMonth: {
    tokensSaved: number;
    queries: number;
    relevance: number;
  };
}

interface PluginPerformance {
  id: string;
  name: string;
  icon: string;
  uses: number;
  tokensSaved: number;
  moneySaved: number;
  avgRelevance: number;
  timeSaved: number;
  status: 'active' | 'inactive' | 'outdated';
  lastUsed: string;
  hasUpdate: boolean;
  intelligence: {
    hasAISelection: boolean;
    avgTokenSavings: number;
  };
}

interface Recommendation {
  type: 'optimization' | 'plugin' | 'combination' | 'upgrade';
  title: string;
  description: string;
  potentialSavings: number;
  confidence: number;
  actionUrl?: string;
  actionText?: string;
}

const UserDashboard: React.FC = () => {
  const [userStats, setUserStats] = useState<UserStats>({
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

  const [pluginPerformance, setPluginPerformance] = useState<PluginPerformance[]>([
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

  const [recommendations, setRecommendations] = useState<Recommendation[]>([
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

  const [timeframe, setTimeframe] = useState('30d');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
      case 'outdated': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'optimization': return <Target className="w-5 h-5 text-blue-500" />;
      case 'plugin': return <Download className="w-5 h-5 text-green-500" />;
      case 'combination': return <Zap className="w-5 h-5 text-purple-500" />;
      case 'upgrade': return <TrendingUp className="w-5 h-5 text-orange-500" />;
      default: return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Plugin Dashboard</h1>
                <p className="mt-2 text-gray-600">
                  Track your plugin performance, token savings, and optimization opportunities
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Export Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tokens Saved This Month</p>
                <p className="text-3xl font-bold text-gray-900">
                  {(userStats.tokensSavedThisMonth / 1000).toFixed(0)}K
                </p>
                <p className="text-sm text-green-600 font-medium">
                  ${userStats.moneySavedThisMonth.toFixed(2)} saved
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-600">+{userStats.trendsVsLastMonth.tokensSaved}% vs last month</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Plugins</p>
                <p className="text-3xl font-bold text-gray-900">{userStats.activePlugins}</p>
                <p className="text-sm text-gray-500">
                  {pluginPerformance.filter(p => p.intelligence.hasAISelection).length} smart, {pluginPerformance.filter(p => !p.intelligence.hasAISelection).length} traditional
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <CheckCircle className="w-4 h-4 text-blue-500 mr-1" />
              <span className="text-blue-600">All plugins healthy</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Relevance</p>
                <p className="text-3xl font-bold text-gray-900">{userStats.avgRelevance}%</p>
                <p className="text-sm text-gray-500">
                  {userStats.totalQueries} queries analyzed
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-600">+{userStats.trendsVsLastMonth.relevance}% improved</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Time Saved</p>
                <p className="text-3xl font-bold text-gray-900">{userStats.timeSavedHours}h</p>
                <p className="text-sm text-gray-500">
                  This month
                </p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <Zap className="w-4 h-4 text-orange-500 mr-1" />
              <span className="text-orange-600">{userStats.efficiencyImprovement}% faster execution</span>
            </div>
          </div>
        </div>

        {/* Plugin Performance Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Plugin Performance
            </h2>
            <p className="text-gray-600 mt-1">Detailed analytics for your installed plugins</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plugin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uses
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tokens Saved
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Relevance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pluginPerformance.map((plugin) => (
                  <tr key={plugin.id} className={plugin.status === 'outdated' ? 'bg-orange-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{plugin.icon}</span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">{plugin.name}</span>
                            {plugin.intelligence.hasAISelection && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                <Brain className="w-3 h-3 mr-1" />
                                SMART
                              </span>
                            )}
                            {plugin.hasUpdate && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                UPDATE
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Last used: {new Date(plugin.lastUsed).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {plugin.uses}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {(plugin.tokensSaved / 1000).toFixed(0)}K
                      </div>
                      <div className="text-xs text-green-600">
                        ${plugin.moneySaved.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className={`h-2 rounded-full ${
                              plugin.avgRelevance >= 90 ? 'bg-green-500' :
                              plugin.avgRelevance >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${plugin.avgRelevance}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">{plugin.avgRelevance}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plugin.status)}`}>
                        {plugin.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {plugin.status === 'outdated' && <AlertCircle className="w-3 h-3 mr-1" />}
                        {plugin.status.charAt(0).toUpperCase() + plugin.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">Configure</button>
                      <button className="text-gray-600 hover:text-gray-900">Analytics</button>
                      {plugin.hasUpdate && (
                        <button className="text-orange-600 hover:text-orange-900">Update</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Usage Analytics Chart */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <PieChart className="w-5 h-5 mr-2" />
                Token Savings Over Time
              </h3>
            </div>
            <div className="p-6">
              {/* Placeholder for chart - would integrate with a charting library like Chart.js */}
              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Token savings chart would appear here</p>
                  <p className="text-sm text-gray-400">Showing progressive savings over {timeframe}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Plugin Usage Distribution */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <PieChart className="w-5 h-5 mr-2" />
                Plugin Usage Distribution
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {pluginPerformance.slice(0, 3).map((plugin, index) => {
                  const percentage = (plugin.uses / userStats.totalQueries * 100);
                  return (
                    <div key={plugin.id}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{plugin.icon}</span>
                          <span className="font-medium">{plugin.name}</span>
                        </div>
                        <span className="text-gray-500">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${
                            index === 0 ? 'bg-blue-500' :
                            index === 1 ? 'bg-green-500' : 'bg-purple-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Smart Recommendations */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Brain className="w-5 h-5 mr-2 text-blue-500" />
              Smart Recommendations
            </h2>
            <p className="text-gray-600 mt-1">AI-powered suggestions to optimize your workflow</p>
          </div>
          
          <div className="p-6 space-y-4">
            {recommendations.map((rec, index) => (
              <div key={index} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {getRecommendationIcon(rec.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-gray-900">{rec.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-green-600 font-medium">
                          Potential monthly savings: +${rec.potentialSavings.toFixed(2)}
                        </span>
                        <span className="text-blue-600">
                          {rec.confidence}% confidence
                        </span>
                      </div>
                      
                      {rec.actionText && (
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center">
                          {rec.actionText}
                          <ExternalLink className="w-4 h-4 ml-1" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;