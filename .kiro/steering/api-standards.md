---
inclusion: fileMatch
fileMatchPattern: "apps/api/**/*"
---

# API Standards

## RESTful API Design Principles

### Resource Naming
- Use **nouns** for resource names, not verbs
- Use **plural nouns** for collections: `/patients`, `/queues`
- Use **kebab-case** for multi-word resources: `/queue-positions`, `/wait-times`
- Use **nested resources** for relationships: `/facilities/{id}/queues`

### HTTP Methods
- **GET**: Retrieve resources (safe, idempotent)
- **POST**: Create new resources (not idempotent)
- **PUT**: Update/replace entire resource (idempotent)
- **PATCH**: Partial resource updates (not idempotent)
- **DELETE**: Remove resources (idempotent)

### URL Patterns
```
GET    /api/v1/patients                    # Get all patients
POST   /api/v1/patients                    # Create new patient
GET    /api/v1/patients/{id}               # Get specific patient
PUT    /api/v1/patients/{id}               # Update patient
DELETE /api/v1/patients/{id}               # Delete patient

GET    /api/v1/facilities/{id}/queues      # Get queues for facility
POST   /api/v1/facilities/{id}/queues      # Create queue in facility
GET    /api/v1/queues/{id}/positions       # Get positions in queue
POST   /api/v1/queues/{id}/join            # Join specific queue
```

## Response Formats

### Success Responses
```typescript
// Single Resource
{
  "data": {
    "id": "123",
    "type": "patient",
    "attributes": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "meta": {
    "timestamp": "2025-08-30T10:30:00Z"
  }
}

// Collection
{
  "data": [
    {
      "id": "123",
      "type": "patient",
      "attributes": { ... }
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "perPage": 20,
    "totalPages": 8
  }
}
```

### Error Responses
```typescript
{
  "errors": [
    {
      "id": "unique-error-id",
      "status": "400",
      "code": "VALIDATION_ERROR",
      "title": "Validation Failed",
      "detail": "The email field is required",
      "source": {
        "pointer": "/data/attributes/email"
      }
    }
  ],
  "meta": {
    "timestamp": "2025-08-30T10:30:00Z",
    "requestId": "req-123-456"
  }
}
```

## HTTP Status Codes

### Success Codes
- **200 OK**: Successful GET, PUT, PATCH
- **201 Created**: Successful POST with resource creation
- **202 Accepted**: Request accepted for async processing
- **204 No Content**: Successful DELETE or update with no response body

### Client Error Codes
- **400 Bad Request**: Invalid request format or parameters
- **401 Unauthorized**: Authentication required or failed
- **403 Forbidden**: Authenticated but insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Resource conflict (e.g., duplicate creation)
- **422 Unprocessable Entity**: Validation errors
- **429 Too Many Requests**: Rate limiting triggered

### Server Error Codes
- **500 Internal Server Error**: Unexpected server error
- **502 Bad Gateway**: Upstream service unavailable
- **503 Service Unavailable**: Temporary service outage
- **504 Gateway Timeout**: Upstream service timeout

## Authentication & Authorization

### JWT Token Structure
```typescript
// JWT Header
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-id"
}

// JWT Payload
{
  "sub": "user-123",
  "iss": "healthcare-queue-system",
  "aud": ["api", "mobile-app"],
  "exp": 1693480800,
  "iat": 1693477200,
  "roles": ["patient", "staff"],
  "facility": "facility-456",
  "permissions": ["queue:join", "queue:view"]
}
```

### Authorization Header
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Role-Based Access Control (RBAC)
- **patient**: Basic queue operations
- **staff**: Queue management within facility
- **admin**: Full facility management
- **super_admin**: Multi-facility management

## Rate Limiting

### Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 750
X-RateLimit-Reset: 1693477200
Retry-After: 60
```

### Rate Limit Tiers
- **Anonymous**: 100 requests/hour
- **Authenticated Patient**: 1,000 requests/hour
- **Staff**: 5,000 requests/hour
- **Admin**: 10,000 requests/hour