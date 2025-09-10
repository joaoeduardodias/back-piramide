import { prisma } from "@/lib/prisma";
import { ProductStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { BadRequestError } from "../_errors/bad-request-error";

const productSlugParamsSchema = z.object({
  slug: z.string().min(1, "Slug is required")
});

const productResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  price: z.instanceof(Decimal),
  status: z.enum(ProductStatus),
  createdAt: z.date(),
  updatedAt: z.date(),

  categories: z.array(
    z.object({
      categoryId: z.uuid(),
      productId: z.uuid(),
      category: z.object({
        id: z.uuid(),
        name: z.string(),
        slug: z.string(),
        description: z.string().nullable(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    })
  ),

  images: z.array(
    z.object({
      id: z.uuid(),
      url: z.string(),
      alt: z.string().nullable(),
      sortOrder: z.number().int(),
      productId: z.uuid(),
      createdAt: z.date(),
      optionValueId: z.string().uuid().nullable(),
    })
  ),

  variants: z.array(
    z.object({
      id: z.uuid(),
      price: z.instanceof(Decimal).nullable(),
      sku: z.string().nullable(),
      stock: z.number(),
      productId: z.uuid(),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
});

export async function getProductBySlug(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/products/:slug',
    {
      schema: {
        tags: ['Products'],
        summary: 'Get product by slug',
        params: productSlugParamsSchema,
        response: productResponseSchema
      }
    },
    async (request, reply) => {
      const { slug } = request.params;

      try {
        const product = await prisma.product.findUnique({
          where: { slug },
          include: {
            categories: {
              include: {
                category: true
              }
            },
            images: {
              orderBy: { sortOrder: 'asc' }
            },
            variants: {
              include: {
                optionValues: {
                  include: {
                    optionValue: {
                      include: {
                        option: true
                      }
                    }
                  }
                }
              }
            },
            Option: {
              include: {
                values: true
              }
            }
          }
        });

        if (!product) {
          throw new BadRequestError("Product not found.");
        }

        return reply.send(product);
      } catch (error) {
        throw new BadRequestError("Failed to fetch product.");
      }
    }
  );
}