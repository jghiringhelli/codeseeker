// SOLID VIOLATION: Open/Closed Principle
// This factory requires modification every time a new processor type is added
class ProcessorFactory {
    static createProcessor(type, config) {
        // Hardcoded switch statement - violates OCP
        switch (type) {
            case 'nda':
                return new NDAProcessor(config);
            case 'employment':
                return new EmploymentProcessor(config);
            case 'service':
                return new ServiceProcessor(config);
            case 'lease':
                return new LeaseProcessor(config);
            // Every new type requires modifying this switch!
            default:
                throw new Error(`Unknown processor type: ${type}`);
        }
    }

    // Another OCP violation - hardcoded validation
    static validateProcessorConfig(type, config) {
        if (type === 'nda') {
            if (!config.parties || config.parties.length !== 2) {
                throw new Error('NDA requires exactly 2 parties');
            }
        } else if (type === 'employment') {
            if (!config.employee || !config.employer) {
                throw new Error('Employment contract requires employee and employer');
            }
        } else if (type === 'service') {
            if (!config.provider || !config.client) {
                throw new Error('Service contract requires provider and client');
            }
        } else if (type === 'lease') {
            if (!config.landlord || !config.tenant) {
                throw new Error('Lease requires landlord and tenant');
            }
        }
        // Adding new types means modifying this method too!
    }
}

class NDAProcessor {
    constructor(config) {
        this.config = config;
    }

    process() {
        return `Processing NDA for ${this.config.parties.join(' and ')}`;
    }
}

class EmploymentProcessor {
    constructor(config) {
        this.config = config;
    }

    process() {
        return `Processing employment contract for ${this.config.employee}`;
    }
}

class ServiceProcessor {
    constructor(config) {
        this.config = config;
    }

    process() {
        return `Processing service contract between ${this.config.provider} and ${this.config.client}`;
    }
}

class LeaseProcessor {
    constructor(config) {
        this.config = config;
    }

    process() {
        return `Processing lease between ${this.config.landlord} and ${this.config.tenant}`;
    }
}

module.exports = { ProcessorFactory, NDAProcessor, EmploymentProcessor, ServiceProcessor, LeaseProcessor };