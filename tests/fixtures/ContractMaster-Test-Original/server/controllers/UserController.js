const MegaController = require('./MegaController');

class UserController extends MegaController {
    constructor() {
        super();
    }

    async registerUser(req, res) {
        return super.registerUser(req, res);
    }

    async getUserById(userId) {
        return this.users.find(u => u.id === userId);
    }

    async getAllUsers() {
        return this.users.map(({ password, ...user }) => user);
    }

    async updateUser(req, res) {
        try {
            const { userId } = req.params;
            const { name, email } = req.body;

            const userIndex = this.users.findIndex(u => u.id === parseInt(userId));
            if (userIndex === -1) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (email && !email.includes('@')) {
                return res.status(400).json({ error: 'Invalid email' });
            }

            if (name) this.users[userIndex].name = name;
            if (email) this.users[userIndex].email = email;
            this.users[userIndex].updatedAt = new Date();

            this.logAuditEvent('USER_UPDATED', userId, req.ip);

            res.json({ success: true, user: this.users[userIndex] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteUser(req, res) {
        try {
            const { userId } = req.params;
            const userIndex = this.users.findIndex(u => u.id === parseInt(userId));

            if (userIndex === -1) {
                return res.status(404).json({ error: 'User not found' });
            }

            this.users.splice(userIndex, 1);
            this.logAuditEvent('USER_DELETED', userId, req.ip);

            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = UserController;
