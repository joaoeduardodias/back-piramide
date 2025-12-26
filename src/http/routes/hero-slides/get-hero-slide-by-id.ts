import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { auth } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'

const getSlideParams = z.object({
  id: z.uuid(),
})

export async function getHeroSlidesById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get(
    '/hero-slides/:id',
    {
      schema: {
        tags: ['Hero'],
        summary: 'List hero slides',
        params: getSlideParams,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: z.object({
            slide:
              z.object({
                id: z.uuid(),
                title: z.string(),
                subtitle: z.string(),
                description: z.string(),
                image: z.string(),
                cta: z.string(),
                link: z.string(),
                order: z.number(),
                isActive: z.boolean(),
              }),

          }),
        },
      },
    },
    async (request, response) => {
      const { id } = request.params

      const slide = await prisma.heroSlide.findUnique({
        select: {
          id: true,
          title: true,
          subtitle: true,
          description: true,
          image: true,
          cta: true,
          link: true,
          order: true,
          isActive: true,
        },
        where: {
          id,
        },

      })

      if (!slide) {
        throw new BadRequestError('Slide não encontrado')
      }

      return response.status(200).send({ slide })
    },
  )
}
