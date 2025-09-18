import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const productIdParamsSchema = z.object({
  id: z.uuid('Invalid product ID'),
})

export async function deleteProduct(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete('/products/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Delete an product',
        params: productIdParamsSchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          204: z.null(),
        },
      },

    },
    async (request, reply) => {
      const { id } = request.params

      const existingProduct = await prisma.product.findUnique({
        where: { id },
      })

      if (!existingProduct) {
        throw new BadRequestError('Product not found.')
      }

      try {
        await prisma.product.delete({
          where: { id },
        })

        return reply.status(204).send()
      } catch {
        throw new BadRequestError('Failed to delete product.')
      }
    },
  )
}
