# Security Assessment Report: Reptile Tracker Application

## Executive Summary

This security assessment examined the Reptile Tracker application located at `/home/chrto/Homelab/github/chrtol/home-cluster/apps/reptile-tracker`. The application is a FastAPI backend with React frontend for tracking reptile feeding schedules. The assessment identified **9 security issues** ranging from High to Low severity, along with **3 informational items** for best practice improvements.

---

## Critical Issues

**None identified**

---

## High Severity Issues

### H-1: JWT Token Exposed in URL Query Parameters
**Location:** `frontend/src/pages/AuthCallback.jsx:36`, `backend/app/routers/auth.py:36`

**Description:** The authentication flow passes JWT tokens via URL query parameters (`/auth/callback?token={access_token}`). This exposes sensitive tokens in:
- Browser history
- Server logs (access logs)
- Referrer headers if the user navigates to external sites
- Proxy server logs

**Risk:** Token theft through log files, browser history, or shoulder surfing.

**Recommendation:** Use secure cookie-based authentication or POST body for token exchange. Alternatively, use the authorization code flow properly without exposing tokens in URLs.

---

### H-2: Weak Secret Key in Development
**Location:** `docker-compose.yml:26`

**Description:** The docker-compose file contains a weak development secret key (`dev_secret_key_change_in_production`) that could be accidentally used in production.

**Risk:** If deployed to production, attackers could forge JWT tokens and gain unauthorized access.

**Recommendation:**
- Remove default secrets from docker-compose.yml
- Require secrets to be provided via environment variables
- Add validation to check for development secrets at startup

---

### H-3: Database Echo Mode Enabled
**Location:** `database.py:6`

**Description:** SQLAlchemy is configured with `echo=True`, which logs all SQL queries including potentially sensitive data.

**Risk:** Sensitive data exposure in logs, information disclosure.

**Recommendation:** Set `echo=False` or make it configurable via environment variable, enabled only in development.

---

## Medium Severity Issues

### M-1: Missing CSRF Protection
**Location:** `main.py:14-20`

**Description:** The application uses credentials and cookies but does not implement CSRF protection. While it uses bearer tokens (which are naturally CSRF-resistant), the `allow_credentials=True` CORS setting suggests cookie usage is intended.

**Risk:** Cross-Site Request Forgery attacks if cookies are used for authentication.

**Recommendation:** Implement CSRF protection using libraries like `fastapi-csrf-protect` or ensure cookies are never used for authentication (only bearer tokens).

---

### M-2: Missing Rate Limiting
**Location:** All API endpoints

**Description:** No rate limiting is implemented on authentication or API endpoints.

**Risk:**
- Brute force attacks on authentication
- API abuse and DoS attacks
- Resource exhaustion

**Recommendation:** Implement rate limiting using `slowapi` or similar middleware, especially on:
- Authentication endpoints (`/auth/login`, `/auth/callback`)
- Password-related endpoints
- Resource-intensive queries

---

### M-3: Insufficient Input Validation on Webhook URLs
**Location:** `notifications.py:8-47`

**Description:** User-provided webhook URLs are not validated before making HTTP requests. This could lead to SSRF (Server-Side Request Forgery) attacks.

**Risk:**
- Internal network scanning
- Access to internal services
- Metadata service exploitation (cloud environments)

**Recommendation:**
- Validate webhook URLs against an allowlist of domains
- Block requests to private IP ranges (RFC 1918)
- Block localhost and metadata service IPs (169.254.169.254)
- Implement timeout and connection limits

---

### M-4: Broad Exception Handling
**Location:** `auth.py:39`, `notifications.py:45`

**Description:** Multiple locations use broad `except Exception` handlers that could mask security-relevant errors.

**Risk:** Security issues may be hidden, making detection and debugging difficult.

**Recommendation:** Use specific exception types and log detailed error information securely (not to users).

---

## Low Severity Issues

### L-1: Missing Security Headers
**Location:** `nginx.conf:14-17`

**Description:** While basic security headers are present, several important headers are missing:
- `Content-Security-Policy` - prevents XSS and other injection attacks
- `Strict-Transport-Security` - enforces HTTPS
- `Referrer-Policy` - controls referrer information leakage
- `Permissions-Policy` - restricts browser features

**Risk:** Increased attack surface for XSS, clickjacking, and other client-side attacks.

**Recommendation:** Add comprehensive security headers:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

---

### L-2: JWT Token Long Expiration
**Location:** `auth.py:16`

**Description:** JWT tokens expire after 7 days, which is quite long for access tokens.

**Risk:** Increased window of opportunity if tokens are compromised.

**Recommendation:**
- Reduce access token lifetime to 15-60 minutes
- Implement refresh tokens for longer sessions
- Add token revocation mechanism

---

## Informational / Best Practices

### I-1: Deprecated `datetime.utcnow()`
**Location:** Multiple files (`auth.py:34`, `auth.py:82`, etc.)

**Description:** The code uses `datetime.utcnow()` which is deprecated in Python 3.12+.

**Recommendation:** Replace with `datetime.now(timezone.utc)` for future compatibility.

---

### I-2: No Database Migration Strategy Visible
**Location:** `database.py:17-19`

**Description:** The application uses `create_all()` for database initialization. While Alembic is installed, no migration files are visible in the directory structure.

**Recommendation:** Use Alembic migrations for database schema changes to ensure safe production deployments.

---

### I-3: Missing Logging and Monitoring
**Location:** Application-wide

**Description:** Limited security-relevant logging for:
- Failed authentication attempts
- Authorization failures
- Unusual access patterns
- Configuration changes

**Recommendation:** Implement structured logging with security event tracking for incident response and audit trails.

---

## Dependency Analysis

### Backend Dependencies (`requirements.txt`)
All dependencies appear to be recent versions. Notable items:
- ✅ FastAPI 0.115.0 (recent)
- ✅ SQLAlchemy 2.0.36 (recent, secure)
- ✅ Pydantic 2.9.2 (recent)
- ⚠️ python-jose 3.3.0 (last updated 2021, consider migrating to PyJWT)

### Frontend Dependencies (`package.json`)
All dependencies appear up-to-date:
- ✅ React 18.3.1
- ✅ Axios 1.7.7
- ✅ Vite 5.4.11

---

## Summary by Severity

| Severity | Count | Issues |
|----------|-------|--------|
| Critical | 0 | - |
| High | 3 | Token in URL, Weak secrets, SQL echo mode |
| Medium | 4 | Missing CSRF, No rate limiting, Webhook SSRF, Broad exceptions |
| Low | 2 | Missing headers, Long token expiry |
| Info | 3 | Deprecated datetime, Migrations, Logging |

---

## Prioritized Remediation Plan

1. **Immediate (High):**
   - Fix JWT token exposure in URLs (H-1)
   - Remove/secure default secrets (H-2)
   - Disable SQL echo mode (H-3)

2. **Short-term (Medium):**
   - Add CSRF protection (M-1)
   - Implement rate limiting (M-2)
   - Validate webhook URLs against SSRF (M-3)
   - Improve exception handling (M-4)

3. **Long-term (Low/Info):**
   - Add comprehensive security headers (L-1)
   - Reduce token expiration time (L-2)
   - Implement proper logging (I-3)
   - Update deprecated functions (I-1)

---

**Assessment Date:** 2025-10-10
**Methodology:** Static code analysis, configuration review, dependency analysis
**Scope:** Backend API, Frontend application, Docker configurations, Dependencies
