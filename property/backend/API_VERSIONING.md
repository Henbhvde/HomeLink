# API versioning

- Public domain/auth endpoints use `/api/v1/*`; `/health` and `/metrics` remain unversioned operational endpoints.
- Unversioned `/api/*` calls return 404 with migration guidance. Successful API responses include `API-Version: v1`.
- Breaking request/response or authentication changes require `/api/v2`; additive fields remain backward compatible.
- Announce deprecation with a migration guide and `Deprecation`/`Sunset` headers before removing a supported version.
