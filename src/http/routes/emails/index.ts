import type { FastifyInstance } from 'fastify'
import { sendOrderCreatedEmail } from './send-order-created-email'
import { sendTestEmail } from './send-test-email'

export async function emailRoutes(app: FastifyInstance) {
  await sendTestEmail(app)
  await sendOrderCreatedEmail(app)
}
