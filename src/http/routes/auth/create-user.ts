import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { hash } from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'
export async function createUser(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/users',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Create user',
        body: z.object({
          name: z.string().min(1, 'Name is required'),
          email: z.email('Invalid e-mail format'),
          password: z.string().min(6,
            'Password must be at least 6 characters long'),
        }),
        response: {
          201: z.object({
            success: z.boolean(),
            message: z.string(),
            data: z.object({
              user: z.object({
                name: z.string().nullable(),
                email: z.email(),
                id: z.uuid(),
                role: z.enum(Role),
              }),
              token: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, email, password } = request.body
      const userWithSameEmail = await prisma.user.findUnique({
        where: { email },
      })

      if (userWithSameEmail) {
        throw new BadRequestError('Já existe um usuário com o mesmo e-mail.')
      }

      const passwordHash = await hash(password, 6)

      const user = await prisma.user.create({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        data: {
          name,
          email,
          passwordHash,
          role: 'CUSTOMER',
        },
      })
      const token = await reply.jwtSign(
        {
          sub: user.id,
          role: user.role,
        },
        {
          sign: {
            expiresIn: '7d',
          },
        })

      const responsePayload = {
        success: true,
        message: 'User created successfully',
        data: {
          user,
          token,
        },
      }

      return reply.status(201).send(responsePayload)
    })
}
