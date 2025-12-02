import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const attachImagesSchema = z.object({
  productId: z.uuid('Product Id is required'),
  files: z.array(
    z.object({
      fileKey: z.string(),
      url: z.url(),
      sortOrder: z.number().optional(),
    }),
  ),
})

export async function uploadImages(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/uploads/attach',
    {
      schema: {
        tags: ['Products'],
        summary: 'Attach uploaded images to a product',
        body: attachImagesSchema,
        response: {
          201: z.object({ success: z.boolean() }),
        },
      },
    },
    async (request, reply) => {
      const { productId, files } = request.body
      console.log(files)
      try {
        await prisma.productImage.createMany({
          data: files.map((f) => ({
            fileKey: f.fileKey,
            url: f.url,
            productId,
            sortOrder: f.sortOrder,
          })),
        })
        return reply.status(201).send({ success: true })
      } catch (err) {
        console.error(err)
        throw new BadRequestError('Failed to attach images to product')
      }
    },
  )
}
