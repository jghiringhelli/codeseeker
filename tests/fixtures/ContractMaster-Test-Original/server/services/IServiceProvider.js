// SOLID VIOLATION: Interface Segregation Principle
// Fat interface that forces clients to depend on methods they don't use

class IServiceProvider {
    // User management methods
    createUser(userData) { throw new Error('Not implemented'); }
    updateUser(id, userData) { throw new Error('Not implemented'); }
    deleteUser(id) { throw new Error('Not implemented'); }
    authenticateUser(email, password) { throw new Error('Not implemented'); }
    getUserProfile(id) { throw new Error('Not implemented'); }
    getUserPermissions(id) { throw new Error('Not implemented'); }
    resetUserPassword(email) { throw new Error('Not implemented'); }

    // Contract management methods
    createContract(contractData) { throw new Error('Not implemented'); }
    updateContract(id, contractData) { throw new Error('Not implemented'); }
    deleteContract(id) { throw new Error('Not implemented'); }
    getContract(id) { throw new Error('Not implemented'); }
    listContracts(userId) { throw new Error('Not implemented'); }
    signContract(id, partyId) { throw new Error('Not implemented'); }
    validateContract(contractData) { throw new Error('Not implemented'); }

    // Email service methods
    sendEmail(to, subject, body) { throw new Error('Not implemented'); }
    sendBulkEmail(recipients, subject, body) { throw new Error('Not implemented'); }
    sendTemplateEmail(to, templateId, data) { throw new Error('Not implemented'); }
    getEmailHistory(userId) { throw new Error('Not implemented'); }
    scheduleEmail(to, subject, body, scheduleTime) { throw new Error('Not implemented'); }

    // File management methods
    uploadFile(file, metadata) { throw new Error('Not implemented'); }
    downloadFile(fileId) { throw new Error('Not implemented'); }
    deleteFile(fileId) { throw new Error('Not implemented'); }
    listFiles(userId) { throw new Error('Not implemented'); }
    shareFile(fileId, userId) { throw new Error('Not implemented'); }
    getFileMetadata(fileId) { throw new Error('Not implemented'); }

    // Analytics methods
    generateUserReport() { throw new Error('Not implemented'); }
    generateContractReport() { throw new Error('Not implemented'); }
    getSystemMetrics() { throw new Error('Not implemented'); }
    trackUserAction(userId, action) { throw new Error('Not implemented'); }
    exportAnalytics(format) { throw new Error('Not implemented'); }

    // Payment methods
    processPayment(amount, paymentMethod) { throw new Error('Not implemented'); }
    refundPayment(paymentId) { throw new Error('Not implemented'); }
    getPaymentHistory(userId) { throw new Error('Not implemented'); }
    updatePaymentMethod(userId, paymentMethod) { throw new Error('Not implemented'); }

    // Notification methods
    sendNotification(userId, message) { throw new Error('Not implemented'); }
    sendPushNotification(userId, message) { throw new Error('Not implemented'); }
    markNotificationRead(notificationId) { throw new Error('Not implemented'); }
    getUnreadNotifications(userId) { throw new Error('Not implemented'); }
}

// VIOLATION: This class is forced to implement all methods even though it only needs user management
class SimpleUserService extends IServiceProvider {
    constructor(userRepository) {
        super();
        this.userRepository = userRepository;
    }

    createUser(userData) {
        return this.userRepository.create(userData);
    }

    getUserProfile(id) {
        return this.userRepository.findById(id);
    }

    // Forced to implement methods it doesn't need
    createContract() { throw new Error('User service does not handle contracts'); }
    updateContract() { throw new Error('User service does not handle contracts'); }
    deleteContract() { throw new Error('User service does not handle contracts'); }
    getContract() { throw new Error('User service does not handle contracts'); }
    listContracts() { throw new Error('User service does not handle contracts'); }
    signContract() { throw new Error('User service does not handle contracts'); }
    validateContract() { throw new Error('User service does not handle contracts'); }

    sendEmail() { throw new Error('User service does not handle emails'); }
    sendBulkEmail() { throw new Error('User service does not handle emails'); }
    sendTemplateEmail() { throw new Error('User service does not handle emails'); }
    getEmailHistory() { throw new Error('User service does not handle emails'); }
    scheduleEmail() { throw new Error('User service does not handle emails'); }

    uploadFile() { throw new Error('User service does not handle files'); }
    downloadFile() { throw new Error('User service does not handle files'); }
    deleteFile() { throw new Error('User service does not handle files'); }
    listFiles() { throw new Error('User service does not handle files'); }
    shareFile() { throw new Error('User service does not handle files'); }
    getFileMetadata() { throw new Error('User service does not handle files'); }

    generateUserReport() { throw new Error('User service does not handle analytics'); }
    generateContractReport() { throw new Error('User service does not handle analytics'); }
    getSystemMetrics() { throw new Error('User service does not handle analytics'); }
    trackUserAction() { throw new Error('User service does not handle analytics'); }
    exportAnalytics() { throw new Error('User service does not handle analytics'); }

    processPayment() { throw new Error('User service does not handle payments'); }
    refundPayment() { throw new Error('User service does not handle payments'); }
    getPaymentHistory() { throw new Error('User service does not handle payments'); }
    updatePaymentMethod() { throw new Error('User service does not handle payments'); }

    sendNotification() { throw new Error('User service does not handle notifications'); }
    sendPushNotification() { throw new Error('User service does not handle notifications'); }
    markNotificationRead() { throw new Error('User service does not handle notifications'); }
    getUnreadNotifications() { throw new Error('User service does not handle notifications'); }

    // The rest of the user methods
    updateUser(id, userData) { return this.userRepository.update(id, userData); }
    deleteUser(id) { return this.userRepository.delete(id); }
    authenticateUser(email, password) { /* implementation */ }
    getUserPermissions(id) { /* implementation */ }
    resetUserPassword(email) { /* implementation */ }
}

module.exports = { IServiceProvider, SimpleUserService };