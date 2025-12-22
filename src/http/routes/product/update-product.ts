/* eslint-disable @stylistic/max-len */

import { prisma } from '@/lib/prisma'
import { ProductStatus } from '@/prisma/generated/enums'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const updateProductSchema = z.object({
  name: z.string().min(1).nullish(),
  slug: z.string().min(1).nullish(),
  description: z.string().nullish(),
  tags: z.string().nullish(),
  featured: z.boolean().nullish(),
  price: z.number().positive().nullish(),
  comparePrice: z.number().nullish(),
  weight: z.number().positive().nullish(),
  status: z.enum(ProductStatus).nullish(),
  brandId: z.uuid().nullish(),
  categoryIds: z.array(z.uuid()).nullish(),
  images: z.array(z.object({
    id: z.uuid().nullish(),
    url: z.string().url(),
    alt: z.string().nullish(),
    sortOrder: z.number().int().min(0).default(0),
    fileKey: z.string().nullish(),
  })).nullish(),
  options: z.array(z.object({
    name: z.string(),
    values: z.array(z.object({
      id: z.uuid(),
      value: z.string(),
      content: z.string().nullish(),
    })),
  })).nullish(),
  variants: z.array(z.object({
    id: z.uuid().nullish(),
    sku: z.string(),
    price: z.number().nullish(),
    comparePrice: z.number().nullish(),
    stock: z.number().int().default(0),
    optionValueIds: z.array(z.uuid()).nullish(),
  })).nullish(),
})

export async function updateProduct(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/products/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Update a product',
        params: z.object({ id: z.uuid() }),
        body: updateProductSchema,
        response: { 200: z.object({ productId: z.uuid() }) },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const body = request.body

      const existingProduct = await prisma.product.findUnique({
        where: { id },
        include: {
          categories: true,
          variants: { include: { optionValues: true } },
          productOptions: { include: { values: true } },
        },
      })

      if (!existingProduct) {
        throw new BadRequestError('Produto não encontrado.')
      }

      if (body.categoryIds) {
        const cats = await prisma.category.findMany({
          where: { id: { in: body.categoryIds } },
        })
        if (cats.length !== body.categoryIds.length) {
          throw new BadRequestError('Uma ou mais categorias informadas não existem.')
        }
      }

      try {
        const updated = await prisma.$transaction(async (tx) => {
          const pr = await tx.product.update({
            where: { id },
            data: {
              ...(body.name && { name: body.name }),
              ...(body.slug && { slug: body.slug }),
              ...(body.description && { description: body.description }),
              ...(body.tags && { tags: body.tags }),
              ...(body.featured && { featured: body.featured }),
              ...(body.price && { price: body.price }),
              ...(body.comparePrice === 0 || body.comparePrice === null || body.comparePrice === undefined
                ? { comparePrice: null }
                : { comparePrice: body.comparePrice }),
              ...(body.weight === 0 || body.weight === null || body.weight === undefined
                ? { weight: null }
                : { weight: body.weight }),
              ...(body.brandId && { brandId: body.brandId }),
            },
          })

          if (body.categoryIds) {
            const existingCatIds = existingProduct.categories.map((c) => c.categoryId)
            const toAdd = body.categoryIds.filter((cid) => !existingCatIds.includes(cid))
            const toRemove = existingCatIds.filter((cid) => !body.categoryIds!.includes(cid))

            if (toAdd.length > 0) {
              await tx.productCategory.createMany({
                data: toAdd.map((categoryId) => ({
                  productId: id,
                  categoryId,
                })),
                skipDuplicates: true,
              })
            }
            if (toRemove.length > 0) {
              await tx.productCategory.deleteMany({
                where: {
                  productId: id,
                  categoryId: { in: toRemove },
                },
              })
            }
          }

          if (body.options) {
            for (const opt of body.options) {
              const optDb = await tx.option.findUnique({ where: { name: opt.name } })
              if (!optDb) throw new BadRequestError(`Opção "${opt.name}" inválida.`)

              const prodOpt = await tx.productOption.upsert({
                where: { productId_optionId: { productId: id, optionId: optDb.id } },
                create: { productId: id, optionId: optDb.id },
                update: {},
              })

              for (const v of opt.values) {
                const ov = await tx.optionValue.findUnique({ where: { id: v.id } })
                if (!ov) throw new BadRequestError(`OptionValue id "${v.id}" inválido.`)

                await tx.productOptionValue.upsert({
                  where: { productOptionId_optionValueId: { productOptionId: prodOpt.id, optionValueId: ov.id } },
                  create: { productOptionId: prodOpt.id, optionValueId: ov.id },
                  update: {},
                })
              }
            }
          }

          if (body.variants) {
            const incomingIds = body.variants.filter((v) => v.id).map((v) => v.id!)
            const toDelete = existingProduct.variants.filter((v) => !incomingIds.includes(v.id))
            if (toDelete.length) {
              await tx.productVariant.deleteMany({
                where: { id: { in: toDelete.map((v) => v.id) } },
              })
            }

            for (const v of body.variants) {
              if (v.id) {
                await tx.productVariant.update({
                  where: { id: v.id },
                  data: {
                    sku: v.sku,
                    price: v.price ?? null,
                    comparePrice: v.comparePrice ?? null,
                    stock: v.stock ?? 0,
                  },
                })
                await tx.variantOptionValue.deleteMany({ where: { variantId: v.id } })
                if (v.optionValueIds) {
                  for (const ovId of v.optionValueIds) {
                    await tx.variantOptionValue.create({
                      data: { variantId: v.id, optionValueId: ovId },
                    })
                  }
                }
              } else {
                const newVar = await tx.productVariant.create({
                  data: {
                    productId: id,
                    sku: v.sku,
                    price: v.price ?? null,
                    comparePrice: v.comparePrice ?? null,
                    stock: v.stock ?? 0,
                  },
                })
                if (v.optionValueIds) {
                  for (const ovId of v.optionValueIds) {
                    await tx.variantOptionValue.create({
                      data: { variantId: newVar.id, optionValueId: ovId },
                    })
                  }
                }
              }
            }
          }

          return pr
        })

        return reply.status(200).send({ productId: updated.id })
      } catch (err) {
        console.error('Erro ao atualizar produto:', err)
        throw new BadRequestError('Falha ao atualizar produto.')
      }
    },
  )
}
