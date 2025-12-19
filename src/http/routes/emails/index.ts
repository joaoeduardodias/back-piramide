import type { FastifyInstance } from 'fastify'
import { sendOrderCreatedEmail } from './send-order-created-email'

export async function emailRoutes(app: FastifyInstance) {
  await sendOrderCreatedEmail(app)
}
