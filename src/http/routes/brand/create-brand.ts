import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const createBrandSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
})

export async function createBrand(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/brand',
    {
      schema: {
        tags: ['Brand'],
        summary: 'Create brand',
        body: createBrandSchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          201: z.object({
            brandId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const {
        name,
        slug,
      } = request.body

      const existingBrand = await prisma.brand.findUnique({
        where: { slug },
      })

      if (existingBrand) {
        throw new BadRequestError('Já existe uma Marca com este slug.')
      }

      try {
        const brand = await prisma.brand.create({
          data: {
            name,
            slug,
          },
        })

        return reply.status(201).send({
          brandId: brand.id,
        })
      } catch {
        throw new BadRequestError('Falha ao criar marca.')
      }
    },
  )
}
