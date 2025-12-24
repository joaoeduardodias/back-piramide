import type { FastifyInstance } from 'fastify'
import { createCoupon } from './create-coupon'
import { deleteCoupon } from './delete-coupon'
import { getCouponById } from './get-coupon-by-id'
import { getCoupons } from './get-coupons'
import { updateCoupon } from './update-coupon'
import { updateStatusCoupon } from './update-status-coupon'
import { validateCoupon } from './validate-coupon'

export async function couponRoutes(app: FastifyInstance) {
  await createCoupon(app)
  await updateCoupon(app)
  await deleteCoupon(app)
  await getCoupons(app)
  await getCouponById(app)
  await validateCoupon(app)
  await updateStatusCoupon(app)
}
