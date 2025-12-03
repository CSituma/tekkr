import fp from 'fastify-plugin'
import {testUsers} from "../domain/test-users";

export default fp(async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const userId = request.headers.authorization;
    if (!userId || !(userId in testUsers)) {
      reply.status(401).send();
      return;
    }
    request.userId = userId as keyof typeof testUsers;
  });
});

declare module 'fastify' {
  interface FastifyRequest {
    userId: keyof typeof testUsers;
  }
}
