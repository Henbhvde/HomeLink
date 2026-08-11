# Architecture Overview

- Frontend: React + TypeScript + Vite + Tailwind + React Router + TanStack Query + Shadcn UI
- Backend: Express + TypeScript + Prisma + PostgreSQL + Redis + RabbitMQ + Socket.io
- Pattern: feature-based frontend and modular monolith backend
- Security: JWT auth, role-based access, tenant-aware middleware
- Identity: Google OIDC first; Microsoft Entra ID and tenant IdP later ([ADR-001](./adr-001-identity-provider.md))
