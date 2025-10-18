/* eslint-disable @stylistic/max-len */
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
    content: z.array(z.string().min(1)).nullable(),
  })).optional(),
  variants: z.array(z.object({
    sku: z.string(),
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
        security: [{ bearerAuth: [] }],
        response: {
          201: z.object({
            productId: z.string().uuid(),
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
        weight,
        status,
        categoryIds,
        images,
        options,
      } = request.body

      const existingProduct = await prisma.product.findUnique({
        where: { slug },
      })

      if (existingProduct) { throw new BadRequestError('Já existe um produto com este Nome.') }

      if (categoryIds?.length) {
        const categories = await prisma.category.findMany({
          where: { id: { in: categoryIds } },
        })

        if (categories.length !== categoryIds.length) { throw new BadRequestError('Uma ou mais categorias não existem.') }
      }

      try {
        const product = await prisma.$transaction(async (tx) => {
          // 1️⃣ Cria o produto
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
              sales: 0,
              categories: categoryIds
                ? {
                  create: categoryIds.map(id => ({ categoryId: id })),
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
            },
          })

          // 2️⃣ Processa as options reutilizáveis
          if (options?.length) {
            for (const opt of options) {
              // verifica se a Option já existe
              let option = await tx.option.findUnique({
                where: { name: opt.name },
                include: { values: true },
              })

              if (!option) {
                // cria a Option com seus valores
                option = await tx.option.create({
                  data: {
                    name: opt.name,
                    values: {
                      create: opt.values.map((v, i) => ({
                        value: v,
                        content: opt.content?.[i] ?? null,
                      })),
                    },
                  },
                  include: { values: true },
                })
              } else {
                // adiciona apenas os valores que não existem
                const newValues = opt.values.filter(v => !option!.values.some(ev => ev.value === v))
                if (newValues.length) {
                  await tx.option.update({
                    where: { id: option.id },
                    data: {
                      values: {
                        create: newValues.map((v, i) => ({
                          value: v,
                          content: opt.content?.[i] ?? null,
                        })),
                      },
                    },
                  })
                }
              }

              // 3️⃣ Relaciona a Option existente ao produto
              await tx.productOption.upsert({
                where: {
                  productId_optionId: {
                    productId: createdProduct.id,
                    optionId: option.id,
                  },
                },
                create: {
                  productId: createdProduct.id,
                  optionId: option.id,
                },
                update: {},
              })
            }
          }

          return createdProduct
        })

        return reply.status(201).send({ productId: product.id })
      } catch (err) {
        console.error(err)
        throw new BadRequestError('Falha ao criar produto.')
      }
    },
  )
}
