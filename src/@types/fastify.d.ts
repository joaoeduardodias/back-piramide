import type { Role } from '@/prisma/generated/enums'
import 'fastify'

declare module 'fastify' {
  export interface FastifyRequest {
    getCurrentUserId(): Promise<{ role: Role, sub: string }>
  }
}
