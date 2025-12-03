import fp from "fastify-plugin";
import fastifyCors, {FastifyCorsOptions} from "@fastify/cors";

export default fp<FastifyCorsOptions>(async (fastify) => {
  fastify.register(fastifyCors, {
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
})
