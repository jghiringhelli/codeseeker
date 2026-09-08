// SOLID VIOLATION: Dependency Inversion Principle
// High-level modules depend on low-level modules instead of abstractions

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer'); // Direct dependency

class BusinessLogic {
    constructor() {
        // VIOLATION: Direct instantiation of low-level dependencies
        this.fileSystem = fs; // Direct dependency on file system
        this.emailTransporter = nodemailer.createTransporter({ // Concrete implementation
            service: 'gmail',
            auth: {
                user: 'contracts@company.com',
                pass: 'password123'
            }
        });
        this.databaseConnection = require('sqlite3').Database; // Direct database dependency
    }

    async processContract(contractData) {
        // VIOLATION: Direct dependency on concrete file operations
        const contractsDir = path.join(__dirname, '../../data/contracts');

        // Creating directory directly
        if (!this.fileSystem.existsSync(contractsDir)) {
            this.fileSystem.mkdirSync(contractsDir, { recursive: true });
        }

        // VIOLATION: Direct file writing
        const filename = `contract-${Date.now()}.json`;
        const filePath = path.join(contractsDir, filename);
        this.fileSystem.writeFileSync(filePath, JSON.stringify(contractData));

        // VIOLATION: Direct database operations
        const db = new this.databaseConnection('./contracts.db');
        db.run(
            'INSERT INTO contracts (filename, created_at) VALUES (?, ?)',
            [filename, new Date().toISOString()]
        );
        db.close();

        // VIOLATION: Direct email sending
        await this.emailTransporter.sendMail({
            from: 'contracts@company.com',
            to: contractData.notifyEmail,
            subject: 'Contract Created',
            text: `Your contract has been created: ${filename}`
        });

        return { success: true, filename };
    }

    async authenticateUser(email, password) {
        // VIOLATION: Direct database query
        const db = new this.databaseConnection('./users.db');

        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE email = ?',
                [email],
                async (err, user) => {
                    if (err) return reject(err);
                    if (!user) return resolve(null);

                    // VIOLATION: Direct bcrypt usage
                    const isValid = await bcrypt.compare(password, user.password);
                    db.close();
                    resolve(isValid ? user : null);
                }
            );
        });
    }

    async generateReport() {
        // VIOLATION: Multiple direct dependencies
        const db = new this.databaseConnection('./contracts.db');
        const contractsDir = path.join(__dirname, '../../data/contracts');

        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM contracts', (err, contracts) => {
                if (err) return reject(err);

                const report = {
                    totalContracts: contracts.length,
                    files: []
                };

                // Direct file system operations
                contracts.forEach(contract => {
                    const filePath = path.join(contractsDir, contract.filename);
                    if (this.fileSystem.existsSync(filePath)) {
                        const stats = this.fileSystem.statSync(filePath);
                        report.files.push({
                            filename: contract.filename,
                            size: stats.size,
                            created: stats.birthtime
                        });
                    }
                });

                db.close();
                resolve(report);
            });
        });
    }

    async backup() {
        // VIOLATION: Direct zip library usage and file operations
        const AdmZip = require('adm-zip'); // Another direct dependency
        const zip = new AdmZip();

        const contractsDir = path.join(__dirname, '../../data/contracts');
        const files = this.fileSystem.readdirSync(contractsDir);

        files.forEach(file => {
            const filePath = path.join(contractsDir, file);
            zip.addLocalFile(filePath);
        });

        const backupPath = path.join(__dirname, '../../backups', `backup-${Date.now()}.zip`);
        zip.writeZip(backupPath);

        // Direct email notification
        await this.emailTransporter.sendMail({
            from: 'contracts@company.com',
            to: 'admin@company.com',
            subject: 'Backup Created',
            text: `Backup created at: ${backupPath}`
        });

        return backupPath;
    }
}

// Example of what it should look like (better design with abstractions):
class BetterBusinessLogic {
    constructor(fileService, emailService, databaseService, cryptoService) {
        // Depends on abstractions, not concretions
        this.fileService = fileService;
        this.emailService = emailService;
        this.databaseService = databaseService;
        this.cryptoService = cryptoService;
    }

    async processContract(contractData) {
        const filename = await this.fileService.saveContract(contractData);
        await this.databaseService.recordContract(filename);
        await this.emailService.notifyContractCreated(contractData.notifyEmail, filename);
        return { success: true, filename };
    }
}

module.exports = { BusinessLogic, BetterBusinessLogic };