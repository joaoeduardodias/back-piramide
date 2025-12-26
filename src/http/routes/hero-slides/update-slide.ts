import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { auth } from '../../middlewares/auth'
import { BadRequestError } from '../_errors/bad-request-error'

const updateHeroSlideSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  cta: z.string().min(1).optional(),
  link: z.string().min(1).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})
const getSlideParams = z.object({
  id: z.uuid(),
})

export async function updateHeroSlide(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth)
    .put('/hero-slides/:id',
      {
        schema: {
          tags: ['Hero'],
          summary: 'Update Hero Slide',
          params: getSlideParams,
          body: updateHeroSlideSchema,
          security: [
            { bearerAuth: [] },
          ],
          response: {
            204: z.null(),
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
        const { id } = request.params
        const exists = await prisma.heroSlide.findUnique({
          where: { id },
        })

        if (!exists) {
          throw new BadRequestError('Slide não encontrado.')
        }
        try {
          await prisma.heroSlide.update({
            where: {
              id,
            },
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

          return reply.status(204).send()
        } catch {
          throw new BadRequestError('Falha ao atualizar slide.')
        }
      },
    )
}
