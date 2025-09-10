import { prisma } from "@/lib/prisma";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from 'zod/v4';
import { BadRequestError } from "../_errors/bad-request-error";

export const ProductStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  status: ProductStatusEnum.default('DRAFT'),
  categoryIds: z.array(z.uuid()).optional(),
  images: z.array(z.object({
    url: z.url("Invalid URL format"),
    alt: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0)
  })).optional()
});

export async function createProduct(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/products',
    {
      schema: {
        tags: ['Products'],
        summary: 'Create product',
        body: createProductSchema,
        response: {
          201: z.object({
            productId: z.uuid()
          }),
        }
      }
    },
    async (request, reply) => {
      const { name, slug, description, price, status, categoryIds, images } = request.body;

      const existingProduct = await prisma.product.findUnique({
        where: { slug }
      });

      if (existingProduct) {
        throw new BadRequestError("Product with this slug already exists.");
      }

      if (categoryIds && categoryIds.length > 0) {
        const categories = await prisma.category.findMany({
          where: { id: { in: categoryIds } }
        });

        if (categories.length !== categoryIds.length) {
          throw new BadRequestError("One or more categories do not exist.");
        }
      }

      try {
        const product = await prisma.product.create({
          data: {
            name,
            slug,
            description,
            price,
            status,
            categories: categoryIds ? {
              create: categoryIds.map(categoryId => ({
                categoryId
              }))
            } : undefined,
            images: images ? {
              create: images.map(image => ({
                url: image.url,
                alt: image.alt,
                sortOrder: image.sortOrder
              }))
            } : undefined
          },
          include: {
            categories: {
              include: {
                category: true
              }
            },
            images: true,
            variants: true
          }
        });

        return reply.status(201).send({
          productId: product.id
        })
      } catch (error) {
        throw new BadRequestError("Failed to create product.");
      }
    }
  );
}