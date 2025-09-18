import type { Role } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import fastifyPlugin from 'fastify-plugin'
import { UnauthorizedError } from '../routes/_errors/unauthorized-error'

export const auth = fastifyPlugin(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (request) => {
    request.getCurrentUserId = async () => {
      try {
        const { sub, role } =
          await request.jwtVerify<{ sub: string, role: Role }>()
        return { sub, role }
      } catch {
        throw new UnauthorizedError('Invalid auth token.')
      }
    }
  })
})
