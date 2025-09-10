/* eslint-disable @stylistic/max-len */
export { authenticateWithGoogle } from './auth/authenticate-with-google'
export { authenticateWithPassword } from './auth/authenticate-with-password'
export { createUser } from './auth/create-user'
export { getProfile } from './auth/get-profile'
export { requestPasswordRecover } from './auth/request-password-recover'
export { resetPassword } from './auth/reset-password'

export { createProduct } from './product/create-product'
export { deleteProduct } from './product/delete-product'
export { getProductById } from './product/get-product-by-id'
export { getProductBySlug } from './product/get-product-by-slug'
export { getAllProducts } from './product/get-products'
export { updateProduct } from './product/update-product'

export { createOrder } from './orders/create-order'
export { deleteOrder } from './orders/delete-order'
export { getOrdersByCustomer } from './orders/get-order-by-customer'
export { getOrderById } from './orders/get-order-by-id'
export { getOrders } from './orders/get-orders'
export { updateOrder } from './orders/update-order'
export { updateOrderStatus } from './orders/update-status-order'
export { updateStatusOrderToCancel } from './orders/update-status-order-to-cancel'

