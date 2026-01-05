import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
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
            type: z.enum(['PERCENT', 'FIXED']),
            value: z.number(),
            isActive: z.boolean(),
            usedCount: z.number(),
            maxUses: z.number().nullable(),
            expiresAt: z.date().nullable(),
            minOrderValue: z.number().nullable(),

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
          value: true,
          isActive: true,
          usedCount: true,
          maxUses: true,
          expiresAt: true,
          minOrderValue: true,
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

    return reply.send({
      coupons,

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
