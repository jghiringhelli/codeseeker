/**
 * Memory Storage Service
 * SOLID Principles: Single Responsibility - Handle memory persistence only
 */

import { Logger } from '../../logger';
import { SemanticGraphService } from '../../../cli/services/data/semantic-graph/semantic-graph';
import {
  IMemoryStorageService,
  InteractionMemory,
  RequestMemory,
  SessionMemory,
  ProjectMemory
} from '../interfaces/index';

// Temporary stubs for missing services
class PostgreSQLService {
  async query() { return []; }
  async insert() { return 'id'; }
}

class RedisService {
  async get(key: string) { return null; }
  async set(key: string, value: string) { return 'OK'; }
  async del(key: string) { return 1; }
  async exists(key: string) { return false; }
  async lpush(key: string, value: string) { return 1; }
  async lrange(key: string, start: number, end: number) { return []; }
  async expire(key: string, ttl: number) { return 1; }
  async setex(key: string, ttl: number, value: string) { return 'OK'; }
}

export class MemoryStorageService implements IMemoryStorageService {
  private logger = Logger.getInstance();
  private postgres: PostgreSQLService;
  private redis: RedisService;
  private semanticGraph: SemanticGraphService;

  constructor() {
    this.postgres = new PostgreSQLService();
    this.redis = new RedisService();
    this.semanticGraph = new SemanticGraphService();
  }

  async initialize(): Promise<void> {
    await this.semanticGraph.initialize();
    this.logger.info('🧠 Memory storage service initialized');
  }

  async storeInteraction(interaction: InteractionMemory): Promise<void> {
    try {
      // Store in PostgreSQL for persistent storage
      await this.storeInteractionPersistent(interaction);

      // Cache in Redis for quick access
      await this.cacheInteraction(interaction);

      // Store relationships in Neo4j
      await this.storeInteractionRelationships(interaction);

      this.logger.debug(`Stored interaction ${interaction.id} for request ${interaction.requestId}`);
    } catch (error) {
      this.logger.error('Failed to store interaction:', error);
      throw error;
    }
  }

  async storeRequest(request: RequestMemory): Promise<void> {
    try {
      // Store in PostgreSQL for persistent storage
      await this.storeRequestPersistent(request);

      // Cache in Redis for quick access
      await this.cacheRequest(request);

      // Update knowledge graph
      await this.updateKnowledgeGraph(request);

      this.logger.debug(`Stored request ${request.requestId} for session ${request.sessionId}`);
    } catch (error) {
      this.logger.error('Failed to store request:', error);
      throw error;
    }
  }

  async storeSession(session: SessionMemory): Promise<void> {
    try {
      // Store in PostgreSQL for persistent storage
      await this.storeSessionPersistent(session);

      // Cache in Redis for quick access
      await this.cacheSession(session);

      // Store session relationships
      await this.storeSessionRelationships(session);

      this.logger.debug(`Stored session ${session.sessionId} for project ${session.projectId}`);
    } catch (error) {
      this.logger.error('Failed to store session:', error);
      throw error;
    }
  }

  async storeProject(project: ProjectMemory): Promise<void> {
    try {
      // Store in PostgreSQL for persistent storage
      await this.storeProjectPersistent(project);

      // Cache in Redis for quick access
      await this.cacheProject(project);

      // Store project relationships and knowledge
      await this.storeProjectKnowledge(project);

      this.logger.debug(`Stored project ${project.projectId} memory`);
    } catch (error) {
      this.logger.error('Failed to store project:', error);
      throw error;
    }
  }

