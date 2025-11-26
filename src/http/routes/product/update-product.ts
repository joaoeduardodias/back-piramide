/* eslint-disable @stylistic/max-len */
import { prisma } from '@/lib/prisma'
import { ProductStatus } from '@prisma/client'
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
    url: z.url(),
    alt: z.string().nullish(),
    sortOrder: z.number().int().min(0).default(0),
    fileKey: z.string().nullish(),
  })).nullish(),
  options: z.array(z.object({
    name: z.string(),
    values: z.array(z.object({
      id: z.uuid(),
      value: z.string(),
      content: z.string().nullish().nullable(),
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
  app.withTypeProvider<ZodTypeProvider>().put('/products/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Update a product',
        body: updateProductSchema,
        params: z.object({
          id: z.uuid(),
        }),
        response: {
          200: z.object({
            productId: z.uuid(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const {
        name,
        slug,
        description,
        tags,
        featured,
        price,
        comparePrice,
        weight,
        brandId,
        categoryIds,
        options,
        variants,
      } = request.body
      const existingProduct = await prisma.product.findUnique({
        where: { id },
        include: {
          images: true,
          categories: true,
          variants: { include: { optionValues: true } },
          productOptions: {
            include: {
              option: true,
              values: true,
            },
          },
        },
      })

      if (!existingProduct) {
        throw new BadRequestError('Produto não encontrado.')
      }

      if (categoryIds?.length) {
        const categories = await prisma.category.findMany({
          where: { id: { in: categoryIds } },
        })
        if (categories.length !== categoryIds.length) {
          throw new BadRequestError('Uma ou mais categorias não existem.')
        }
      }

      try {
        const product = await prisma.$transaction(async (tx) => {
          const updatedProduct = await tx.product.update({
            where: { id },
            data: {
              ...(name && { name }),
              ...(slug && { slug }),
              ...(brandId && { brandId }),
              ...(description && { description }),
              ...(tags && { tags }),
              ...(featured && { featured }),
              ...(price && { price }),
              ...(comparePrice === 0 || comparePrice === null || comparePrice === undefined
                ? { comparePrice: null }
                : { comparePrice }),
              ...(weight && { weight }),
              // ...(status && { status }),
            },
          })

          if (categoryIds) {
            const existingCategoryIds = existingProduct.categories
              .map(c => c.categoryId)
            const toAdd = categoryIds.filter(id => !existingCategoryIds
              .includes(id))
            const toRemove = existingCategoryIds
              .filter(id => !categoryIds.includes(id))

            if (toAdd.length) {
              await tx.productCategory.createMany({
                data: toAdd.map(categoryId => ({ productId: id, categoryId })),
              })
            }

            if (toRemove.length) {
              await tx.productCategory.deleteMany({
                where: { productId: id, categoryId: { in: toRemove } },
              })
            }
          }

          if (variants) {
            const existingVariants = existingProduct.variants
            const incomingVariantIds = variants.filter(v => v.id)
              .map(v => v.id!)
            const toDelete = existingVariants.filter(v => !incomingVariantIds
              .includes(v.id))

            if (toDelete.length) {
              await tx.productVariant.deleteMany({
                where: { id: { in: toDelete.map(v => v.id) } },
              })
            }

            for (const variant of variants) {
              if (variant.id) {
                await tx.productVariant.update({
                  where: { id: variant.id },
                  data: {
                    sku: variant.sku,
                    price: variant.price ?? null,
                    comparePrice: variant.comparePrice ?? null,
                    stock: variant.stock ?? 0,
                  },
                })
              } else {
                await tx.productVariant.create({
                  data: {
                    productId: id,
                    sku: variant.sku,
                    price: variant.price ?? null,
                    comparePrice: variant.comparePrice ?? null,
                    stock: variant.stock ?? 0,
                  },
                })
              }
            }
          }

          const chunk = <T>(arr: T[], size = 500): T[][] =>
            Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
              arr.slice(i * size, i * size + size),
            )

          if (options && options.length > 0) {
            // 1) nomes únicos e válidos
            const incomingNames = Array.from(
              new Set(options.map((o) => o?.name).filter(Boolean)),
            )

            if (incomingNames.length > 0) {
              // 2) buscar todas as options de uma vez
              const existingOptions = await tx.option.findMany({
                where: { name: { in: incomingNames } },
                select: { id: true, name: true },
              })

              if (existingOptions.length > 0) {
                // maps para lookup
                const optionNameToId = new Map(existingOptions.map((o) => [o.name, o.id]))
                const existingOptionIds = existingOptions.map((o) => o.id)

                // 3) preparar productOption creates (data para createMany)
                const productOptionCreates = existingOptionIds.map((optionId) => ({
                  productId: id,
                  optionId,
                }))

                // 4) criar productOption em batches sequenciais (sem for) usando reduce -> encadeia promises
                const poBatches = chunk(productOptionCreates, 500)
                await poBatches.reduce<Promise<void>>((prev, batch) => {
                  return prev.then(() =>
                    tx.productOption.createMany({ data: batch, skipDuplicates: true }).then(() => { }),
                  )
                }, Promise.resolve())

                // 5) buscar productOptions para obter ids
                const productOptions = await tx.productOption.findMany({
                  where: {
                    productId: id,
                    optionId: { in: existingOptionIds },
                  },
                  select: { id: true, optionId: true },
                })

                const optionIdToProductOptionId = new Map(
                  productOptions.map((po) => [po.optionId, po.id]),
                )

                // 6) construir lista de pares (productOptionId, optionValueId) usando flatMap / map (sem for)
                const povCreatesAll = options
                  .map((opt) => {
                    const optionId = optionNameToId.get(opt.name)
                    if (!optionId) return [] // option inexistente
                    const productOptionId = optionIdToProductOptionId.get(optionId)
                    if (!productOptionId) return [] // sem productOptionId encontrado
                    return (Array.isArray(opt.values)
                      ? opt.values
                      : [])
                      .filter(Boolean)
                      .map((v) => (v && v.id
                        ? { productOptionId, optionValueId: v.id }
                        : null))
                      .filter(Boolean) as { productOptionId: string; optionValueId: string }[]
                  })
                  .flat()

                if (povCreatesAll.length > 0) {
                  const uniqueMap = new Map<string, { productOptionId: string; optionValueId: string }>()
                  povCreatesAll.forEach((p) => {
                    const key = `${p.productOptionId}__${p.optionValueId}`
                    if (!uniqueMap.has(key)) uniqueMap.set(key, p)
                  })
                  const uniqueCreates = Array.from(uniqueMap.values())

                  // 8) criar productOptionValue em batches sequenciais (sem for)
                  const povBatches = chunk(uniqueCreates, 500)
                  await povBatches.reduce<Promise<void>>((prev, batch) => {
                    return prev.then(() =>
                      tx.productOptionValue
                        .createMany({
                          data: batch.map((b) => ({
                            productOptionId: b.productOptionId,
                            optionValueId: b.optionValueId,
                          })),
                          skipDuplicates: true,
                        })
                        .then(() => { }),
                    )
                  }, Promise.resolve())
                }
              }
            }
          }

          return updatedProduct
        })

        return reply.status(200).send({ productId: product.id })
      } catch (err) {
        console.error(err)
        throw new BadRequestError('Falha ao atualizar produto.')
      }
    },
  )
}
