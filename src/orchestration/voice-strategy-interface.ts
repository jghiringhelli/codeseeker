// Voice-Based Strategic Conversation Interface

import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { ProjectManagementKB } from './project-management-kb';
import { KnowledgeRepository } from '../knowledge/repository/knowledge-repository';
import * as fs from 'fs/promises';

export interface VoiceSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  topic: string;
  conversationHistory: ConversationTurn[];
  insights: StrategicInsight[];
  decisions: StrategicDecision[];
  actionItems: ActionItem[];
  mood: 'exploratory' | 'decisive' | 'reflective' | 'urgent';
}

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  speaker: 'user' | 'orchestrator';
  content: string;
  audioPath?: string;
  transcription?: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'concerned' | 'excited';
  intent: ConversationIntent;
  context: string[];
}

export interface ConversationIntent {
  type: 'question' | 'statement' | 'decision' | 'concern' | 'idea' | 'reflection';
  category: 'strategy' | 'technical' | 'process' | 'people' | 'timeline' | 'quality' | 'risks';
  entities: string[];
  confidence: number;
}

export interface StrategicInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'trend' | 'pattern' | 'assumption';
  description: string;
  evidence: string[];
  implications: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: Date;
}

export interface StrategicDecision {
  id: string;
  title: string;
  description: string;
  options: DecisionOption[];
  criteria: string[];
  recommendation: string;
  rationale: string;
  impact: 'transformational' | 'significant' | 'moderate' | 'minor';
  urgency: 'immediate' | 'weeks' | 'months' | 'future';
  stakeholders: string[];
  dependencies: string[];
  createdAt: Date;
}

export interface DecisionOption {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  effort: 'high' | 'medium' | 'low';
  risk: 'high' | 'medium' | 'low';
  score: number;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: Date;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  context: string;
}

export interface VoiceSettings {
  language: 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';
  voice: 'professional' | 'conversational' | 'thoughtful' | 'energetic';
  pace: 'slow' | 'normal' | 'fast';
  enableTranscription: boolean;
  enableSentimentAnalysis: boolean;
  enableRealTimeInsights: boolean;
}

export class VoiceStrategyInterface extends EventEmitter {
  private logger: Logger;
  private projectKB: ProjectManagementKB;
  private knowledgeRepo: KnowledgeRepository;
  private activeSessions: Map<string, VoiceSession> = new Map();
  private voiceSettings: VoiceSettings;
  private speechRecognition: any; // Would be WebSpeechAPI or similar
  private speechSynthesis: any;
  private nlpProcessor: any; // Would be actual NLP service
  private sessionsPath: string;

  constructor(
    logger: Logger,
    projectKB: ProjectManagementKB,
    knowledgeRepo: KnowledgeRepository,
    sessionsPath: string = './voice-sessions'
  ) {
    super();
    this.logger = logger;
    this.projectKB = projectKB;
    this.knowledgeRepo = knowledgeRepo;
    this.sessionsPath = sessionsPath;
    
    this.voiceSettings = {
      language: 'en',
      voice: 'thoughtful',
      pace: 'normal',
      enableTranscription: true,
      enableSentimentAnalysis: true,
      enableRealTimeInsights: true
    };

    this.initializeVoiceServices();
  }

  private initializeVoiceServices(): void {
    // Initialize speech recognition
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      this.speechRecognition = new (window as any).webkitSpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = this.voiceSettings.language;
      
      this.speechRecognition.onresult = this.handleSpeechResult.bind(this);
      this.speechRecognition.onerror = this.handleSpeechError.bind(this);
      
      this.logger.info('Speech recognition initialized');
    } else {
      this.logger.warn('Speech recognition not available - using text input mode');
    }

