import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { auth } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'

const createHeroSlideSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  description: z.string().min(1),
  image: z.string().min(1),
  cta: z.string().min(1),
  link: z.string().min(1),
  order: z.number().int().min(0),
  isActive: z.boolean().optional(),
})

export async function createHeroSlide(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).post('/hero-slide',
    {
      schema: {
        tags: ['Hero'],
        summary: 'Create Hero Slide',
        body: createHeroSlideSchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          201: z.object({
            heroSlideId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const {
        cta,
        description,
        image,
        link,
        order,
        subtitle,
        title,
        isActive = true,
      } = request.body

      try {
        const slide = await prisma.heroSlide.create({
          data: {
            cta,
            description,
            image,
            link,
            order,
            subtitle,
            title,
            isActive,

          },
        })

        return reply.status(201).send({
          heroSlideId: slide.id,
        })
      } catch {
        throw new BadRequestError('Falha ao criar slide.')
      }
    },
  )
}
