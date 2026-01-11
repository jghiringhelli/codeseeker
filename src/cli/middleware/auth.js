// Authentication and Authorization Middleware for CodeSeeker Dashboard
const crypto = require('crypto');
const { Pool } = require('pg');

class AuthService {
    constructor() {
        this.db = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'codeseeker',
            user: process.env.DB_USER || 'codeseeker',
            password: process.env.DB_PASSWORD || 'codeseeker123'
        });

        // Default credentials (in production, use environment variables)
        this.defaultCredentials = {
            username: process.env.DASHBOARD_USERNAME || 'admin',
            password: process.env.DASHBOARD_PASSWORD || 'codeseeker123'
        };

        console.log('🔐 AuthService initialized');
    }

    // Generate session token
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Hash password (simple hash for demo - use bcrypt in production)
    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    // Authenticate user
    async authenticate(username, password) {
        try {
            // Simple authentication against default credentials
            if (username === this.defaultCredentials.username && 
                password === this.defaultCredentials.password) {
                
                // Create session
                const sessionToken = this.generateSessionToken();
                const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
                
                // Store session in database
                await this.db.query(`
                    INSERT INTO user_sessions (session_token, user_id, user_name, role, expires_at, ip_address, user_agent)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    sessionToken,
                    username,
                    username,
                    'admin',
                    expiresAt,
                    null, // Will be set by middleware
                    null  // Will be set by middleware
                ]);

                console.log(`✅ User authenticated: ${username}`);
                
                return {
                    success: true,
                    sessionToken,
                    user: {
                        id: username,
                        name: username,
                        role: 'admin'
                    },
                    expiresAt
                };
            }

            console.log(`❌ Authentication failed for user: ${username}`);
            return {
                success: false,
                error: 'Invalid credentials'
            };

        } catch (error) {
            console.error('❌ Authentication error:', error);
            return {
                success: false,
                error: 'Authentication system error'
            };
        }
    }

    // Validate session
    async validateSession(sessionToken) {
        try {
            const result = await this.db.query(`
                SELECT session_token, user_id, user_name, role, expires_at
                FROM user_sessions 
                WHERE session_token = $1 AND expires_at > NOW()
            `, [sessionToken]);

            if (result.rows.length === 0) {
                return { valid: false, error: 'Invalid or expired session' };
            }

            const session = result.rows[0];
            
            // Update last activity
            await this.db.query(`
                UPDATE user_sessions 
                SET last_activity = NOW() 
                WHERE session_token = $1
            `, [sessionToken]);

            return {
                valid: true,
                user: {
                    id: session.user_id,
                    name: session.user_name,
                    role: session.role
                }
            };

        } catch (error) {
            console.error('❌ Session validation error:', error);
            return { valid: false, error: 'Session validation error' };
        }
    }

    // Logout - invalidate session
    async logout(sessionToken) {
        try {
            await this.db.query(`
                DELETE FROM user_sessions 
                WHERE session_token = $1
            `, [sessionToken]);
            
            console.log('🔓 User logged out');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Logout error:', error);
            return { success: false, error: 'Logout error' };
        }
    }

    // Clean expired sessions
    async cleanExpiredSessions() {
        try {
            const result = await this.db.query(`
                DELETE FROM user_sessions 
                WHERE expires_at < NOW()
            `);
            
            if (result.rowCount > 0) {
                console.log(`🧹 Cleaned ${result.rowCount} expired sessions`);
            }
            
        } catch (error) {
            console.error('❌ Session cleanup error:', error);
        }
    }
}

// Middleware functions
function createAuthMiddleware(authService) {
    return {
        // Authentication middleware
        authenticate: async (req, res, next) => {
            const authHeader = req.headers.authorization;
            const sessionToken = req.cookies?.sessionToken;
            
            // Check for API key in Authorization header
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const validation = await authService.validateSession(token);
                
                if (validation.valid) {
                    req.user = validation.user;
                    return next();
                }
            }
            
            // Check for session cookie
            if (sessionToken) {
                const validation = await authService.validateSession(sessionToken);
                
                if (validation.valid) {
                    req.user = validation.user;
                    return next();
                }
            }
            
            // No valid authentication found
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Please provide valid credentials or session token'
            });
        },

        // Optional authentication (for endpoints that work with or without auth)
        optionalAuth: async (req, res, next) => {
            const authHeader = req.headers.authorization;
            const sessionToken = req.cookies?.sessionToken;
            
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const validation = await authService.validateSession(token);
                
                if (validation.valid) {
                    req.user = validation.user;
                }
            } else if (sessionToken) {
                const validation = await authService.validateSession(sessionToken);
                
                if (validation.valid) {
                    req.user = validation.user;
                }
            }
            
            next(); // Continue regardless of auth status
        },

        // Role-based authorization
        requireRole: (requiredRole) => {
            return (req, res, next) => {
                if (!req.user) {
                    return res.status(401).json({ error: 'Authentication required' });
                }
                
                if (req.user.role !== requiredRole && req.user.role !== 'admin') {
                    return res.status(403).json({ 
                        error: 'Insufficient permissions',
                        required: requiredRole,
                        current: req.user.role
                    });
                }
                
                next();
            };
        },

        // Admin-only endpoints
        adminOnly: (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            
            if (req.user.role !== 'admin') {
                return res.status(403).json({ 
                    error: 'Admin access required',
                    current: req.user.role
                });
            }
            
            next();
        }
    };
}

module.exports = { 
    AuthService, 
    createAuthMiddleware 
};