import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const productSlugParamsSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
})

// const productResponseSchema = z.object({
//   id: z.uuid(),
//   name: z.string(),
//   slug: z.string(),
//   sales: z.number(),
//   description: z.string().nullable(),
//   price: z.instanceof(Decimal),
//   status: z.enum(ProductStatus),
//   createdAt: z.date(),
//   updatedAt: z.date(),
//   categories: z.array(
//     z.object({
//       categoryId: z.uuid(),
//       category: z.object({
//         id: z.uuid(),
//         name: z.string(),
//         slug: z.string(),
//         createdAt: z.date(),
//         updatedAt: z.date(),
//       }),
//     }),
//   ),
//   options: z.array(
//     z.object({
//       id: z.uuid(),
//       name: z.string(),
//       productId: z.uuid(),
//       values: z.array(
//         z.object({
//           id: z.uuid(),
//           value: z.string(),
//           optionId: z.uuid(),
//         }),
//       ),
//     }),
//   ),
//   images: z.array(
//     z.object({
//       id: z.uuid(),
//       url: z.string(),
//       alt: z.string().nullable(),
//       sortOrder: z.number().int(),
//       productId: z.uuid(),
//       createdAt: z.date(),
//       optionValueId: z.uuid().nullable(),
//     }),
//   ),
// })

export async function getProductBySlug(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/product/:slug',
    {
      schema: {
        tags: ['Products'],
        summary: 'Get product by slug',
        params: productSlugParamsSchema,
        response: {
          // 200: productResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params

      try {
        const product = await prisma.product.findUnique({
          where: { slug },
          include: {
            categories: {
              include: {
                category: true,
              },
            },
            images: {
              orderBy: { sortOrder: 'asc' },
            },

            productOptions: {
              include: {
                values: true,
              },
            },
          },
        })

        if (!product) {
          throw new BadRequestError('Product not found.')
        }

        return reply.send({ product })
      } catch {
        throw new BadRequestError('Failed to fetch product.')
      }
    },
  )
}
