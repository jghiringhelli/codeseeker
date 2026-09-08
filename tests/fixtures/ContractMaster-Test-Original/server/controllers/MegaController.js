// SOLID VIOLATION: Single Responsibility Principle
// This controller handles too many concerns
const fs = require('fs-extra');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class MegaController {
    constructor() {
        this.contracts = [];
        this.users = [];
        this.emailTemplates = {};
        this.auditLogs = [];
    }

    // User management methods (should be separate)
    async registerUser(req, res) {
        try {
            const { email, password, name } = req.body;

            // Inline validation (should be separate)
            if (!email || !email.includes('@')) {
                return res.status(400).json({ error: 'Invalid email' });
            }
            if (!password || password.length < 6) {
                return res.status(400).json({ error: 'Password too short' });
            }

            // Direct password hashing (should be in service)
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const user = {
                id: Date.now(),
                email,
                password: hashedPassword,
                name,
                createdAt: new Date()
            };

            this.users.push(user);

            // Direct email sending (should be separate service)
            await this.sendWelcomeEmail(user);

            // Direct audit logging (should be separate)
            this.logAuditEvent('USER_CREATED', user.id, req.ip);

            res.json({ success: true, userId: user.id });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Contract management methods (should be separate)
    async createContract(req, res) {
        try {
            const { title, content, type, userId } = req.body;

            // File operations (should be in separate service)
            const contractsDir = path.join(__dirname, '../../contracts');
            await fs.ensureDir(contractsDir);

            const contract = {
                id: Date.now(),
                title,
                content,
                type,
                userId,
                createdAt: new Date(),
                status: 'draft'
            };

            // Direct file writing (should be abstracted)
            const filename = `contract-${contract.id}.json`;
            await fs.writeFile(
                path.join(contractsDir, filename),
                JSON.stringify(contract, null, 2)
            );

            this.contracts.push(contract);

            // PDF generation (should be separate service)
            await this.generateContractPDF(contract);

            // Email notification (should be separate)
            const user = this.users.find(u => u.id === userId);
            if (user) {
                await this.sendContractNotification(user, contract);
            }

            // Audit logging again
            this.logAuditEvent('CONTRACT_CREATED', contract.id, req.ip);

            res.json({ success: true, contractId: contract.id });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Email service methods (should be separate)
    async sendWelcomeEmail(user) {
        console.log(`Sending welcome email to ${user.email}`);
        // Fake email implementation
    }

    async sendContractNotification(user, contract) {
        console.log(`Notifying ${user.email} about contract ${contract.id}`);
        // Fake email implementation
    }

    // PDF service methods (should be separate)
    async generateContractPDF(contract) {
        console.log(`Generating PDF for contract ${contract.id}`);
        // Fake PDF generation
    }

    // Audit service methods (should be separate)
    logAuditEvent(action, resourceId, ip) {
        this.auditLogs.push({
            action,
            resourceId,
            ip,
            timestamp: new Date()
        });
        console.log(`Audit: ${action} on ${resourceId} from ${ip}`);
    }

    // Report generation (should be separate)
    async generateUserReport(req, res) {
        try {
            const report = {
                totalUsers: this.users.length,
                totalContracts: this.contracts.length,
                recentActivity: this.auditLogs.slice(-10)
            };

            res.json(report);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = MegaController;