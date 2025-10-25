/* eslint-disable @stylistic/max-len */

import { prisma } from '@/lib/prisma'
import { ProductStatus } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  featured: z.boolean().optional(),
  price: z.number().positive().optional(),
  comparePrice: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  status: z.enum(ProductStatus).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  images: z.array(z.object({
    id: z.string().uuid().optional(),
    url: z.string().url(),
    alt: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0),
    fileKey: z.string().nullable().optional(),
  })).optional(),
  options: z.array(z.object({
    name: z.string(),
    values: z.array(z.object({
      id: z.string().uuid(),
      value: z.string(),
      content: z.string().optional().nullable(),
    })),
  })).optional(),
  variants: z.array(z.object({
    id: z.string().uuid().optional(),
    sku: z.string(),
    price: z.number().optional(),
    comparePrice: z.number().optional(),
    stock: z.number().int().default(0),
    optionValueIds: z.array(z.string().uuid()).optional(),
  })).optional(),
})

export async function updateProduct(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put('/products/:id',
    {
      schema: {
        tags: ['Products'],
        summary: 'Update product',
        body: updateProductSchema,
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({
            productId: z.string().uuid(),
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
        status,
        categoryIds,
        images,
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
              ...(description !== undefined && { description }),
              ...(tags !== undefined && { tags }),
              ...(featured !== undefined && { featured }),
              ...(price !== undefined && { price }),
              ...(comparePrice !== undefined && { comparePrice }),
              ...(weight !== undefined && { weight }),
              ...(status && { status }),
            },
          })

          if (categoryIds) {
            const existingCategoryIds = existingProduct.categories.map(c => c.categoryId)
            const toAdd = categoryIds.filter(id => !existingCategoryIds.includes(id))
            const toRemove = existingCategoryIds.filter(id => !categoryIds.includes(id))

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

          if (images) {
            const existingImages = existingProduct.images

            // Filtra imagens que precisam ser deletadas (não estão no novo array)
            const toDelete = existingImages.filter(eImg =>
              !images.some(iImg =>
                iImg.id === eImg.id ||
                (iImg.url === eImg.url &&
                  iImg.alt === eImg.alt &&
                  iImg.sortOrder === eImg.sortOrder &&
                  iImg.fileKey === eImg.fileKey),
              ),
            )

            if (toDelete.length) {
              await tx.productImage.deleteMany({
                where: { id: { in: toDelete.map(img => img.id) } },
              })
            }

            for (const img of images) {
              if (img.id) {
                // Atualiza apenas se os campos mudaram
                const existing = existingImages.find(e => e.id === img.id)
                if (
                  existing &&
                  (existing.url !== img.url ||
                    existing.alt !== img.alt ||
                    existing.sortOrder !== img.sortOrder ||
                    existing.fileKey !== img.fileKey)
                ) {
                  await tx.productImage.update({
                    where: { id: img.id },
                    data: {
                      url: img.url,
                      alt: img.alt,
                      sortOrder: img.sortOrder,
                      fileKey: img.fileKey,
                    },
                  })
                }
              } else {
                // Cria nova imagem
                await tx.productImage.create({
                  data: {
                    productId: id,
                    url: img.url,
                    alt: img.alt,
                    sortOrder: img.sortOrder,
                    fileKey: img.fileKey,
                  },
                })
              }
            }
          }

          // Atualizar variants
          if (variants) {
            const existingVariants = existingProduct.variants
            const incomingVariantIds = variants.filter(v => v.id).map(v => v.id!)
            const toDelete = existingVariants.filter(v => !incomingVariantIds.includes(v.id))

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

          // Atualizar opções e valores
          if (options && options.length > 0) {
            for (const opt of options) {
              const option = await tx.option.findUnique({
                where: { name: opt.name },
                select: { id: true },
              })

              if (!option) continue

              const productOption = await tx.productOption.upsert({
                where: {
                  productId_optionId: {
                    productId: id,
                    optionId: option.id,
                  },
                },
                update: {},
                create: {
                  productId: id,
                  optionId: option.id,
                },
              })

              for (const v of opt.values) {
                await tx.productOptionValue.upsert({
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
                })
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
