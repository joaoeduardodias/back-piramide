import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod/v4";
import { UnauthorizedError } from "../_errors/unauthorized-error";

export async function resetPassword(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/password/reset', {
    schema: {
      tags: ['Auth'],
      summary: 'Password Reset.',
      body: z.object({
        code: z.string(),
        password: z.string().min(6, "Password must be at least 6 characters long"),
      }),
      response: {
        204: z.null()
      }
    }
  }, async (request, reply) => {
    const { code, password } = request.body
    const tokenFromCode = await prisma.token.findUnique({
      where: {
        id: code
      }
    })

    if (!tokenFromCode) {
      throw new UnauthorizedError()
    }

    const passwordHash = await hash(password, 6)

    await prisma.user.update({
      where: {
        id: tokenFromCode.userId,
      },
      data: {
        passwordHash
      }
    })

    return reply.status(204).send()

  })
}