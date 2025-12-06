/* eslint-disable @stylistic/max-len */

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
  status: z.enum(ProductStatus).default('PUBLISHED'),
  brandId: z.uuid(),
  categoryIds: z.array(z.uuid()).optional(),
  images: z.array(z.object({
    url: z.url(),
    alt: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0),
    fileKey: z.string(),
  })).optional(),
  options: z.array(z.object({
    name: z.string(),
    values: z.array(z.object({
      id: z.uuid(),
      value: z.string(),
      content: z.string().optional(),
    })),
  })).optional(),
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
      const body = request.body as z.infer<typeof createProductSchema>

      const existing = await prisma.product.findUnique({ where: { slug: body.slug } })
      if (existing) {
        throw new BadRequestError('Já existe um produto com este slug.')
      }
      if (body.categoryIds?.length) {
        const cats = await prisma.category.findMany({ where: { id: { in: body.categoryIds } } })
        if (cats.length !== body.categoryIds.length) {
          throw new BadRequestError('Uma ou mais categorias informadas não existem.')
        }
      }

      try {
        const createdProduct = await prisma.$transaction(async (tx) => {
          const prod = await tx.product.create({
            data: {
              name: body.name,
              slug: body.slug,
              description: body.description ?? null,
              tags: body.tags ?? null,
              featured: body.featured,
              price: body.price,
              comparePrice: body.comparePrice ?? null,
              weight: body.weight ?? null,
              status: body.status,
              sales: 0,
              brandId: body.brandId,
            },
          })

          if (body.categoryIds?.length) {
            await tx.productCategory.createMany({
              data: body.categoryIds.map((catId) => ({
                productId: prod.id,
                categoryId: catId,
              })),
              skipDuplicates: true,
            })
          }

          // 3. Criar ProductOption + ProductOptionValue (opções do produto)
          if (body.options && body.options.length) {
            for (const opt of body.options) {
              const optDb = await tx.option.findUnique({ where: { name: opt.name } })
              if (!optDb) {
                throw new BadRequestError(`Opção "${opt.name}" informada não existe.`)
              }
              const prodOpt = await tx.productOption.upsert({
                where: {
                  productId_optionId: {
                    productId: prod.id,
                    optionId: optDb.id,
                  },
                },
                create: { productId: prod.id, optionId: optDb.id },
                update: {}, // nada a atualizar se já existe
              })

              for (const v of opt.values) {
                const ov = await tx.optionValue.findUnique({ where: { id: v.id } })
                if (!ov) {
                  throw new BadRequestError(`OptionValue id "${v.id}" inválido para a opção "${opt.name}".`)
                }
                await tx.productOptionValue.upsert({
                  where: {
                    productOptionId_optionValueId: {
                      productOptionId: prodOpt.id,
                      optionValueId: v.id,
                    },
                  },
                  create: {
                    productOptionId: prodOpt.id,
                    optionValueId: v.id,
                  },
                  update: {},
                })
              }
            }
          }

          // 4. Criar imagens se houver
          if (body.images && body.images.length) {
            await tx.productImage.createMany({
              data: body.images.map((f, i) => ({
                productId: prod.id,
                fileKey: f.fileKey,
                url: f.url,
                alt: f.alt ?? null,
                sortOrder: f.sortOrder ?? i,
              })),
            })
          }

          // 5. Criar variantes + associar optionValue → variant
          if (body.variants && body.variants.length) {
            for (const v of body.variants) {
              const existingVar = await tx.productVariant.findUnique({ where: { sku: v.sku } })
              if (existingVar) {
                throw new BadRequestError(`Variante com SKU "${v.sku}" já existe.`)
              }
              const newVar = await tx.productVariant.create({
                data: {
                  productId: prod.id,
                  sku: v.sku,
                  price: v.price ?? null,
                  comparePrice: v.comparePrice ?? null,
                  stock: v.stock ?? 0,
                },
              })

              if (v.optionValueIds && v.optionValueIds.length) {
                for (const ovId of v.optionValueIds) {
                  const ov = await tx.optionValue.findUnique({ where: { id: ovId } })
                  if (!ov) {
                    throw new BadRequestError(`OptionValue id "${ovId}" inválido em variante SKU="${v.sku}".`)
                  }
                  await tx.variantOptionValue.create({
                    data: {
                      variantId: newVar.id,
                      optionValueId: ovId,
                    },
                  })
                }
              }
            }
          }

          return prod
        })

        return reply.status(201).send({ productId: createdProduct.id })
      } catch (err) {
        console.error('Erro ao criar produto:', err)
        if (err instanceof BadRequestError) {
          throw err
        }
        throw new BadRequestError('Falha ao criar produto.')
      }
    },
  )
}
