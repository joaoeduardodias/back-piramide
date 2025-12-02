import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

export async function getProfile(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get('/profile', {
    schema: {
      tags: ['Auth'],
      summary: 'Get authenticated user profile.',
      security: [
        { bearerAuth: [] },
      ],
      response: {
        200: z.object({
          user: z.object({
            id: z.uuid(),
            name: z.string().nullable(),
            email: z.email(),
            phone: z.string().nullable(),
            cpf: z.string().nullable(),
            role: z.enum(Role),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const userId = await request.getCurrentUserId()
    const user = await prisma.user.findUnique({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        cpf: true,
      },
      where: {
        id: userId.sub,
      },
    })
    if (!user) {
      throw new Error('User not found.')
    }
    return reply.send({ user })
  })
}
