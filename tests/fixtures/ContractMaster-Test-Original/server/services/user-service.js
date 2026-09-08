// DUPLICATE 2: user-service - Similar functionality but different implementation
const bcrypt = require('bcrypt');

class UserManager {
    constructor(database) {
        this.db = database;
    }

    async addUser(userInfo) {
        // Different approach - inline password hashing
        userInfo.password = await bcrypt.hash(userInfo.password, 12);
        userInfo.created = new Date().toISOString();

        return this.db.users.insert(userInfo);
    }

    async login(email, pwd) {
        const user = await this.db.users.findOne({ email });
        if (!user) return null;

        const passwordMatch = await bcrypt.compare(pwd, user.password);
        if (!passwordMatch) return null;

        // Different token implementation
        const sessionToken = this.generateToken(user);
        return {
            userdata: this.cleanUser(user),
            session: sessionToken
        };
    }

    async findUser(userId) {
        const user = await this.db.users.findById(userId);
        return user ? this.cleanUser(user) : null;
    }

    generateToken(user) {
        // Simplified token generation
        return Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    }

    cleanUser(user) {
        delete user.password;
        return user;
    }
}

module.exports = UserManager;