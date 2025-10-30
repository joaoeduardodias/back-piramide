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
  comparePrice: z.number().positive().nullable().optional(),
  weight: z.number().positive().optional(),
  status: z.enum(ProductStatus).default('DRAFT'),
  brandId: z.uuid(),
  categoryIds: z.array(z.uuid()).optional(),
  images: z.array(z.object({
    url: z.url(),
    alt: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0),
    fileKey: z.string().nullable(),
  })).optional(),
  options: z.array(z.object({
    name: z.string(),
    values: z.array(z.object({
      id: z.uuid(),
      value: z.string(),
      content: z.string().optional(),
    })),
  })),
  variants: z.array(z.object({
    sku: z.string(),
    price: z.number().optional(),
    comparePrice: z.number().optional(),
    stock: z.number().int().default(0),
    optionValueIds: z.array(z.uuid()).optional(),
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
        weight,
        status,
        categoryIds,
        images,
        variants,
        options,
        brandId,
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
              brandId,
              images: images?.length
                ? {
                  create: images.map((img) => ({
                    url: img.url,
                    alt: img.alt,
                    sortOrder: img.sortOrder,
                    fileKey: img.fileKey,
                  })),
                }
                : undefined,
            },
          })

          if (categoryIds?.length) {
            await tx.productCategory.createMany({
              data: categoryIds.map((categoryId) => ({
                productId: createdProduct.id,
                categoryId,
              })),
              skipDuplicates: true,
            })
          }

          if (variants?.length) {
            const createdVariants = await Promise.all(
              variants.map(async (variant) => {
                return tx.productVariant.create({
                  data: {
                    productId: createdProduct.id,
                    sku: variant.sku,
                    price: variant.price ?? null,
                    comparePrice: variant.comparePrice ?? null,
                    stock: variant.stock ?? 0,
                  },
                })
              }),
            )

            const variantOptionValuesData = createdVariants.flatMap((createdVariant, index) => {
              const variant = variants[index]
              if (!variant.optionValueIds?.length) return []

              return variant.optionValueIds.map((optionValueId: string) => ({
                variantId: createdVariant.id,
                optionValueId,
              }))
            })

            if (variantOptionValuesData.length) {
              await tx.variantOptionValue.createMany({
                data: variantOptionValuesData,
                skipDuplicates: true,
              })
            }
          }

          if (options && options.length > 0) {
            for (const opt of options) {
              const { name: optionName, values } = opt
              if (!values?.length) continue

              const option = await tx.option.findUnique({
                where: { name: optionName },
                select: { id: true },
              })

              if (!option) {
                console.warn(`Opção "${optionName}" não encontrada no banco.`)
                continue
              }

              const productOption = await tx.productOption.upsert({
                where: {
                  productId_optionId: {
                    productId: createdProduct.id,
                    optionId: option.id,
                  },
                },
                update: {},
                create: {
                  productId: createdProduct.id,
                  optionId: option.id,
                },
              })

              await Promise.all(
                values.map((v) =>
                  tx.productOptionValue.upsert({
                    where: {
                      productOptionId_optionValueId: {
                        productOptionId: productOption.id,
                        optionValueId: v.id,
                      },
                    },
                    create: {
                      productOptionId: productOption.id,
                      optionValueId: v.id,
                    },
                    update: {},
                  }),
                ),
              )
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
