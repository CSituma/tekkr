import { FastifyPluginAsync } from 'fastify'
import {testUsers} from "../../domain/test-users";

const user: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/', async function (request, reply) {
    const userId = request.userId;
    const user = testUsers[userId];
    reply.send({
      id: userId,
      name: user.name,
      email: user.email,
    });
  });
};

export default user
