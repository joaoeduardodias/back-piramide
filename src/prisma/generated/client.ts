import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import * as runtime from '@prisma/client/runtime/client'
import * as $Class from './internal/class.js'
import * as Prisma from './internal/prismaNamespace.js'

export * from './enums.js'
export * as $Enums from './enums.js'
export { Prisma }

/**
 * ## Prisma Client
 *
 * Type-safe database client for TypeScript
 */
export const PrismaClient = $Class.getPrismaClientClass()

export type PrismaClient<
  LogOpts extends Prisma.LogLevel = never,
  OmitOpts extends Prisma.PrismaClientOptions['omit'] = Prisma.PrismaClientOptions['omit'],
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = $Class.PrismaClient<LogOpts, OmitOpts, ExtArgs>

/**
 * Models
 */
export type User = Prisma.UserModel
export type Token = Prisma.TokenModel
export type Account = Prisma.AccountModel
export type Address = Prisma.AddressModel
export type Product = Prisma.ProductModel
export type ProductImage = Prisma.ProductImageModel
export type Category = Prisma.CategoryModel
export type Brand = Prisma.BrandModel
export type ProductCategory = Prisma.ProductCategoryModel
export type ProductVariant = Prisma.ProductVariantModel
export type Option = Prisma.OptionModel
export type OptionValue = Prisma.OptionValueModel
export type ProductOption = Prisma.ProductOptionModel
export type ProductOptionValue = Prisma.ProductOptionValueModel
export type VariantOptionValue = Prisma.VariantOptionValueModel
export type Order = Prisma.OrderModel
export type OrderItem = Prisma.OrderItemModel
export type Coupon = Prisma.CouponModel
export type CouponUsage = Prisma.CouponUsageModel
