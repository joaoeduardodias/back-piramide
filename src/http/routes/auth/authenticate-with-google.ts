import { env } from '@/env'
import { prisma } from '@/lib/prisma'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod/v4'

export async function authenticateWithGoogle(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/sessions/google', {
    schema: {
      tags: ['Auth'],
      summary: 'Authenticate with Google.',
      body: z.object({
        code: z.string(),
      }),
      response: {
        201: z.object({
          token: z.string(),
        }),
      },
    },
  }, async (request, reply) => {
    // URL para passar no front para fazer o login - url de autorização
    // https://accounts.google.com/o/oauth2/v2/auth?client_id=1041206287799-u65ib35rlr5kkgi60ds2bdvik835mssl.apps.googleusercontent.com&redirect_uri=http://localhost:3000/api/auth/callback&response_type=code&scope=https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile&access_type=offline&prompt=consent

    const { code } = request.body
    const formattedCode = decodeURIComponent(code)

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: formattedCode,
        client_id: env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_OAUTH_CLIENT_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    const tokenGoogle = await tokenResponse.json()

    const { access_token: AccessTokenGoogle } = z.object({
      access_token: z.string(),
      expires_in: z.number(),
      refresh_token: z.string(),
      scope: z.string(),
      token_type: z.literal('Bearer'),
      id_token: z.string(),
    }).parse(tokenGoogle)

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${AccessTokenGoogle}`,
      },
    })
    const googleUserData = await userInfoResponse.json()
    const { id: googleId, email, name } = z.object({
      id: z.string(),
      email: z.email(),
      name: z.string(),
    }).parse(googleUserData)

    let user = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          email,
          role: 'CUSTOMER',
        },
      })
    }
    let account = await prisma.account.findUnique({
      where: {
        provider_userId: {
          provider: 'GOOGLE',
          userId: user.id,
        },
      },
    })
    if (!account) {
      account = await prisma.account.create({
        data: {
          provider: 'GOOGLE',
          providerAccountId: googleId,
          userId: user.id,
        },
      })
    }
    const token = await reply.jwtSign(
      {
        sub: user.id,
      },
      {
        sign: {
          expiresIn: '7d',
        },
      })
    return reply.status(201).send({ token })
  })
}
