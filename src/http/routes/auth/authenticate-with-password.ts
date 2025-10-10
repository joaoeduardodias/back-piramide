import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

export async function authenticateWithPassword(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/sessions/password', {
    schema: {
      tags: ['Auth'],
      summary: 'Authenticate with e-mail & password.',
      body: z.object({
        email: z.email('Invalid email'),
        password: z.string().min(6,
          'Password must be at least 6 characters long'),
      }),
      response: {
        201: z.object({
          token: z.string(),
        }),
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body
    const userFromEmail = await prisma.user.findUnique({
      where: {
        email,
      },
    })
    if (!userFromEmail) {
      throw new BadRequestError('Email ou senha inválidos.')
    }
    if (userFromEmail.passwordHash === null) {
      throw new BadRequestError(
        'Usuário não possui conta local, Faça login com o Google.')
    }
    const isPasswordValid = await compare(
      password,
      userFromEmail.passwordHash,
    )
    if (!isPasswordValid) {
      throw new BadRequestError('Email ou senha inválidos.')
    }

    const token = await reply.jwtSign(
      {
        sub: userFromEmail.id,
        role: userFromEmail.role,
      },
      {
        sign: {
          expiresIn: '7d',
        },
      })

    return reply.status(201).send({ token })
  })
}
