# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in CodeSeeker, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment within 48 hours
- Status update within 7 days
- Fix timeline based on severity

### Severity Levels

| Level    | Response Time | Examples                          |
| -------- | ------------- | --------------------------------- |
| Critical | 24-48 hours   | Remote code execution, data leak  |
| High     | 7 days        | Authentication bypass, injection  |
| Medium   | 30 days       | Information disclosure            |
| Low      | 90 days       | Minor issues, hardening           |

## Security Considerations

### Database Credentials

- Never commit `.env` files with real credentials
- Use `.env.example` as a template
- Rotate credentials regularly in production

### Docker Security

- Keep Docker images updated
- Use non-root users in containers
- Limit container capabilities

### Dependencies

- Run `npm audit` regularly
- Update dependencies promptly for security patches
- Review dependency changes before updating

### Claude CLI Integration

- CodeSeeker uses local Claude CLI execution only
- No API keys are transmitted over network
- All processing happens locally

## Security Best Practices for Users

1. **Keep CodeSeeker updated** to the latest version
2. **Secure your database credentials** - use strong passwords
3. **Run in isolated environments** when possible
4. **Review generated code** before committing to production
5. **Limit file system access** to necessary directories

## Acknowledgments

We appreciate security researchers who help keep CodeSeeker secure. Contributors will be acknowledged (with permission) in release notes.

Thank you for helping keep CodeSeeker and its users safe!
