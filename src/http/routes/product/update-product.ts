import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { BadRequestError } from "../_errors/bad-request-error";

import { ProductStatus } from "@prisma/client";

const updateProductSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  slug: z.string().min(1, "Slug is required").optional(),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive").optional(),
  status: z.enum(ProductStatus),
  categoryIds: z.array(z.uuid()).optional(),
  images: z.array(
    z.object({
      url: z.url("Invalid URL format"),
      alt: z.string().optional(),
      sortOrder: z.number().int().min(0).default(0),
    })
  ).optional(),
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


export async function updateProduct(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().put(
    "/products/:slug",
    {
      schema: {
        tags: ["Products"],
        summary: "Update product",
        params: z.object({
          slug: z.string(),
        }),
        body: updateProductSchema,
        response: {
          200: productResponseSchema
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const { name, description, price, status, categoryIds, images } = request.body;

      const product = await prisma.product.findUnique({
        where: { slug },
      });

      if (!product) {
        throw new BadRequestError("Product not found.");
      }

      if (categoryIds && categoryIds.length > 0) {
        const categories = await prisma.category.findMany({
          where: { id: { in: categoryIds } },
        });

        if (categories.length !== categoryIds.length) {
          throw new BadRequestError("One or more categories not found.");
        }
      }

      try {
        const updatedProduct = await prisma.product.update({
          where: { slug },
          data: {
            ...(name && { name }),
            ...(request.body.slug && { slug: request.body.slug }),
            ...(description !== undefined && { description }),
            ...(price !== undefined && { price }),
            ...(status && { status }),
            ...(categoryIds && {
              categories: {
                deleteMany: {},
                create: categoryIds.map((categoryId) => ({
                  categoryId,
                })),
              },
            }),
            ...(images && {
              images: {
                deleteMany: {},
                create: images.map((image) => ({
                  url: image.url,
                  alt: image.alt,
                  sortOrder: image.sortOrder,
                })),
              },
            }),
          },
          include: {
            categories: {
              include: { category: true },
            },
            images: {
              orderBy: { sortOrder: "asc" },
            },
            variants: true,
          },
        });

        return reply.send(updatedProduct);
      } catch (error) {
        console.error(error);
        throw new BadRequestError("Failed to update product.");
      }
    }
  );
}
