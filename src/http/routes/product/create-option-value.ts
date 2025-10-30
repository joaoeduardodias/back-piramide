import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const createOptionSchema = z.object({
  optionName: z.string('Name is required.'),
  values: z.array(z.object({
    content: z.string().nullable().optional(),
    value: z.string('Value is required.'),
  })),
})

export async function createOptionValue(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/options/values',
    {
      schema: {
        tags: ['Products'],
        summary: 'Create option values',
        body: createOptionSchema,
        security: [{ bearerAuth: [] }],
        response: {
          201: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { optionName, values } = request.body

      const existingOption = await prisma.option.findUnique({
        where: { name: optionName },
      })

      if (!existingOption) {
        throw new BadRequestError('Opção não encontrada.')
      }

      const dataToCreate = values.map(item => ({
        ...item,
        content: item.content || null,
        optionId: existingOption.id,
      }))

      try {
        await prisma.optionValue.createMany({
          data: dataToCreate,
          skipDuplicates: true,
        })

        return reply.send()
      } catch {
        throw new BadRequestError('Falha ao criar valores da opção.')
      }
    },
  )
}
