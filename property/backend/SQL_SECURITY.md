# Raw SQL policy

- Prefer Prisma model methods.
- Raw SQL must use tagged `$queryRaw`/`$executeRaw`; `${...}` values are Prisma parameters.
- `$queryRawUnsafe`, `$executeRawUnsafe`, concatenated SQL, and user-controlled identifiers are forbidden.
- Every externally supplied body, query, and route parameter is validated by strict Zod schemas before database access.
