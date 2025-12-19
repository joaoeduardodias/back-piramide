import { auth } from '@/http/middlewares/auth'
import { sendEmail } from '@/services/email/send-email'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

export async function sendTestEmail(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post('/emails/test', {
      schema: {
        tags: ['Emails'],
        summary: 'Send test email',
        security: [{ bearerAuth: [] }],
        body: z.object({
          to: z.email(),
        }),
        response: {
          204: z.null(),
        },
      },
    }, async (request, reply) => {
      const { to } = request.body

      await sendEmail({
        to: { email: to },
        subject: 'Email de teste 🚀',
        html: '<p>Este é um e-mail de teste.</p>',
      })

      return reply.status(204).send()
    })
}
