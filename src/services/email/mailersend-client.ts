import { env } from '@/env'
import { MailerSend } from 'mailersend'
export const mailerSend = new MailerSend({
  apiKey: env.MAILERSEND_API_KEY,
})
