import Fastify from "fastify";
import { DEFAULT_LIMIT, MAX_LIMIT, resolveReferenceTime } from "./config.js";
import { recommendFor } from "./rank.js";

export function buildServer({ db, referenceTime, logger = false }) {
  referenceTime = resolveReferenceTime(referenceTime);
  const app = Fastify({ logger, ajv: { customOptions: { removeAdditional: false } } });

  app.get("/", async () => ({
    service: "circle-recommendations",
    endpoints: ["GET /health", "GET /users/:id/recommendations?limit=10&explain=false"],
    try: "/users/15/recommendations?limit=3",
  }));

  app.get("/health", async () => ({ status: "ok" }));

  app.get(
    "/users/:id/recommendations",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "integer", minimum: 1 } },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT },
            explain: { type: "boolean", default: false },
            reference_time: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      let requestTime = referenceTime;
      if (req.query.reference_time !== undefined) {
        try {
          requestTime = resolveReferenceTime(req.query.reference_time);
        } catch {
          return reply.code(400).send({ error: "invalid reference_time" });
        }
      }
      const result = recommendFor(db, req.params.id, { referenceTime: requestTime, limit: req.query.limit, explain: req.query.explain });
      if (!result) return reply.code(404).send({ error: "member not found" });
      return result;
    },
  );

  return app;
}
