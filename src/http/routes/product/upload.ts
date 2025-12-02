import { env } from '@/env'
import { r2 } from '@/lib/cloudfare'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { randomUUID } from 'node:crypto'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const createPresignedSchema = z.object({
  files: z.array(
    z.object({
      fileName: z.string().min(1, 'Name is required'),
      contentType: z
        .string()
        .regex(/^image\/(jpeg|png|webp|avif)$/,
          'File type must be jpeg, png or webp of avif',
        ),
      sortOrder: z.number().optional(),
    }),
  ),
})

export async function signedUrl(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/uploads',
    {
      schema: {
        tags: ['Products'],
        summary: 'Generate presigned URLs for image uploads',
        body: createPresignedSchema,
        response: {
          201: z.object({
            uploads: z.array(
              z.object({
                fileKey: z.string(),
                presignedUrl: z.url(),
                url: z.url(),
                contentType: z.string(),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { files } = request.body

      try {
        const uploads = await Promise.all(
          files.map(async (file) => {
            const sanitizedName = file.fileName.replace(/\s+/g, '-')
            const fileKey = `${randomUUID()}-${sanitizedName}`

            const signedUrl = await getSignedUrl(
              r2,
              new PutObjectCommand({
                Bucket: env.CLOUDFARE_BUCKET_NAME,
                Key: fileKey,
                ContentType: file.contentType,
                ACL: 'public-read',
              }),
              { expiresIn: 600 },
            )

            const publicUrl = `${env.CLOUDFARE_PUBLIC_URL}/${fileKey}`

            return {
              fileKey,
              presignedUrl: signedUrl,
              url: publicUrl,
              contentType: file.contentType,
            }
          }),
        )

        return reply.status(201).send({ uploads })
      } catch (err) {
        console.error(err)
        throw new BadRequestError('Failed to generate presigned URLs')
      }
    },
  )
}
