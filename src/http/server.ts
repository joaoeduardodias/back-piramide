import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

import { fastify } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from 'fastify-type-provider-zod';
import { env } from '../env';
import { errorHandler } from './error-handler';
import { authenticateWithGoogle, authenticateWithPassword, createUser, getProfile, requestPasswordRecover, resetPassword } from './routes';

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)
app.setErrorHandler(errorHandler)

// api documentation
app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Api Documentation - Piramide',
      description: 'API documentation for Piramide project',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    }
  },
  transform: jsonSchemaTransform,
});

app.register(fastifySwaggerUi, {
  routePrefix: '/docs',
});

// CORS
app.register(fastifyCors)
app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
})

// auth routes
app.register(authenticateWithPassword)
app.register(authenticateWithGoogle)
app.register(createUser)
app.register(getProfile)
app.register(requestPasswordRecover)
app.register(resetPassword)






app.listen({ port: env.SERVER_PORT }).then(() => {
  console.log(`HTTP server running on http://localhost:${env.SERVER_PORT}`);
})