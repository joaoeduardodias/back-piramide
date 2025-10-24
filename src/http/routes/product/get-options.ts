import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const optionsResponseSchema = z.object({
  options: z.array(z.object({
    id: z.uuid(),
    name: z.string(),
    values: z.array(z.object({
      id: z.uuid(),
      content: z.string().nullable(),
      value: z.string(),
    })),
  }),
  ),
})

export async function getAllOptions(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/options',
    {
      schema: {
        tags: ['Products'],
        summary: 'List all options',
        response: {
          200: optionsResponseSchema,
        },
      },
    },
    async (_, reply) => {
      try {
        const options = await prisma.option.findMany({
          select: {
            id: true,
            name: true,
            values: {
              select: {
                id: true,
                value: true,
                content: true,
              },
            },
          },
        })

        return reply.send({ options })
      } catch {
        throw new BadRequestError('Failed to fetch all options.')
      }
    },
  )
}
