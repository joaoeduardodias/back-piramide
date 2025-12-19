import { EmailParams, Recipient, Sender } from 'mailersend'
import { mailerSend } from './mailersend-client'

interface SendEmailParams {
  to: {
    email: string
    name?: string | null
  }
  subject: string
  templateId: string
  personalization: any
}

export async function sendEmail({
  to,
  subject,
  templateId,
  personalization,
}: SendEmailParams) {
  const sentFrom = new Sender(
    'no-reply@lojapiramidecalcados.com.br',
    'Piramide Calçados',
  )

  const recipients = [
    new Recipient(to.email, to.name ?? undefined),
  ]

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject(subject)
    .setTemplateId(templateId)
    .setPersonalization(personalization)

  await mailerSend.email.send(emailParams)
}
