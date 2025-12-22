import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/prisma/generated/client'
import { Role } from '@/prisma/generated/enums'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

const getUsersQuerySchema = z.object({
  role: z.enum(Role).optional(),
})

export async function getUsers(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get('/users', {
    schema: {
      tags: ['Auth'],
      summary: 'Get users.',
      querystring: getUsersQuerySchema,
      security: [
        { bearerAuth: [] },
      ],
      response: {
        200: z.object({
          users: z.array(
            z.object({
              id: z.uuid(),
              name: z.string().nullable(),
              email: z.email(),
              phone: z.string().nullable(),
            }),
          ),
        }),
      },
    },
  }, async (request, reply) => {
    const role = request.query.role

    const where: Prisma.UserWhereInput = {}

    if (role) {
      where.role = role
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
      where,
    })

    return reply.send({ users })
  })
}
