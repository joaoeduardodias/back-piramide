/* eslint-disable @stylistic/max-len */
/* eslint-disable @stylistic/indent */
import { prisma } from '@/lib/prisma'
import { OrderStatus, type Prisma } from '@prisma/client'
import dayjs from 'dayjs'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '../_errors/bad-request-error'

const getOrdersQuerySchema = z.object({
  date: z.string().optional(),
  status: z.enum(OrderStatus).optional(),
})

const getOrdersStatsResponseSchema = z.object({
  date: z.string(),
  status: z.enum(OrderStatus).or(z.literal('all')),
  quantity: z.number(),
  total: z.number(),
  previousQuantity: z.number(),
  previousTotal: z.number(),
  changeQuantity: z.string(),
  changeTotal: z.string(),
})

export async function getOrdersStats(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/orders/stats',
    {
      schema: {
        tags: ['Orders'],
        summary: `Get orders stats (count 
        + total sales + previous period comparison)`,
        security: [{ bearerAuth: [] }],
        querystring: getOrdersQuerySchema,
        response: {
          200: getOrdersStatsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { date = dayjs().format('YYYY-MM-DD'), status } = request.query

        const detectPeriod = (d: string): 'day' | 'month' | 'year' => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return 'day'
          if (/^\d{4}-\d{2}$/.test(d)) return 'month'
          if (/^\d{4}$/.test(d)) return 'year'
          return 'day'
        }

        const period = detectPeriod(date)

        const base = dayjs(date)
        const start = base.startOf(period)
        const end = base.endOf(period)
        const prevStart = start.subtract(1, period)
        const prevEnd = end.subtract(1, period)

        const whereBase = (startDate: Date, endDate: Date)
          : Prisma.OrderWhereInput => ({
            ...(status && { status }),
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          })

        const [orders, prevOrders] = await Promise.all([
          prisma.order.findMany({
            where: whereBase(start.toDate(), end.toDate()),
            include: { items: true },
          }),
          prisma.order.findMany({
            where: whereBase(prevStart.toDate(), prevEnd.toDate()),
            include: { items: true },
          }),
        ])

        const calcTotal = (ordersList:
          Array<{ items: Array<{ unitPrice: unknown; quantity: number }> }>) =>
          ordersList.reduce(
            (sum, order) =>
              sum +
              order.items.reduce(
                (acc, item) => acc + Number(item.unitPrice) * item.quantity,
                0,
              ),
            0,
          )

        const quantity = orders.length
        const total = calcTotal(orders)
        const previousQuantity = prevOrders.length
        const previousTotal = calcTotal(prevOrders)

        const changeQuantity =
          previousQuantity === 0
            ? '+∞%'
            : `${(((quantity - previousQuantity) / previousQuantity) * 100).toFixed(1)}%`

        const changeTotal =
          previousTotal === 0
            ? '+∞%'
            : `${(((total - previousTotal) / previousTotal) * 100).toFixed(1)}%`

        return reply.send({
          date,
          status: status ?? 'all',
          quantity,
          total,
          previousQuantity,
          previousTotal,
          changeQuantity,
          changeTotal,
        })
      } catch (error) {
        console.error(error)
        throw new BadRequestError('Failed to fetch order stats.')
      }
    },
  )
}
