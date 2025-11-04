import { r2 } from '@/lib/cloudfare'
import { prisma } from '@/lib/prisma'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'
import { BadRequestError } from '../_errors/bad-request-error'

const updateImagesParamsSchema = z.object({
  id: z.string(),
})

const updateImagesBodySchema = z.object({
  images: z.array(
    z.object({
      fileKey: z.string(),
      url: z.string(),
      sortOrder: z.number(),
    }),
  ),
})

export async function updateImages(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/products/:id/images',
    {
      schema: {
        tags: ['Products'],
        summary: 'Atualiza imagens do produto (ordem, remoção e novos uploads)',
        params: updateImagesParamsSchema,
        body: updateImagesBodySchema,
        security: [{ bearerAuth: [] }],
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { images } = request.body

      const product = await prisma.product.findUnique({
        where: { id },
        include: { images: true },
      })

      if (!product) {
        throw new BadRequestError('Produto não encontrado.')
      }

      const existingUploads = product.images
      const newUploads = images

      const removed = existingUploads.filter(
        (oldImg) => !newUploads.some((u) => u.url === oldImg.url),
      )

      if (removed.length > 0) {
        await Promise.all(
          removed.map(async (img) => {
            const key = img.fileKey ?? img.url.split('/').pop()!
            await r2.send(new DeleteObjectCommand({
              Bucket: 'piramide',
              Key: key,
            }))
          }),
        )

        await prisma.productImage.deleteMany({
          where: {
            productId: id,
            url: { in: removed.map((r) => r.url) },
          },
        })
      }

      await Promise.all(
        newUploads.map(async (u) => {
          await prisma.productImage.upsert({
            where: { fileKey: u.fileKey },
            update: { sortOrder: u.sortOrder },
            create: {
              productId: id,
              fileKey: u.fileKey,
              url: u.url,
              sortOrder: u.sortOrder,
            },
          })
        }),
      )

      return reply.status(204).send()
    },
  )
}
