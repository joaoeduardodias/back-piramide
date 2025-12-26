import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/prisma/generated/client'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

const getCustomerQuerySchema = z.object({
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
  search: z.string().optional(),
})

export async function getCustomers(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().register(auth).get('/users/customers',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Get customers.',
        querystring: getCustomerQuerySchema,
        security: [
          { bearerAuth: [] },
        ],
        response: {
          200: z.object({
            customers: z.array(
              z.object({
                id: z.uuid(),
                name: z.string().nullable(),
                email: z.email(),
                phone: z.string().nullable(),
                cpf: z.string().nullable(),
                city: z.string().nullable(),
                state: z.string().nullable(),
                orders: z.number().int(),
                totalSpent: z.number().int(),
                lastOrder: z.date().nullable(),
                status: z.string(),
                joinDate: z.date().nullable(),
              }),
            ),
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
      const where: Prisma.UserWhereInput = {}

      const { page, limit, search } = request.query
      const skip = (page - 1) * limit

      const normalizedSearch = search?.trim()

      if (normalizedSearch) {
        where.OR = [
          ...(where.OR ?? []),
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { cpf: { contains: search, mode: 'insensitive' } },
          {
            addresses: {
              some: {
                city: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            addresses: {
              some: {
                state: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          },
        ]
      }
      where.role = 'CUSTOMER'

      const [users, total] = await Promise.all([
        await prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cpf: true,
            createdAt: true,
            addresses: {
              select: {
                id: true,
                street: true,
                city: true,
                state: true,
              },
              where: {
                isDefault: true,
              },
              take: 1,
            },
            Order: {
              select: {
                id: true,
                total: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,

            },
          },

        }),
        prisma.user.count({
          where: {
            role: 'CUSTOMER',
          },
        }),
      ])
      // const users = await prisma.user.findMany({
      //   select: {
      //     id: true,
      //     name: true,
      //     email: true,
      //     phone: true,
      //     cpf: true,
      //     createdAt: true,
      //     addresses: {
      //       select: {
      //         id: true,
      //         street: true,
      //         city: true,
      //         state: true,
      //       },
      //       where: {
      //         isDefault: true,
      //       },
      //       take: 1,
      //     },
      //     Order: {
      //       select: {
      //         id: true,
      //         total: true,
      //         createdAt: true,
      //       },
      //       orderBy: { createdAt: 'desc' },
      //       take: 1,

      //     },
      //   },
      //   where: {
      //     role: 'CUSTOMER',
      //   },
      // })
      const totalPages = Math.ceil(total / limit)
      const formattedCustomers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        cpf: user.cpf,
        city: user.addresses.map(address => address.city)[0] || null,
        state: user.addresses.map(address => address.state)[0] || null,
        orders: user.Order.length,
        totalSpent: user.Order.reduce((sum, order) => sum + order.total, 0),
        lastOrder: user.Order.sort((a, b) => b.createdAt.getTime() -
          a.createdAt.getTime())[0]?.createdAt || null,
        status: user.Order.length > 0
          ? 'active'
          : 'inactive',
        joinDate: user.createdAt,
      }))

      return reply.send({
        customers: formattedCustomers,
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
