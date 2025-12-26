import type { FastifyInstance } from 'fastify'
import { createHeroSlide } from './create-slide'
import { deleteHeroSlide } from './delete-slide'
import { getHeroSlidesById } from './get-hero-slide-by-id'
import { getHeroSlides } from './get-hero-slides'
import { updateHeroSlide } from './update-slide'

export async function heroSlidesRoutes(app: FastifyInstance) {
  await createHeroSlide(app)
  await updateHeroSlide(app)
  await deleteHeroSlide(app)
  await getHeroSlides(app)
  await getHeroSlidesById(app)
}
