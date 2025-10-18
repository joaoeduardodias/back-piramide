import { prisma } from '@/lib/prisma'
import { ProductStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const productIdParamsSchema = z.object({
  id: z.uuid('Invalid product ID format'),
})

const productResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  sales: z.number(),
  description: z.string().nullable(),
  price: z.instanceof(Decimal),
  status: z.enum(ProductStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  weight: z.number().nullable(),
  categories: z.array(
    z.object({
      categoryId: z.uuid(),
      productId: z.uuid(),
      category: z.object({
        id: z.uuid(),
        name: z.string(),
        slug: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    }),
  ),

  images: z.array(
    z.object({
      id: z.uuid(),
      url: z.string(),
      alt: z.string().nullable(),
      sortOrder: z.number().int(),
      productId: z.uuid(),
      createdAt: z.date(),
      optionValueId: z.string().uuid().nullable(),
    }),
  ),

  variants: z.array(
    z.object({
      id: z.uuid(),
      price: z.instanceof(Decimal).nullable(),
      sku: z.string().nullable(),
      stock: z.number(),
      productId: z.uuid(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
  ),
})

export async function getProductById(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/product/id/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Get product by ID',
        params: productIdParamsSchema,
        response: {
          // 200: productResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      try {
        const product = await prisma.product.findUnique({
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
                orderItems: true,
                price: true,
                comparePrice: true,
                id: true,
                sku: true,
                optionValues: {
                  select: {
                    id: true,
                    optionValue: {
                      select: {
                        option: true,
                      },
                    },
                  },
                },
              },
            },
            // options: {
            //   select: {
            //     name: true,
            //     values: true,
            //   },
            // },
          },
          // include: {
          //   categories: {
          //     include: {
          //       category: true,
          //     },
          //   },
          //   images: {
          //     orderBy: { sortOrder: 'asc' },
          //   },
          //   variants: {
          //     include: {
          //       optionValues: {
          //         include: {
          //           optionValue: {
          //             include: {
          //               option: true,
          //             },
          //           },
          //         },
          //       },
          //     },
          //   },
          //   options: {
          //     include: {
          //       values: true,
          //     },
          //   },
          // },
        })

        if (!product) {
          throw new BadRequestError('Product not found.')
        }

        return reply.send(product)
      } catch {
        throw new BadRequestError('Failed to fetch product.')
      }
    },
  )
}
