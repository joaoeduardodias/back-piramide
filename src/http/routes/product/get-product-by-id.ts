import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const productIdParamsSchema = z.object({
  id: z.uuid('Invalid product ID format'),
})

const productResponseSchema = z.object({
  product: z.object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    price: z.instanceof(Decimal),
    weight: z.number().nullable(),
    variants: z.array(z.object({
      id: z.uuid(),
      price: z.instanceof(Decimal).nullable(),
      sku: z.string(),
      stock: z.number(),
      comparePrice: z.instanceof(Decimal).nullable(),
    })),

    productOptions: z.array(z.object({
      option: z.object({
        id: z.uuid(),
        name: z.string(),
        values: z.array(z.object({
          value: z.string(),
          content: z.string().nullable(),
        })),
      }),
    })),
    images: z.array(z.object({
      id: z.uuid(),
      url: z.string(),
      alt: z.string().nullable(),
      fileKey: z.string().nullable(),
      sortOrder: z.number(),
    })),
    featured: z.boolean().nullable(),
    comparePrice: z.instanceof(Decimal).nullable(),
  }),
})

export async function getProductById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/products/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Get product by ID',
        params: productIdParamsSchema,
        response: {
          200: productResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params

      const existingProduct = await prisma.product.findUnique({
        where: { id },
      })
      if (!existingProduct) {
        throw new BadRequestError('Produto não encontrado.')
      }

      try {
        const product = await prisma.product.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            comparePrice: true,
            featured: true,
            weight: true,
            variants: {
              select: {
                stock: true,
                price: true,
                comparePrice: true,
                id: true,
                sku: true,
              },
            },
            productOptions: {
              select: {
                option: {
                  select: {
                    id: true,
                    name: true,
                    values: {
                      select: {
                        content: true,
                        value: true,
                      },
                    },
                  },
                },
              },
            },
            images: {
              select: {
                alt: true,
                fileKey: true,
                id: true,
                url: true,
                sortOrder: true,
              },
            },
          },

        })

        return reply.send({ product })
      } catch (err) {
        console.log(err)
        throw new BadRequestError('Failed to fetch product.')
      }
    },
  )
}
