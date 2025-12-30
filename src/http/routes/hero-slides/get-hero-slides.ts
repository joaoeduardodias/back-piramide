import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { auth } from '../../middlewares/auth'

export async function getHeroSlides(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get(
    '/hero-slides',
    {
      schema: {
        tags: ['Hero'],
        summary: 'List hero slides',
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: z.object({
            slides: z.array(
              z.object({
                id: z.uuid(),
                title: z.string().nullish(),
                subtitle: z.string().nullish(),
                description: z.string().nullish(),
                image: z.string(),
                cta: z.string(),
                link: z.string(),
                order: z.number(),
                isActive: z.boolean(),
              }),
            ),
          }),
        },
      },
    },
    async (_, response) => {
      const slides = await prisma.heroSlide.findMany({
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
        orderBy: { order: 'asc' },
      })

      return response.status(200).send({ slides })
    },
  )
}