    // Initialize speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.speechSynthesis = (window as any).speechSynthesis;
      this.logger.info('Speech synthesis initialized');
    } else {
      this.logger.warn('Speech synthesis not available - using text output mode');
    }
  }

  async startStrategicConversation(
    userId: string,
    topic: string = 'Project Strategy Review'
  ): Promise<string> {
    const sessionId = `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: VoiceSession = {
      id: sessionId,
      userId,
      startTime: new Date(),
      topic,
      conversationHistory: [],
      insights: [],
      decisions: [],
      actionItems: [],
      mood: 'exploratory'
    };

    this.activeSessions.set(sessionId, session);
    
    // Start with orchestrator greeting
    await this.addOrchestratorResponse(
      sessionId,
      this.generateGreeting(topic),
      'question',
      'strategy'
    );

    this.logger.info(`Strategic conversation started: ${sessionId} - ${topic}`);
    this.emit('conversation-started', { sessionId, topic });

    return sessionId;
  }

  async processUserInput(
    sessionId: string,
    input: string,
    isVoice: boolean = false
  ): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Add user input to conversation
    const userTurn = await this.addUserInput(sessionId, input, isVoice);
    
    // Process the input for insights and decisions
    await this.processForInsights(session, userTurn);
    
    // Generate orchestrator response
    const response = await this.generateOrchestratorResponse(session, userTurn);
    
    // Add orchestrator response
    const orchestratorTurn = await this.addOrchestratorResponse(
      sessionId,
      response.content,
      response.intent.type,
      response.intent.category
    );

    // Speak the response if voice is enabled
    if (this.speechSynthesis && this.voiceSettings.voice) {
      this.speakResponse(response.content);
    }

    // Save session periodically
    await this.saveSession(session);

    return response.content;
  }

  private async addUserInput(
    sessionId: string,
    input: string,
    isVoice: boolean
  ): Promise<ConversationTurn> {
    const session = this.activeSessions.get(sessionId)!;
    
    const intent = await this.analyzeIntent(input);
    const sentiment = await this.analyzeSentiment(input);
    
    const turn: ConversationTurn = {
      id: `turn-${Date.now()}`,
      timestamp: new Date(),
      speaker: 'user',
      content: input,
      transcription: isVoice ? input : undefined,
      sentiment,
      intent,
      context: this.extractContext(session)
    };

    session.conversationHistory.push(turn);
    this.emit('user-input-processed', { sessionId, turn });
    
    return turn;
  }

  private async addOrchestratorResponse(
    sessionId: string,
    content: string,
    intentType: ConversationIntent['type'],
    intentCategory: ConversationIntent['category']
  ): Promise<ConversationTurn> {
    const session = this.activeSessions.get(sessionId)!;
    
    const turn: ConversationTurn = {
      id: `turn-${Date.now()}`,
      timestamp: new Date(),
      speaker: 'orchestrator',
      content,
      sentiment: 'neutral',
      intent: {
        type: intentType,
        category: intentCategory,
        entities: [],
        confidence: 1.0
      },
      context: this.extractContext(session)
    };

    session.conversationHistory.push(turn);
    this.emit('orchestrator-response-generated', { sessionId, turn });
    
    return turn;
  }

  private async generateOrchestratorResponse(
    session: VoiceSession,
    userTurn: ConversationTurn
  ): Promise<{ content: string; intent: ConversationIntent }> {
    // Get strategic context
    const strategicContext = await this.projectKB.getStrategicContext();
    const recentInsights = session.insights.slice(-3);
    const pendingDecisions = session.decisions.filter(d => !d.recommendation);

    // Generate response based on intent and context
    let response = '';
    let intent: ConversationIntent;

    switch (userTurn.intent.type) {
      case 'question':
        response = await this.handleStrategicQuestion(userTurn, strategicContext);
        intent = { type: 'statement', category: userTurn.intent.category, entities: [], confidence: 0.9 };
        break;
        
      case 'concern':
        response = await this.handleStrategicConcern(userTurn, strategicContext, recentInsights);
        intent = { type: 'question', category: 'strategy', entities: [], confidence: 0.8 };
        break;
        
      case 'idea':
        response = await this.handleStrategicIdea(userTurn, strategicContext);
        intent = { type: 'question', category: 'strategy', entities: [], confidence: 0.9 };
        break;
        
      case 'decision':
        response = await this.handleDecisionMaking(userTurn, strategicContext, pendingDecisions);
        intent = { type: 'statement', category: 'strategy', entities: [], confidence: 0.95 };
        break;
        
      default:
        response = await this.handleGeneralDiscussion(userTurn, strategicContext);
        intent = { type: 'question', category: 'strategy', entities: [], confidence: 0.7 };
    }

    return { content: response, intent };
  }

  private async handleStrategicQuestion(
    userTurn: ConversationTurn,
    context: any
  ): Promise<string> {
    // Search knowledge repository for relevant information
    const searchResults = await this.knowledgeRepo.searchKnowledge(
      userTurn.content,
      { limit: 3, useHybrid: true }
    );

    let response = '';

    if (userTurn.content.toLowerCase().includes('progress') || 
        userTurn.content.toLowerCase().includes('status')) {
      response = `Based on our current project status:\n\n`;
      response += `We're at ${context.metrics?.overallProgress || 0}% overall progress. `;
      response += `${context.currentPhase ? `Currently in ${context.currentPhase.name} phase. ` : ''}`;
      response += `${context.metrics?.milestonesOnTrack || 0} milestones are on track.\n\n`;
      
      if (context.recommendations?.length > 0) {
        response += `Key recommendations: ${context.recommendations[0]}\n\n`;
      }
    } else if (userTurn.content.toLowerCase().includes('risk')) {
      response = `Regarding risks: Our current risk level is ${context.metrics?.riskLevel || 'unknown'}. `;
      
      if (context.highRisks?.length > 0) {
        response += `We have ${context.highRisks.length} high-priority risks that need attention. `;
        response += `The most critical one appears to be related to ${context.highRisks[0]?.category || 'project delivery'}.\n\n`;
      }
    } else if (searchResults.length > 0) {
      response = `Based on industry knowledge and best practices:\n\n`;
      response += searchResults[0].document.content.substring(0, 300) + '...\n\n';
      response += `This aligns with our current ${context.currentPhase?.name || 'project'} phase. `;
    } else {
      response = `That's an interesting strategic question. Let me think about this in the context of our `;
      response += `${context.project?.name || 'project'}.\n\n`;
      response += `Given our current progress and objectives, how do you see this impacting our `;
      response += `${context.currentPhase?.name || 'current'} phase?`;
    }

    response += `\n\nWhat aspects would you like to explore further?`;
    return response;
  }

  private async handleStrategicConcern(
    userTurn: ConversationTurn,
    context: any,
    recentInsights: StrategicInsight[]
  ): Promise<string> {
    // Create a strategic insight from the concern
    const insight: StrategicInsight = {
      id: `insight-${Date.now()}`,
      type: 'risk',
      description: `User concern: ${userTurn.content}`,
      evidence: [userTurn.content],
      implications: [],
      priority: this.assessConcernPriority(userTurn.content),
      createdAt: new Date()
    };

    const session = this.activeSessions.get(userTurn.context[0])!;
    session.insights.push(insight);

    let response = `I appreciate you raising this concern. It's important to address these issues proactively.\n\n`;
    
    if (userTurn.content.toLowerCase().includes('timeline') || 
        userTurn.content.toLowerCase().includes('deadline')) {
      response += `Regarding timeline concerns: `;
      response += `We're currently ${context.metrics?.overallProgress || 0}% complete. `;
      if (context.currentPhase) {
        response += `The ${context.currentPhase.name} phase is scheduled to end ${context.currentPhase.endDate}. `;
      }
      response += `\n\nWhat specific timeline pressures are you most worried about?`;
    } else if (userTurn.content.toLowerCase().includes('quality') || 
               userTurn.content.toLowerCase().includes('technical')) {
      response += `On the technical quality front: `;
      response += `Our quality trend is currently ${context.metrics?.qualityTrend || 'stable'}. `;
      response += `We should examine this concern in detail.\n\n`;
      response += `What specific quality aspects are you most concerned about?`;
    } else {
      response += `This concern relates to ${insight.priority} priority risk. `;
      response += `Let's break this down systematically.\n\n`;
      response += `What would be the worst-case scenario if this concern materializes? `;
      response += `And what early warning signs should we watch for?`;
    }

    return response;
  }

  private async handleStrategicIdea(
    userTurn: ConversationTurn,
    context: any
  ): Promise<string> {
    // Create a strategic insight from the idea
    const insight: StrategicInsight = {
      id: `insight-${Date.now()}`,
      type: 'opportunity',
      description: `Strategic idea: ${userTurn.content}`,
      evidence: [userTurn.content],
      implications: [],
      priority: 'medium',
      createdAt: new Date()
    };

    const sessionId = userTurn.context[0];
    const session = this.activeSessions.get(sessionId)!;
    session.insights.push(insight);

    let response = `That's a fascinating strategic idea. Let me think through the implications...\n\n`;
    
    // Analyze the idea against current context
    if (context.currentPhase) {
      response += `In the context of our current ${context.currentPhase.name} phase, this could `;
      response += `${this.assessIdeaImpact(userTurn.content, context)}.\n\n`;
    }

    response += `To explore this further:\n`;
    response += `• What would success look like if we implemented this idea?\n`;
    response += `• What resources or changes would be required?\n`;
    response += `• How does this align with our core objectives?\n\n`;
    response += `Which aspect would you like to dive deeper into?`;

    return response;
  }

  private async handleDecisionMaking(
    userTurn: ConversationTurn,
    context: any,
    pendingDecisions: StrategicDecision[]
  ): Promise<string> {
    // Create a strategic decision from the input
    const decision: StrategicDecision = {
      id: `decision-${Date.now()}`,
      title: this.extractDecisionTitle(userTurn.content),
      description: userTurn.content,
      options: [],
      criteria: ['feasibility', 'impact', 'risk', 'alignment'],
      recommendation: '',
      rationale: '',
      impact: 'moderate',
      urgency: 'weeks',
      stakeholders: [],
      dependencies: [],
      createdAt: new Date()
    };

    const sessionId = userTurn.context[0];
    const session = this.activeSessions.get(sessionId)!;
    session.decisions.push(decision);

    let response = `This sounds like an important strategic decision. Let me help you think through it systematically.\n\n`;
    response += `**Decision**: ${decision.title}\n\n`;
    response += `To make a well-informed decision, let's consider:\n\n`;
    response += `1. **Options**: What are the main alternatives we're choosing between?\n`;
    response += `2. **Criteria**: What factors are most important for this decision?\n`;
    response += `3. **Stakeholders**: Who needs to be involved or consulted?\n`;
    response += `4. **Timeline**: How urgent is this decision?\n\n`;
    response += `What options are you considering?`;

    return response;
  }

  private async handleGeneralDiscussion(
    userTurn: ConversationTurn,
    context: any
  ): Promise<string> {
    let response = '';

    // Philosophical/reflective responses
    const philosophicalStarters = [
      "That's a thoughtful perspective. In my experience orchestrating complex projects,",
      "Interesting point. From a strategic standpoint,",
      "I find that question touches on something fundamental about",
      "That reminds me of a broader principle in system thinking:",
      "Your observation connects to a deeper pattern I've noticed:"
    ];

    const starter = philosophicalStarters[Math.floor(Math.random() * philosophicalStarters.length)];
    response = `${starter} `;

    // Add contextual insight
    if (context.project) {
      response += `projects like ${context.project.name} often face similar challenges. `;
    }

    response += `The key is finding the right balance between moving forward and taking time to reflect.\n\n`;
    response += `In your experience, what has worked best when facing similar situations? `;
    response += `What patterns have you noticed in successful project outcomes?`;

    return response;
  }

  private generateGreeting(topic: string): string {
    const greetings = [
      `Hello! I'm excited to have this strategic conversation with you about ${topic.toLowerCase()}.`,
      `Welcome to our strategic discussion on ${topic.toLowerCase()}. I'm here to help you think through the complexities.`,
      `Good to connect with you for this strategic dialogue about ${topic.toLowerCase()}.`,
      `I'm looking forward to exploring ${topic.toLowerCase()} with you from multiple angles.`
    ];

    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    return `${greeting}\n\nAs your orchestrator, I bring a unique perspective from coordinating hundreds of development workflows, seeing patterns across projects, and understanding how strategic decisions ripple through technical implementation.\n\nWhat's on your mind today? What strategic challenges or opportunities are you thinking about?`;
  }

  private async analyzeIntent(input: string): Promise<ConversationIntent> {
    // Simplified intent analysis - in production, use actual NLP service
    const lowerInput = input.toLowerCase();
    
    let type: ConversationIntent['type'] = 'statement';
    let category: ConversationIntent['category'] = 'strategy';
    
    // Analyze type
    if (lowerInput.includes('?') || lowerInput.startsWith('what') || 
        lowerInput.startsWith('how') || lowerInput.startsWith('why') ||
        lowerInput.startsWith('when') || lowerInput.startsWith('where')) {
      type = 'question';
    } else if (lowerInput.includes('concerned') || lowerInput.includes('worried') ||
               lowerInput.includes('problem') || lowerInput.includes('issue')) {
      type = 'concern';
    } else if (lowerInput.includes('idea') || lowerInput.includes('suggest') ||
               lowerInput.includes('propose') || lowerInput.startsWith('what if')) {
      type = 'idea';
    } else if (lowerInput.includes('decide') || lowerInput.includes('choose') ||
               lowerInput.includes('should we')) {
      type = 'decision';
    } else if (lowerInput.includes('think') || lowerInput.includes('feel') ||
               lowerInput.includes('believe')) {
      type = 'reflection';
    }
    
    // Analyze category
    if (lowerInput.includes('technical') || lowerInput.includes('code') ||
        lowerInput.includes('architecture') || lowerInput.includes('development')) {
      category = 'technical';
    } else if (lowerInput.includes('process') || lowerInput.includes('workflow') ||
               lowerInput.includes('methodology')) {
      category = 'process';
    } else if (lowerInput.includes('team') || lowerInput.includes('people') ||
               lowerInput.includes('communication')) {
      category = 'people';
    } else if (lowerInput.includes('timeline') || lowerInput.includes('schedule') ||
               lowerInput.includes('deadline')) {
      category = 'timeline';
    } else if (lowerInput.includes('quality') || lowerInput.includes('test') ||
               lowerInput.includes('bug')) {
      category = 'quality';
    } else if (lowerInput.includes('risk') || lowerInput.includes('problem') ||
               lowerInput.includes('challenge')) {
      category = 'risks';
    }

    return {
      type,
      category,
      entities: [], // Would be extracted by actual NLP
      confidence: 0.8
    };
  }

  private async analyzeSentiment(input: string): Promise<ConversationTurn['sentiment']> {
    // Simplified sentiment analysis
    const lowerInput = input.toLowerCase();
    
    const negativeWords = ['concerned', 'worried', 'problem', 'issue', 'difficult', 'challenge', 'wrong'];
    const positiveWords = ['great', 'excellent', 'good', 'success', 'opportunity', 'excited', 'optimistic'];
    const concernedWords = ['uncertain', 'unsure', 'risky', 'doubt', 'hesitant'];
    const excitedWords = ['amazing', 'fantastic', 'thrilled', 'love', 'perfect'];
    
    if (excitedWords.some(word => lowerInput.includes(word))) return 'excited';
    if (concernedWords.some(word => lowerInput.includes(word))) return 'concerned';
    if (negativeWords.some(word => lowerInput.includes(word))) return 'negative';
    if (positiveWords.some(word => lowerInput.includes(word))) return 'positive';
    
    return 'neutral';
  }

  private extractContext(session: VoiceSession): string[] {
    return [
      session.id,
      session.topic,
      session.mood,
      `turns:${session.conversationHistory.length}`
    ];
  }

  private assessConcernPriority(concern: string): StrategicInsight['priority'] {
    const lowerConcern = concern.toLowerCase();
    
    if (lowerConcern.includes('critical') || lowerConcern.includes('urgent') ||
        lowerConcern.includes('immediate') || lowerConcern.includes('blocking')) {
      return 'critical';
    }
    if (lowerConcern.includes('important') || lowerConcern.includes('significant') ||
        lowerConcern.includes('major')) {
      return 'high';
    }
    if (lowerConcern.includes('minor') || lowerConcern.includes('small') ||
        lowerConcern.includes('slight')) {
      return 'low';
    }
    
    return 'medium';
  }

  private assessIdeaImpact(idea: string, context: any): string {
    // Assess how an idea might impact the current context
    const impacts = [
      'significantly accelerate our progress',
      'provide valuable strategic advantages',
      'address some of our key challenges',
      'open up new possibilities',
      'require careful consideration of trade-offs'
    ];
    
    return impacts[Math.floor(Math.random() * impacts.length)];
  }

  private extractDecisionTitle(content: string): string {
    // Extract a title from decision content
    const sentences = content.split(/[.!?]+/);
    const firstSentence = sentences[0].trim();
    
    if (firstSentence.length > 50) {
      return firstSentence.substring(0, 47) + '...';
    }
    
    return firstSentence;
  }

  private speakResponse(text: string): void {
    if (!this.speechSynthesis) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.voiceSettings.language;
    utterance.rate = this.voiceSettings.pace === 'fast' ? 1.2 : 
                     this.voiceSettings.pace === 'slow' ? 0.8 : 1.0;
    
    this.speechSynthesis.speak(utterance);
  }

  private handleSpeechResult(event: any): void {
    const results = event.results;
    const lastResult = results[results.length - 1];
    
    if (lastResult.isFinal) {
      const transcript = lastResult[0].transcript;
      this.emit('speech-recognized', { transcript });
    }
  }

  private handleSpeechError(event: any): void {
    this.logger.error('Speech recognition error:', event.error);
    this.emit('speech-error', event.error);
  }

  private async saveSession(session: VoiceSession): Promise<void> {
    try {
      await fs.mkdir(this.sessionsPath, { recursive: true });
      const sessionPath = `${this.sessionsPath}/${session.id}.json`;
      await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
    } catch (error) {
      this.logger.error('Failed to save voice session', error);
    }
  }

  private async processForInsights(session: VoiceSession, turn: ConversationTurn): Promise<void> {
    // Real-time insight generation would happen here
    // For now, just emit event for monitoring
    this.emit('insight-processed', { sessionId: session.id, turn });
  }

  // Public API
  async endConversation(sessionId: string): Promise<VoiceSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.endTime = new Date();
    await this.saveSession(session);
    
    this.activeSessions.delete(sessionId);
    
    this.logger.info(`Strategic conversation ended: ${sessionId}`);
    this.emit('conversation-ended', session);
    
    return session;
  }

  async getConversationSummary(sessionId: string): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    let summary = `# Strategic Conversation Summary\n\n`;
    summary += `**Topic**: ${session.topic}\n`;
    summary += `**Duration**: ${session.startTime.toLocaleString()}`;
    if (session.endTime) {
      const duration = (session.endTime.getTime() - session.startTime.getTime()) / 60000;
      summary += ` - ${session.endTime.toLocaleString()} (${duration.toFixed(1)} minutes)`;
    }
    summary += `\n**Mood**: ${session.mood}\n\n`;

    if (session.insights.length > 0) {
      summary += `## Strategic Insights (${session.insights.length})\n`;
      session.insights.forEach(insight => {
        summary += `- **${insight.type}**: ${insight.description} (${insight.priority} priority)\n`;
      });
      summary += '\n';
    }

    if (session.decisions.length > 0) {
      summary += `## Decisions Discussed (${session.decisions.length})\n`;
      session.decisions.forEach(decision => {
        summary += `- **${decision.title}**: ${decision.impact} impact, ${decision.urgency} urgency\n`;
      });
      summary += '\n';
    }

    if (session.actionItems.length > 0) {
      summary += `## Action Items (${session.actionItems.length})\n`;
      session.actionItems.forEach(item => {
        summary += `- ${item.description} (${item.priority} priority)\n`;
      });
    }

    return summary;
  }

  getActiveSessionIds(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  updateVoiceSettings(settings: Partial<VoiceSettings>): void {
    this.voiceSettings = { ...this.voiceSettings, ...settings };
    this.logger.info('Voice settings updated');
  }
}