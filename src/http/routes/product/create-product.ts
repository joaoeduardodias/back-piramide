/* eslint-disable @stylistic/indent */
import { prisma } from '@/lib/prisma'
import { ProductStatus } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const createProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  tags: z.string().optional(),
  featured: z.boolean().default(false),
  price: z.number().positive(),
  comparePrice: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  status: z.enum(ProductStatus).default('DRAFT'),
  categoryIds: z.array(z.string().uuid()).optional(),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0),
  })).optional(),
  options: z.array(z.object({
    name: z.string(),
    values: z.array(z.string().min(1)),
  })).optional(),
  variants: z.array(z.object({
    sku: z.string().optional(),
    price: z.number().optional(),
    comparePrice: z.number().optional(),
    stock: z.number().int().default(0),
    optionValueIds: z.array(z.string().uuid()).optional(),
  })).optional(),
})

export async function createProduct(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/products',
    {
      schema: {
        tags: ['Products'],
        summary: 'Create product',
        body: createProductSchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          201: z.object({
            productId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const {
        name,
        slug,
        description,
        tags,
        featured,
        price,
        comparePrice,
        status,
        categoryIds,
        images,
        weight,
        options,
        variants,
      } = request.body

      const existingProduct = await prisma.product.findUnique({
        where: { slug },
      })

      if (existingProduct) {
        throw new BadRequestError('Já existe um produto com este slug.')
      }

      if (categoryIds && categoryIds.length > 0) {
        const categories = await prisma.category.findMany({
          where: { id: { in: categoryIds } },
        })

        if (categories.length !== categoryIds.length) {
          throw new BadRequestError('Uma ou mais categorias não existem.')
        }
      }

      try {
        const product = await prisma.$transaction(async (tx) => {
          const createdProduct = await tx.product.create({
            data: {
              name,
              slug,
              description,
              tags,
              featured,
              price,
              comparePrice,
              weight,
              status,
              categories: categoryIds
                ? {
                  create: categoryIds.map(categoryId => ({ categoryId })),
                }
                : undefined,
              images: images
                ? {
                  create: images.map(img => ({
                    url: img.url,
                    alt: img.alt,
                    sortOrder: img.sortOrder,
                  })),
                }
                : undefined,
              Option: options
                ? {
                  create: options.map(opt => ({
                    name: opt.name,
                    values: {
                      create: opt.values.map(value => ({ value })),
                    },
                  })),
                }
                : undefined,
              variants: variants
                ? {
                  create: variants.map(v => ({
                    sku: v.sku,
                    price: v.price,
                    comparePrice: v.comparePrice,
                    stock: v.stock,
                    optionValues: v.optionValueIds
                      ? {
                        create: v.optionValueIds
                          .map(id => ({ optionValueId: id })),
                      }
                      : undefined,
                  })),
                }
                : undefined,
            },
            include: {
              categories: true,
              images: true,
              variants: {
                include: {
                  optionValues: {
                    include: { optionValue: { include: { option: true } } },
                  },
                },
              },
              Option: {
                include: { values: true },
              },
            },
          })

          return createdProduct
        })

        return reply.status(201).send({
          productId: product.id,
        })
      } catch {
        throw new BadRequestError('Falha ao criar produto.')
      }
    },
  )
}