  async loadInteraction(id: string): Promise<InteractionMemory | null> {
    try {
      // Try Redis cache first
      const cached = await this.redis.get(`interaction:${id}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fall back to PostgreSQL
      return await this.loadInteractionFromDB(id);
    } catch (error) {
      this.logger.error(`Failed to load interaction ${id}:`, error);
      return null;
    }
  }

  async loadRequest(requestId: string): Promise<RequestMemory | null> {
    try {
      // Try Redis cache first
      const cached = await this.redis.get(`request:${requestId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fall back to PostgreSQL
      return await this.loadRequestFromDB(requestId);
    } catch (error) {
      this.logger.error(`Failed to load request ${requestId}:`, error);
      return null;
    }
  }

  async loadSession(sessionId: string): Promise<SessionMemory | null> {
    try {
      // Try Redis cache first
      const cached = await this.redis.get(`session:${sessionId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fall back to PostgreSQL
      return await this.loadSessionFromDB(sessionId);
    } catch (error) {
      this.logger.error(`Failed to load session ${sessionId}:`, error);
      return null;
    }
  }

  async loadProject(projectId: string): Promise<ProjectMemory | null> {
    try {
      // Try Redis cache first
      const cached = await this.redis.get(`project:${projectId}`);
      if (cached) {
        return this.deserializeProjectMemory(JSON.parse(cached));
      }

      // Fall back to PostgreSQL
      return await this.loadProjectFromDB(projectId);
    } catch (error) {
      this.logger.error(`Failed to load project ${projectId}:`, error);
      return null;
    }
  }

  async updateInteractionEffectiveness(id: string, effectiveness: number): Promise<void> {
    try {
      // Update in PostgreSQL
      await this.postgres.query(
        'UPDATE interactions SET effectiveness = ? WHERE id = ?',
        [effectiveness, id]
      );

      // Update cache if exists
      const cached = await this.redis.get(`interaction:${id}`);
      if (cached) {
        const interaction = JSON.parse(cached);
        interaction.effectiveness = effectiveness;
        await this.redis.setex(`interaction:${id}`, 3600, JSON.stringify(interaction));
      }

      this.logger.debug(`Updated effectiveness for interaction ${id}: ${effectiveness}`);
    } catch (error) {
      this.logger.error(`Failed to update interaction effectiveness:`, error);
      throw error;
    }
  }

  async updateProjectKnowledge(projectId: string, knowledge: ProjectMemory['knowledge']): Promise<void> {
    try {
      // Serialize knowledge for storage
      const serializedKnowledge = this.serializeProjectKnowledge(knowledge);

      // Update in PostgreSQL
      await this.postgres.query(
        'UPDATE projects SET knowledge = ? WHERE project_id = ?',
        [JSON.stringify(serializedKnowledge), projectId]
      );

      // Update cache if exists
      const cached = await this.redis.get(`project:${projectId}`);
      if (cached) {
        const project = JSON.parse(cached);
        project.knowledge = serializedKnowledge;
        await this.redis.setex(`project:${projectId}`, 3600, JSON.stringify(project));
      }

      this.logger.debug(`Updated knowledge for project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to update project knowledge:`, error);
      throw error;
    }
  }

  private async storeInteractionPersistent(interaction: InteractionMemory): Promise<void> {
    // Store interaction in PostgreSQL
    await this.postgres.query(`
      INSERT INTO interactions (id, timestamp, request_id, session_id, codemind_request, claude_response, effectiveness, patterns, improvements)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      interaction.id,
      interaction.timestamp,
      interaction.requestId,
      interaction.sessionId,
      JSON.stringify(interaction.codemindRequest),
      JSON.stringify(interaction.claudeResponse),
      interaction.effectiveness,
      JSON.stringify(interaction.patterns),
      JSON.stringify(interaction.improvements)
    ]);
  }

  private async cacheInteraction(interaction: InteractionMemory): Promise<void> {
    // Cache for 1 hour
    await this.redis.setex(`interaction:${interaction.id}`, 3600, JSON.stringify(interaction));
  }

  private async storeInteractionRelationships(interaction: InteractionMemory): Promise<void> {
    try {
      // Create interaction node in Neo4j
      const nodeId = await this.semanticGraph.addNode('Interaction', {
        id: interaction.id,
        timestamp: interaction.timestamp.toISOString(),
        type: interaction.codemindRequest.type,
        success: interaction.claudeResponse.success,
        effectiveness: interaction.effectiveness,
        duration: interaction.claudeResponse.duration,
        tokens_used: interaction.claudeResponse.tokensUsed
      });

      // Link to request if exists
      const requestNodes = await this.semanticGraph.findNodes({ request_id: interaction.requestId });
      if (requestNodes.length > 0) {
        await this.semanticGraph.addRelationship(requestNodes[0].id, nodeId, 'CONTAINS');
      }
    } catch (error) {
      this.logger.warn('Failed to store interaction relationships:', error);
    }
  }

  private async storeRequestPersistent(request: RequestMemory): Promise<void> {
    await this.postgres.query(`
      INSERT INTO requests (request_id, session_id, user_request, project_path, timestamp, duration, type, complexity, outcome, learnings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      request.requestId,
      request.sessionId,
      request.userRequest,
      request.projectPath,
      request.timestamp,
      request.duration,
      request.type,
      request.complexity,
      JSON.stringify(request.outcome),
      JSON.stringify(request.learnings)
    ]);
  }

  private async cacheRequest(request: RequestMemory): Promise<void> {
    // Cache for 1 hour
    await this.redis.setex(`request:${request.requestId}`, 3600, JSON.stringify(request));
  }

  private async updateKnowledgeGraph(request: RequestMemory): Promise<void> {
    try {
      // Create request node
      const nodeId = await this.semanticGraph.addNode('Request', {
        request_id: request.requestId,
        user_request: request.userRequest,
        type: request.type,
        complexity: request.complexity,
        success: request.outcome.success,
        duration: request.duration,
        timestamp: request.timestamp.toISOString()
      });

      // Link to project if exists
      const projectNodes = await this.semanticGraph.findNodes({ project_path: request.projectPath });
      if (projectNodes.length > 0) {
        await this.semanticGraph.addRelationship(projectNodes[0].id, nodeId, 'CONTAINS');
      }
    } catch (error) {
      this.logger.warn('Failed to update knowledge graph:', error);
    }
  }

  private async storeSessionPersistent(session: SessionMemory): Promise<void> {
    await this.postgres.query(`
      INSERT INTO sessions (session_id, project_id, user_id, start_time, end_time, context, patterns, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (session_id) DO UPDATE SET
        end_time = EXCLUDED.end_time,
        context = EXCLUDED.context,
        patterns = EXCLUDED.patterns,
        summary = EXCLUDED.summary
    `, [
      session.sessionId,
      session.projectId,
      session.userId,
      session.startTime,
      session.endTime,
      JSON.stringify(session.context),
      JSON.stringify(session.patterns),
      JSON.stringify(session.summary)
    ]);
  }

  private async cacheSession(session: SessionMemory): Promise<void> {
    // Cache for 4 hours
    await this.redis.setex(`session:${session.sessionId}`, 14400, JSON.stringify(session));
  }

  private async storeSessionRelationships(session: SessionMemory): Promise<void> {
    try {
      // Create session node
      const nodeId = await this.semanticGraph.addNode('Session', {
        session_id: session.sessionId,
        start_time: session.startTime.toISOString(),
        total_requests: session.summary.totalRequests,
        success_rate: session.summary.successRate,
        average_request_time: session.summary.averageRequestTime
      });
    } catch (error) {
      this.logger.warn('Failed to store session relationships:', error);
    }
  }

  private async storeProjectPersistent(project: ProjectMemory): Promise<void> {
    const serializedKnowledge = this.serializeProjectKnowledge(project.knowledge);

    await this.postgres.query(`
      INSERT INTO projects (project_id, project_path, profile, performance, evolution, knowledge)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (project_id) DO UPDATE SET
        profile = EXCLUDED.profile,
        performance = EXCLUDED.performance,
        evolution = EXCLUDED.evolution,
        knowledge = EXCLUDED.knowledge
    `, [
      project.projectId,
      project.projectPath,
      JSON.stringify(project.profile),
      JSON.stringify(project.performance),
      JSON.stringify(project.evolution),
      JSON.stringify(serializedKnowledge)
    ]);
  }

  private async cacheProject(project: ProjectMemory): Promise<void> {
    const serializable = {
      ...project,
      knowledge: this.serializeProjectKnowledge(project.knowledge)
    };
    // Cache for 8 hours
    await this.redis.setex(`project:${project.projectId}`, 28800, JSON.stringify(serializable));
  }

  private async storeProjectKnowledge(project: ProjectMemory): Promise<void> {
    try {
      // Create project node
      const nodeId = await this.semanticGraph.addNode('Project', {
        project_id: project.projectId,
        project_path: project.projectPath,
        language: project.profile.language,
        framework: project.profile.framework,
        architecture: project.profile.architecture,
        complexity: project.profile.complexity,
        domain: project.profile.domain,
        total_requests: project.performance.totalRequests,
        success_rate: project.performance.averageSuccessRate
      });
    } catch (error) {
      this.logger.warn('Failed to store project knowledge:', error);
    }
  }

  private async loadInteractionFromDB(id: string): Promise<InteractionMemory | null> {
    const results = await this.postgres.query(
      'SELECT * FROM interactions WHERE id = ?',
      [id]
    );
    return results.length > 0 ? this.deserializeInteraction(results[0]) : null;
  }

  private async loadRequestFromDB(requestId: string): Promise<RequestMemory | null> {
    const results = await this.postgres.query(
      'SELECT * FROM requests WHERE request_id = ?',
      [requestId]
    );
    return results.length > 0 ? this.deserializeRequest(results[0]) : null;
  }

  private async loadSessionFromDB(sessionId: string): Promise<SessionMemory | null> {
    const results = await this.postgres.query(
      'SELECT * FROM sessions WHERE session_id = ?',
      [sessionId]
    );
    return results.length > 0 ? this.deserializeSession(results[0]) : null;
  }

  private async loadProjectFromDB(projectId: string): Promise<ProjectMemory | null> {
    const results = await this.postgres.query(
      'SELECT * FROM projects WHERE project_id = ?',
      [projectId]
    );
    return results.length > 0 ? this.deserializeProject(results[0]) : null;
  }

  private serializeProjectKnowledge(knowledge: ProjectMemory['knowledge']): any {
    return {
      codingPatterns: Array.from(knowledge.codingPatterns.entries()),
      commonSolutions: Array.from(knowledge.commonSolutions.entries()),
      bestPractices: knowledge.bestPractices,
      antiPatterns: knowledge.antiPatterns,
      projectSpecificKnowledge: knowledge.projectSpecificKnowledge
    };
  }

  private deserializeProjectMemory(data: any): ProjectMemory {
    return {
      ...data,
      knowledge: {
        codingPatterns: new Map(data.knowledge.codingPatterns),
        commonSolutions: new Map(data.knowledge.commonSolutions),
        bestPractices: data.knowledge.bestPractices,
        antiPatterns: data.knowledge.antiPatterns,
        projectSpecificKnowledge: data.knowledge.projectSpecificKnowledge
      }
    };
  }

  private deserializeInteraction(data: any): InteractionMemory {
    return {
      ...data,
      timestamp: new Date(data.timestamp),
      codemindRequest: JSON.parse(data.codemind_request),
      claudeResponse: JSON.parse(data.claude_response),
      patterns: JSON.parse(data.patterns),
      improvements: JSON.parse(data.improvements)
    };
  }

  private deserializeRequest(data: any): RequestMemory {
    return {
      ...data,
      timestamp: new Date(data.timestamp),
      outcome: JSON.parse(data.outcome),
      learnings: JSON.parse(data.learnings),
      interactions: [] // Load separately if needed
    };
  }

  private deserializeSession(data: any): SessionMemory {
    return {
      ...data,
      startTime: new Date(data.start_time),
      endTime: data.end_time ? new Date(data.end_time) : undefined,
      context: JSON.parse(data.context),
      patterns: JSON.parse(data.patterns),
      summary: JSON.parse(data.summary),
      requests: [] // Load separately if needed
    };
  }

  private deserializeProject(data: any): ProjectMemory {
    return this.deserializeProjectMemory({
      ...data,
      profile: JSON.parse(data.profile),
      performance: JSON.parse(data.performance),
      evolution: JSON.parse(data.evolution),
      knowledge: JSON.parse(data.knowledge)
    });
  }

  async close(): Promise<void> {
    await this.semanticGraph.close();
    this.logger.info('🧠 Memory storage service closed');
  }
}