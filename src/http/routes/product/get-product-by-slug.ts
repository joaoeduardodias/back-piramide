import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const productSlugParamsSchema = z.object({
  slug: z.string().min(1),
})

export async function getProductBySlug(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/product/:slug',
    {
      schema: {
        tags: ['Products'],
        summary: 'Get product by Slug',
        params: productSlugParamsSchema,
        response: {
          200: z.object({
            product: z.object({
              id: z.uuid(),
              name: z.string(),
              description: z.string().nullable(),
              featured: z.boolean(),
              price: z.number(),
              comparePrice: z.number().nullable(),
              weight: z.number().nullable(),
              brand: z.string(),
              images: z.array(z.object({
                id: z.uuid(),
                url: z.string(),
                alt: z.string().nullable(),
                fileKey: z.string().nullable(),
                sortOrder: z.number(),
              })),
              variants: z.array(z.object({
                id: z.uuid(),
                sku: z.string(),
                price: z.number().nullable(),
                comparePrice: z.number().nullable(),
                stock: z.number(),
                optionValues: z.array(z.object({
                  id: z.uuid(),
                  optionValueId: z.uuid(),
                })),
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
              categories: z.array(z.object({
                category: z.object({
                  id: z.uuid(),
                  slug: z.string(),
                  name: z.string(),
                }),
              })),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params

      const existing = await prisma.product.findUnique({ where: { slug } })
      if (!existing) {
        throw new BadRequestError('Produto não encontrado.')
      }

      try {
        const product = await prisma.product.findUniqueOrThrow({
          where: { slug },
          select: {
            id: true,
            name: true,
            description: true,
            featured: true,
            price: true,
            comparePrice: true,
            weight: true,
            brand: { select: { name: true } },
            images: {
              select: {
                id: true,
                url: true,
                alt: true,
                fileKey: true,
                sortOrder: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
            categories: {
              select: {
                category: {
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                  },
                },
              },
            },
            variants: {
              select: {
                id: true,
                sku: true,
                price: true,
                comparePrice: true,
                stock: true,
                optionValues: {
                  select: {
                    id: true,
                    optionValueId: true,
                  },
                },
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
                          some: { productOption: { productId: existing.id } },
                        },
                      },
                      select: { id: true, value: true, content: true },
                    },
                  },
                },
              },
              where: { productId: existing.id },
            },
          },
        })
        const formatted = {
          id: product.id,
          name: product.name,
          description: product.description,
          featured: product.featured ?? false,
          price: product.price,
          comparePrice: product.comparePrice,
          weight: product.weight,
          brand: product.brand?.name ?? '',
          images: product.images.map(img => ({
            id: img.id,
            url: img.url,
            alt: img.alt,
            fileKey: img.fileKey,
            sortOrder: img.sortOrder,
          })),
          variants: product.variants.map(v => ({
            id: v.id,
            sku: v.sku,
            price: v.price,
            comparePrice: v.comparePrice,
            stock: v.stock,
            optionValues: v.optionValues.map(ov => ({
              id: ov.id,
              optionValueId: ov.optionValueId,
            })),
          })),
          options: product.productOptions.map(po => ({
            id: po.option.id,
            name: po.option.name,
            values: po.option.values.map(val => ({
              id: val.id,
              value: val.value,
              content: val.content,
            })),
          })),
          categories: product.categories,
        }

        return reply.status(200).send({ product: formatted })
      } catch (err) {
        console.error('Erro ao buscar produto:', err)
        throw new BadRequestError('Falha ao buscar produto.')
      }
    },
  )
}
