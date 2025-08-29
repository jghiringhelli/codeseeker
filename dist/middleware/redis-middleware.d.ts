import { Request, Response, NextFunction } from 'express';
import { WebSocket } from 'ws';
import { RedisMessagingService } from '../messaging/redis-messaging';
interface ExtendedRequest extends Request {
    redisMessaging?: RedisMessagingService;
}
export declare class RedisMiddleware {
    private static instance;
    private redisMessaging;
    private logger;
    private wsConnections;
    private pingInterval;
    static getInstance(): RedisMiddleware;
    initialize(): Promise<void>;
    private setupRedisEventHandlers;
    private broadcastToSubscribers;
    private broadcastSystemMessage;
    private startWebSocketPing;
    private removeWebSocketConnection;
    middleware(): (req: ExtendedRequest, res: Response, next: NextFunction) => Promise<void>;
    handleWebSocketUpgrade(ws: WebSocket, req: Request): string;
    private handleWebSocketMessage;
    private handleSubscribe;
    private handleUnsubscribe;
    private handleWorkflowCommand;
    private handleTerminalRequest;
    getRedisStatus(): Promise<any>;
    sendWorkflowCommand(command: any): Promise<void>;
    sendTerminalRequest(request: any): Promise<void>;
    sendWorkflowUpdate(update: any): Promise<void>;
    sendSystemStatus(status: any): Promise<void>;
    shutdown(): Promise<void>;
}
export default RedisMiddleware;
//# sourceMappingURL=redis-middleware.d.ts.map