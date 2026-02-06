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
          const ensureProductOptionForValue = async (optionValueId: string) => {
            const ov = await tx.optionValue.findUnique({
              where: { id: optionValueId },
              select: { id: true, optionId: true },
            })
            if (!ov) throw new BadRequestError(`OptionValue id "${optionValueId}" inválido.`)

            const prodOpt = await tx.productOption.upsert({
              where: { productId_optionId: { productId: id, optionId: ov.optionId } },
              create: { productId: id, optionId: ov.optionId },
              update: {},
            })

            await tx.productOptionValue.upsert({
              where: { productOptionId_optionValueId: { productOptionId: prodOpt.id, optionValueId: ov.id } },
              create: { productOptionId: prodOpt.id, optionValueId: ov.id },
              update: {},
            })
          }

          const pr = await tx.product.update({
            where: { id },
            data: {
              ...(body.name && { name: body.name }),
              ...(body.slug && { slug: body.slug }),
              ...(body.description && { description: body.description }),
              ...(body.tags && { tags: body.tags }),
              ...(body.featured !== undefined && body.featured !== null && { featured: body.featured }),
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

          let allowedOptionValueIds: Set<string> | null = null
          let optionValueSets: Set<string>[] = []
          let optionsCount = 0
          const canUpsertProductOptions = Boolean(body.options)

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
            const optionValueIdsByOptionId = new Map<string, string[]>()
            const incomingOptionIds: string[] = []

            for (const opt of body.options) {
              const optDb = await tx.option.findUnique({ where: { name: opt.name } })
              if (!optDb) throw new BadRequestError(`Opção "${opt.name}" inválida.`)

              incomingOptionIds.push(optDb.id)
              const incomingValueIds = opt.values.map((v) => v.id)
              optionValueIdsByOptionId.set(optDb.id, incomingValueIds)

              if (incomingValueIds.length > 0) {
                const existingValues = await tx.optionValue.findMany({
                  where: { id: { in: incomingValueIds }, optionId: optDb.id },
                  select: { id: true },
                })
                if (existingValues.length !== incomingValueIds.length) {
                  throw new BadRequestError(`Uma ou mais values da opção "${opt.name}" são inválidas.`)
                }
              }
            }

            allowedOptionValueIds = new Set(
              body.options.flatMap((opt) => opt.values.map((v) => v.id)),
            )
            optionValueSets = body.options.map((opt) => new Set(opt.values.map((v) => v.id)))
            optionsCount = optionValueSets.length

            const existingOptionIds = existingProduct.productOptions.map((po) => po.optionId)
            const toRemoveOptionIds = existingOptionIds.filter((optId) => !incomingOptionIds.includes(optId))

            if (toRemoveOptionIds.length > 0) {
              await tx.variantOptionValue.deleteMany({
                where: {
                  variant: { productId: id },
                  optionValue: { optionId: { in: toRemoveOptionIds } },
                },
              })
              await tx.productOption.deleteMany({
                where: { productId: id, optionId: { in: toRemoveOptionIds } },
              })
            }

            for (const [optionId, incomingValueIds] of optionValueIdsByOptionId) {
              const prodOpt = await tx.productOption.upsert({
                where: { productId_optionId: { productId: id, optionId } },
                create: { productId: id, optionId },
                update: {},
              })

              const existingOpt = existingProduct.productOptions.find((po) => po.optionId === optionId)
              const existingValueIds = existingOpt
                ? existingOpt.values.map((v) => v.optionValueId)
                : []
              const removedValueIds = existingValueIds.filter((vId) => !incomingValueIds.includes(vId))

              if (removedValueIds.length > 0) {
                await tx.variantOptionValue.deleteMany({
                  where: { variant: { productId: id }, optionValueId: { in: removedValueIds } },
                })
              }

              if (incomingValueIds.length > 0) {
                await tx.productOptionValue.deleteMany({
                  where: { productOptionId: prodOpt.id, optionValueId: { notIn: incomingValueIds } },
                })
              } else {
                await tx.productOptionValue.deleteMany({
                  where: { productOptionId: prodOpt.id },
                })
              }

              for (const valueId of incomingValueIds) {
                await ensureProductOptionForValue(valueId)
              }
            }
          }

          if (body.variants) {
            const seenSkus = new Set<string>()
            for (const v of body.variants) {
              if (seenSkus.has(v.sku)) {
                throw new BadRequestError('SKU duplicado no payload de variantes.')
              }
              seenSkus.add(v.sku)
            }

            if (!body.options && existingProduct.productOptions.length > 0) {
              allowedOptionValueIds = new Set(
                existingProduct.productOptions.flatMap((po) => po.values.map((v) => v.optionValueId)),
              )
              optionValueSets = existingProduct.productOptions.map(
                (po) => new Set(po.values.map((v) => v.optionValueId)),
              )
              optionsCount = optionValueSets.length
            }

            const incomingIds: string[] = []
            for (const v of body.variants) {
              if (v.id) {
                incomingIds.push(v.id)
                continue
              }
              const existingBySku = await tx.productVariant.findFirst({
                where: { productId: id, sku: v.sku },
                select: { id: true },
              })
              if (existingBySku) {
                incomingIds.push(existingBySku.id)
              }
            }
            const toDelete = existingProduct.variants.filter((v) => !incomingIds.includes(v.id))
            if (toDelete.length) {
              await tx.productVariant.deleteMany({
                where: { id: { in: toDelete.map((v) => v.id) } },
              })
            }

            for (const v of body.variants) {
              const variantId = v.id ??
                (await tx.productVariant.findFirst({
                  where: { productId: id, sku: v.sku },
                  select: { id: true },
                }))?.id

              const skuConflict = await tx.productVariant.findFirst({
                where: {
                  sku: v.sku,
                  ...(variantId ? { NOT: { id: variantId } } : {}),
                },
                select: { id: true },
              })
              if (skuConflict) {
                throw new BadRequestError('SKU já existe para outra variante.')
              }

              if (!variantId && optionsCount > 0 && !v.optionValueIds) {
                throw new BadRequestError(
                  'O produto possui options, então novas variantes devem ter optionValueIds.',
                )
              }
              if (v.optionValueIds) {
                const uniqueIds = new Set(v.optionValueIds)
                if (uniqueIds.size !== v.optionValueIds.length) {
                  throw new BadRequestError('Uma variante possui optionValueIds duplicados.')
                }
                if (optionsCount === 0) {
                  throw new BadRequestError('As variantes possuem optionValueIds, mas o produto não possui options.')
                }
                if (v.optionValueIds.length !== optionsCount) {
                  throw new BadRequestError(
                    'Uma variante deve ter exatamente um optionValueId para cada option.',
                  )
                }
                if (allowedOptionValueIds) {
                  for (const ovId of v.optionValueIds) {
                    if (!allowedOptionValueIds.has(ovId)) {
                      throw new BadRequestError(
                        `OptionValue id "${ovId}" não pertence às options informadas para este produto.`,
                      )
                    }
                  }
                }
                for (const set of optionValueSets) {
                  let matches = 0
                  for (const ovId of v.optionValueIds) {
                    if (set.has(ovId)) matches += 1
                  }
                  if (matches !== 1) {
                    throw new BadRequestError(
                      'Uma variante deve ter exatamente um optionValueId de cada option.',
                    )
                  }
                }
              }
              const optionValueIds = v.optionValueIds
                ? (
                  allowedOptionValueIds
                    ? v.optionValueIds.filter((ovId) => allowedOptionValueIds!.has(ovId))
                    : v.optionValueIds
                )
                : v.optionValueIds

              if (variantId) {
                await tx.productVariant.update({
                  where: { id: variantId },
                  data: {
                    sku: v.sku,
                    price: v.price ?? null,
                    comparePrice: v.comparePrice ?? null,
                    stock: v.stock ?? 0,
                  },
                })
                if (optionValueIds) {
                  await tx.variantOptionValue.deleteMany({ where: { variantId } })
                  for (const ovId of optionValueIds) {
                    if (canUpsertProductOptions) {
                      await ensureProductOptionForValue(ovId)
                    }
                    await tx.variantOptionValue.create({
                      data: { variantId, optionValueId: ovId },
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
                if (optionValueIds) {
                  for (const ovId of optionValueIds) {
                    if (canUpsertProductOptions) {
                      await ensureProductOptionForValue(ovId)
                    }
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
