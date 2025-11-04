import { prisma } from '@/lib/prisma'
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
    featured: z.boolean(),
    price: z.number(),
    comparePrice: z.number().nullable(),
    weight: z.number().nullable(),
    images: z.array(z.object({
      id: z.uuid(),
      url: z.string(),
      alt: z.string().nullable(),
      fileKey: z.string().nullable(),
      sortOrder: z.number(),
    })),
    variants: z.array(z.object({
      id: z.uuid(),
      price: z.number().nullable(),
      sku: z.string(),
      stock: z.number(),
      comparePrice: z.number().nullable(),
    })),
    brand: z.object({
      id: z.string(),
      name: z.string(),
    }),
    options: z.array(z.object({
      id: z.uuid(),
      name: z.string(),
      values: z.array(z.object({
        id: z.uuid(),
        value: z.string(),
        content: z.string().nullable(),
      })),
    })),
    categories: z.array(z.uuid()),
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
            brand: {
              select: {
                name: true,
                id: true,
              },
            },
            categories: {
              select: {
                category: {
                  select: {
                    id: true,
                  },
                },
              },
            },
            variants: {
              select: {
                id: true,
                sku: true,
                stock: true,
                price: true,
                comparePrice: true,
              },
            },
            productOptions: {
              select: {
                option: {
                  select: {
                    id: true,
                    name: true,
                    values: {
                      where: {
                        productOptionValue: {
                          some: {
                            productOption: {
                              productId: id,
                            },
                          },
                        },
                      },
                      select: {
                        id: true,
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

        const formattedProduct = {
          id: product.id,
          name: product.name,
          description: product.description,
          featured: product.featured ?? false,
          price: product.price,
          brand: product.brand!,
          comparePrice: product.comparePrice,
          weight: product.weight,
          images: product.images,
          variants: product.variants,
          categories: product.categories.map(category =>
            category.category.id,

          ),
          options: product.productOptions.map(option => {
            return {
              id: option.option.id,
              name: option.option.name,
              values: option.option.values,
            }
          }),
        }

        return reply.send({ product: formattedProduct })
      } catch (err) {
        console.log(err)
        throw new BadRequestError('Failed to fetch product.')
      }
    },
  )
}
