import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { CouponScope, CouponType } from '@/prisma/generated/enums'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

const getCouponsQuerySchema = z.object({
  page: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().int().min(1))
    .default(1),

  limit: z
    .string()
    .transform(val => parseInt(val))
    .pipe(z.number().int().min(1))
    .default(10),
})

export async function getCoupons(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get('/coupons', {
    schema: {
      tags: ['Coupon'],
      summary: 'List coupons',
      querystring: getCouponsQuerySchema,
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          coupons: z.array(z.object({
            id: z.uuid(),
            code: z.string(),
            type: z.enum(CouponType),
            scope: z.enum(CouponScope),
            value: z.number(),
            minOrderValue: z.number().nullable(),
            maxUses: z.number().nullable(),
            usedCount: z.number(),
            expiresAt: z.date().nullable(),
            isActive: z.boolean(),
            createdAt: z.date(),
            usages: z.array(z.object({
              id: z.string(),
              couponId: z.string(),
              userId: z.string(),
              usedAt: z.date(),
            })),
            products: z.array(z.object({
              id: z.uuid(),
              name: z.string(),
              brand: z.string().nullable(),
              price: z.number(),
              image: z.string(),
            })),

          })),
          pagination: z.object({
            page: z.number().int(),
            limit: z.number().int(),
            total: z.number().int(),
            totalPages: z.number().int(),
            hasNext: z.boolean(),
            hasPrev: z.boolean(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { page, limit } = request.query
    const skip = (page - 1) * limit

    const [coupons, total] = await Promise.all([
      await prisma.coupon.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          code: true,
          type: true,
          scope: true,
          value: true,
          isActive: true,
          usedCount: true,
          usages: true,
          maxUses: true,
          expiresAt: true,
          minOrderValue: true,
          createdAt: true,
          products: {
            select: {
              product: {
                select: {
                  id: true,
                  name: true,
                  brand: {
                    select: {
                      name: true,
                    },
                  },
                  price: true,
                  images: {
                    select: {
                      url: true,
                    },
                    take: 1,
                  },
                },
              },
            },
          },
        },
        where: {
          isActive: true,
          deletedAt: null,
        },
      }),

      prisma.coupon.count({
        where: {
          isActive: true,
          deletedAt: null,
        },
      }),
    ])
    const totalPages = Math.ceil(total / limit)

    const formattedCoupon = coupons.map(coupon => {
      return {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        scope: coupon.scope,
        isActive: coupon.isActive,
        maxUses: coupon.maxUses,
        minOrderValue: coupon.minOrderValue,
        usedCount: coupon.usedCount,
        usages: coupon.usages,
        createdAt: coupon.createdAt,
        expiresAt: coupon.expiresAt,
        products: coupon.products.map(({ product }) => ({
          id: product.id,
          name: product.name,
          brand: product.brand?.name ?? null,
          price: product.price,
          image: product.images[0]?.url ?? null,
        })),
      }
    })

    return reply.send({
      coupons: formattedCoupon,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  })
}
