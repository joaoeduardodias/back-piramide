import fastifyCors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'

import { fastify } from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { env } from '../env'
import { errorHandler } from './error-handler'
import {
  authenticateWithGoogle,
  authenticateWithPassword,
  createOrder,
  createProduct,
  createUser,
  deleteOrder,
  deleteProduct,
  getAllProducts,
  getOrderById,
  getOrders,
  getOrdersByCustomer,
  getProductById,
  getProductBySlug,
  getProfile,
  requestPasswordRecover,
  resetPassword,
  updateOrder,
  updateOrderStatus,
  updateProduct,
  updateStatusOrderToCancel,
} from './routes'

const app = fastify().withTypeProvider<ZodTypeProvider>()

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
        },
      },
    },
  },
  transform: jsonSchemaTransform,
})

app.register(fastifySwaggerUi, {
  routePrefix: '/docs',
})

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

// product routes
app.register(createProduct)
app.register(updateProduct)
app.register(deleteProduct)
app.register(getProductById)
app.register(getProductBySlug)
app.register(getAllProducts)

// orders routes

app.register(createOrder)
app.register(deleteOrder)
app.register(getOrdersByCustomer)
app.register(getOrderById)
app.register(getOrders)
app.register(updateOrder)
app.register(updateOrderStatus)
app.register(updateStatusOrderToCancel)

app.listen({ port: env.SERVER_PORT }).then(() => {
  console.log(`HTTP server running on http://localhost:${env.SERVER_PORT}`)
})
