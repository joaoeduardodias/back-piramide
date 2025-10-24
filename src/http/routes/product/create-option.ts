import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const createOptionSchema = z.object({
  name: z.string('Name is required.'),
  values: z.array(z.object({
    content: z.string().nullable(),
    value: z.string('Value is required.'),
  })),
})

export async function createOption(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/options',
    {
      schema: {
        tags: ['Products'],
        summary: 'Create option',
        body: createOptionSchema,
        security: [{ bearerAuth: [] }],
        response: {
          201: z.object({
            optionId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, values } = request.body

      try {
        const option = await prisma.option.create({
          data: {
            name,
            values: {
              createMany: {
                data: values,
              },
            },
          },
        })

        return reply.send({ optionId: option.id })
      } catch {
        throw new BadRequestError('Failed to create option.')
      }
    },
  )
}
