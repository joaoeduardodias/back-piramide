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
  addToCart,
  adjustStock,
  authenticateWithGoogle,
  authenticateWithPassword,
  bulkUpdateStock,
  checkout,
  clearCart,
  createAddress,
  createBrand,
  createCategory,
  createOption,
  createOptionValue,
  createOrder,
  createProduct,
  createUser,
  deleteAddress,
  deleteBrand,
  deleteCategory,
  deleteOrder,
  deleteProduct,
  getAddressById,
  getAddresses,
  getAllOptions,
  getAllProducts,
  getBrandById,
  getBrands,
  getCart,
  getCategories,
  getCategoryById,
  getLowStockProducts,
  getOrderById,
  getOrders,
  getOrdersByCustomer,
  getOrdersStats,
  getProductById,
  getProductBySlug,
  getProductStock,
  getProfile,
  getStockReport,
  getUsers,
  getVariantStock,
  removeFromCart,
  requestPasswordRecover,
  resetPassword,
  setDefaultAddress,
  updateAddress,
  updateBrand,
  updateCartItem,
  updateCategory,
  updateOrder,
  updateOrderStatus,
  updateProduct,
  updateStatusOrderToCancel,
  updateVariantStock,
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
app.register(getUsers)
app.register(requestPasswordRecover)
app.register(resetPassword)

// product routes
app.register(createProduct)
app.register(updateProduct)
app.register(deleteProduct)
app.register(getProductById)
app.register(getProductBySlug)
app.register(getAllProducts)
app.register(getAllOptions)
app.register(createOption)
app.register(createOptionValue)

// orders routes

app.register(createOrder)
app.register(deleteOrder)
app.register(getOrdersByCustomer)
app.register(getOrderById)
app.register(getOrders)
app.register(getOrdersStats)
app.register(updateOrder)
app.register(updateOrderStatus)
app.register(updateStatusOrderToCancel)

// address routes

app.register(createAddress)
app.register(deleteAddress)
app.register(getAddressById)
app.register(getAddresses)
app.register(setDefaultAddress)
app.register(updateAddress)

// cart routes

app.register(addToCart)
app.register(checkout)
app.register(clearCart)
app.register(getCart)
app.register(removeFromCart)
app.register(updateCartItem)

// stock router

app.register(adjustStock)
app.register(bulkUpdateStock)
app.register(getLowStockProducts)
app.register(getProductStock)
app.register(getStockReport)
app.register(getVariantStock)
app.register(updateVariantStock)

// categories router

app.register(createCategory)
app.register(updateCategory)
app.register(deleteCategory)
app.register(getCategories)
app.register(getCategoryById)

// brand router

app.register(createBrand)
app.register(getBrandById)
app.register(getBrands)
app.register(updateBrand)
app.register(deleteBrand)

app.listen({ port: env.PORT, host: '0.0.0.0' }, () => {
  console.log(`🚀 HTTP server running on http://0.0.0.0:${env.PORT}`)
})
