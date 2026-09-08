// DUPLICATE 1: UserService - Main implementation
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class UserService {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async createUser(userData) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const user = {
            ...userData,
            password: hashedPassword,
            createdAt: new Date()
        };
        return await this.userRepository.create(user);
    }

    async authenticate(email, password) {
        const user = await this.userRepository.findByEmail(email);
        if (!user) throw new Error('User not found');

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) throw new Error('Invalid credentials');

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return { user: this.sanitizeUser(user), token };
    }

    async getUserById(id) {
        const user = await this.userRepository.findById(id);
        return user ? this.sanitizeUser(user) : null;
    }

    sanitizeUser(user) {
        const { password, ...sanitized } = user;
        return sanitized;
    }
}

module.exports = UserService;