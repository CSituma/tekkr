import Fastify from 'fastify'
import app from './app'

const buildServer = () => {
  const fastify = Fastify({
    logger: true,
  })

  fastify.register(app)

  return fastify
}

const start = async () => {
  const fastify = buildServer()

  const port = Number(process.env.PORT) || 8000
  const host = '0.0.0.0'

  try {
    await fastify.listen({ port, host })
    fastify.log.info(`Server running at http://${host}:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

void start()


