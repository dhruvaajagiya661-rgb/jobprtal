# PortAL Real-Time Architecture & Roadmap

This document outlines the real-time implementation, measurable impact framework, and future scaling roadmap for the PortAL platform.

## 1. Real-Time Architecture

### Current Implementation
- **Infrastructure Stack**: Django Channels 4.x with Daphne ASGI server.
- **Protocol**: WebSockets (WS) for bidirectional real-time communication.
- **Channel Layer**: `InMemoryChannelLayer` (Development).
- **Latency**: Targeted <200ms end-to-end for local operations.

### Real-Time Features
1. **Real-Time Notifications**: Uses `post_save` signals on the `Notification` model to push updates to users immediately.
2. **One-to-One Chat**: Scalable WebSocket-based chat between students and recruiters.
3. **Live Admin Analytics**: Real-time dashboard for superusers tracking user registrations, job postings, and applications.

## 2. Measurable Impact Framework

### Key Performance Indicators (KPIs)
- **Engagement**: Monthly Active Users (MAU) and session duration.
- **Efficiency**: Reduction in "Time-to-Hire" (average time from job posting to accepted application).
- **User Satisfaction**: Real-time feedback loop and support response times.
- **Scalability**: System latency under high concurrent WebSocket connections.

### Real-Time Analytics Dashboard
Accessible at `/admin/analytics/` for superusers. It tracks:
- Total Users, Jobs, and Applications (Live Updates).
- Live Activity Stream (Audit Logs pushed via WebSockets).

## 3. Scalability & Sustainability Roadmap

### Phase 1: Production Hardening (Next 3 months)
- **Redis Integration**: Switch from `InMemoryChannelLayer` to `RedisChannelLayer` for multi-worker support.
- **Daphne/Gunicorn Split**: Deploy Daphne for WebSockets and Gunicorn for HTTP.
- **CDN Integration**: Use AWS CloudFront or Cloudflare for static assets and media.

### Phase 2: Edge & Global Scaling (Next 6-12 months)
- **Global Deployment**: Use AWS Global Accelerator or similar to route traffic to the nearest edge location.
- **Database Scaling**: Implement PostgreSQL Read Replicas for analytics-heavy queries.
- **Serverless Background Tasks**: Move heavy processing (e.g., resume parsing, bulk notifications) to AWS Lambda or Celery.

## 4. Testing & Iteration Plan

### Testing Strategy
- **Load Testing**: Use `Locust` to simulate 10,000+ concurrent WebSocket connections.
- **Chaos Testing**: Periodically disconnect Redis or Channel workers to verify system resilience.
- **UAT**: Regular feedback sessions with recruiters and students to refine chat and notification workflows.

## 5. Security & Compliance
- **Encryption**: All WebSocket traffic is served over WSS (WebSocket Secure).
- **RBAC**: Strict role-based access control on all consumers.
- **Privacy**: GDPR-compliant data handling for audit logs and chat history.
