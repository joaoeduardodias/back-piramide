import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { auth } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'

const getSlideParams = z.object({
  id: z.uuid(),
})

export async function deleteHeroSlide(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth)
    .delete('/hero-slides/:id',
      {
        schema: {
          tags: ['Hero'],
          summary: 'Delete Hero Slide',
          params: getSlideParams,
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
        const exists = await prisma.heroSlide.findUnique({
          where: { id },
        })

        if (!exists) {
          throw new BadRequestError('Slide não encontrado.')
        }
        try {
          await prisma.heroSlide.delete({
            where: {
              id,
            },
          })

          return reply.status(204).send()
        } catch {
          throw new BadRequestError('Falha ao deletar slide.')
        }
      },
    )
}
