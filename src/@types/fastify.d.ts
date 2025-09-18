import type { Role } from '@prisma/client'
import 'fastify'

declare module 'fastify' {
  export interface FastifyRequest {
    getCurrentUserId(): Promise<{ role: Role, sub: string }>
  }
}
