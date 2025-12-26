# Security

This document outlines the security measures implemented in the Guess The Link application.

## Security Headers

The application implements comprehensive HTTP security headers to protect against common web vulnerabilities.

### Quick Start

Security headers are enabled by default. No configuration required.

**Verify headers are working**:
```bash
# Using curl
curl -I http://localhost:8080/api/health

# Using tests
npm test -- security-headers
```

### Documentation

Security headers are configured in `src/server/config/security-headers.ts` and applied via `src/server/middleware/security-headers.ts`.

### Implemented Headers

| Header | Purpose | Default Value |
|--------|---------|---------------|
| Content-Security-Policy | Prevents XSS attacks | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...` |
| X-Frame-Options | Prevents clickjacking | `SAMEORIGIN` |
| X-Content-Type-Options | Prevents MIME sniffing | `nosniff` |
| Referrer-Policy | Controls referrer info | `strict-origin-when-cross-origin` |
| Permissions-Policy | Disables unused features | `geolocation=(), microphone=(), camera=()` |

### Configuration

Configure via environment variables:

```bash
# Disable headers (development only - never in production!)
export SECURITY_HEADERS_ENABLED=false

# Custom CSP policy
export CSP_POLICY="default-src 'self'; script-src 'self' 'unsafe-inline';"

# Frame options (SAMEORIGIN required for Reddit embedding)
export X_FRAME_OPTIONS=SAMEORIGIN

# Referrer policy
export REFERRER_POLICY=strict-origin-when-cross-origin
```

See [docs/security-headers.md](docs/security-headers.md) for complete configuration options.

## Request Validation

All API endpoints use Zod-based validation to ensure data integrity and prevent injection attacks.

### Validation Features

- **Type Safety**: Strong typing with TypeScript and Zod
- **Input Sanitization**: Automatic trimming and XSS prevention
- **Length Limits**: Enforced maximum lengths on all string inputs
- **Format Validation**: UUID, username patterns, etc.
- **Error Messages**: Clear, actionable validation errors

Validation schemas are defined in `src/server/validation/schemas.ts`.

## Rate Limiting

Rate limiting is implemented to prevent abuse and ensure fair usage.

### Rate Limits

- **Challenge Creation**: 1 challenge per 24 hours per user
- **API Requests**: Configurable per-endpoint limits
- **Attempt Submission**: Reasonable limits to prevent spam

## Data Security

### Database Security

- **Supabase**: Managed PostgreSQL with built-in security features
- **Row-Level Security**: Enforced at database level
- **Parameterized Queries**: Prevents SQL injection
- **Connection Pooling**: Secure connection management

### API Keys

- **Environment Variables**: All API keys stored in environment variables
- **Never Committed**: API keys never committed to version control
- **Rotation**: Regular key rotation recommended

### User Data

- **Minimal Collection**: Only collect necessary user data
- **Reddit IDs**: Use Reddit user IDs, no PII stored
- **Public Data**: All user data is public (leaderboard, profiles)

## AI Security

### Google Gemini API

- **API Key Security**: Stored in environment variables
- **Rate Limiting**: Respects Gemini API rate limits
- **Fallback**: Graceful degradation to exact matching if AI unavailable
- **Input Validation**: All inputs validated before sending to AI

## Devvit Platform Security

### Platform Features

- **HTTPS**: All traffic encrypted via Devvit platform
- **Authentication**: Reddit OAuth handled by Devvit
- **Sandboxing**: App runs in isolated Devvit environment
- **Content Policy**: Follows Reddit's content policy

### Best Practices

- **No Secrets in Code**: All secrets in environment variables
- **Minimal Permissions**: Request only necessary permissions
- **Error Handling**: Never expose sensitive info in errors
- **Logging**: Structured logging without sensitive data

## Security Testing

### Automated Tests

```bash
# Run all security-related tests
npm test -- security

# Run security header tests
npm test -- security-headers

# Run validation tests
npm test -- validation

# Run property-based tests
npm test -- property.test
```

### Manual Testing

1. **Security Headers**: Use [SecurityHeaders.com](https://securityheaders.com)
2. **CSP Policy**: Use [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
3. **Overall Security**: Use [Mozilla Observatory](https://observatory.mozilla.org)

## Security Checklist

### Development

- [ ] Security headers enabled
- [ ] Request validation implemented
- [ ] Rate limiting configured
- [ ] API keys in environment variables
- [ ] Error messages don't expose sensitive info
- [ ] Tests passing

### Pre-Deployment

- [ ] Security headers verified with curl/DevTools
- [ ] All tests passing (including property-based tests)
- [ ] API keys configured in Devvit settings
- [ ] Rate limits set to production values
- [ ] Security scan with online tools
- [ ] Code review completed

### Production

- [ ] Security headers active (verify with SecurityHeaders.com)
- [ ] HTTPS enforced
- [ ] Rate limiting active
- [ ] Monitoring and alerting configured
- [ ] Regular security audits scheduled
- [ ] Incident response plan documented

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow reasonable time for a fix before public disclosure

## Security Resources

### External Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [Devvit Security Best Practices](https://developers.reddit.com/docs/security)

### Tools

- [SecurityHeaders.com](https://securityheaders.com) - Header scanner
- [Mozilla Observatory](https://observatory.mozilla.org) - Security analysis
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) - CSP analyzer

## Changelog

### Version 1.0.0
- Implemented comprehensive security headers
- Added request validation with Zod
- Implemented rate limiting
- Added security documentation
- Added automated security tests
