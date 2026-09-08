// DUPLICATE 2: Similar validation but different implementation
class ValidationService {
    static validateContract(contractData) {
        const issues = [];

        // Different validation approach
        if (!contractData.title?.length) {
            issues.push({ field: 'title', message: 'Title cannot be empty' });
        }

        if (contractData.title?.length > 150) {
            issues.push({ field: 'title', message: 'Title exceeds maximum length' });
        }

        if (!Array.isArray(contractData.parties) || contractData.parties.length < 2) {
            issues.push({ field: 'parties', message: 'At least two parties required' });
        }

        if (!contractData.content) {
            issues.push({ field: 'content', message: 'Content is mandatory' });
        }

        // Different party validation
        contractData.parties?.forEach((party, idx) => {
            if (!party.name) {
                issues.push({ field: `party_${idx}_name`, message: `Party ${idx + 1} needs a name` });
            }
            if (!party.email || !ValidationService.checkEmail(party.email)) {
                issues.push({ field: `party_${idx}_email`, message: `Party ${idx + 1} needs valid email` });
            }
        });

        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    static validateContractType(type, data) {
        const typeErrors = [];

        switch (type) {
            case 'employment':
                if (!data.jobTitle) typeErrors.push('Job title required for employment contract');
                if (!data.startDate) typeErrors.push('Start date required for employment contract');
                break;
            case 'service':
                if (!data.serviceDescription) typeErrors.push('Service description required');
                if (!data.timeline) typeErrors.push('Timeline required for service contract');
                break;
            case 'nda':
                if (!data.confidentialityPeriod) typeErrors.push('Confidentiality period required');
                break;
        }

        return typeErrors;
    }

    static checkEmail(email) {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    }
}

module.exports = ValidationService;