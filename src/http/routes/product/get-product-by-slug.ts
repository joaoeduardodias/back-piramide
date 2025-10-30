import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const productSlugParamsSchema = z.object({
  slug: z.string('Slug is required'),
})

const productResponseSchema = z.object({
  product: z.object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    featured: z.boolean(),
    price: z.instanceof(Decimal),
    comparePrice: z.instanceof(Decimal).nullable(),
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
      price: z.instanceof(Decimal).nullable(),
      sku: z.string(),
      stock: z.number(),
      comparePrice: z.instanceof(Decimal).nullable(),
    })),
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

export async function getProductBySlug(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/product/:slug',
    {
      schema: {
        tags: ['Products'],
        summary: 'Get product by Slug',
        params: productSlugParamsSchema,
        response: {
          200: productResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params

      const existingProduct = await prisma.product.findUnique({
        where: { slug },
      })
      if (!existingProduct) {
        throw new BadRequestError('Produto não encontrado.')
      }

      try {
        const product = await prisma.product.findUniqueOrThrow({
          where: { slug },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            comparePrice: true,
            featured: true,
            weight: true,
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
                              productId: existingProduct.id,
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
