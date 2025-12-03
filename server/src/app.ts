import { config } from 'dotenv'
import { join } from 'node:path'
import AutoLoad from '@fastify/autoload'
import { FastifyPluginAsync } from 'fastify'

config({ path: join(__dirname, '..', '.env') })

const app: FastifyPluginAsync = async (
  fastify
): Promise<void> => {
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
  })
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
  })
}

export default app
export { app }
