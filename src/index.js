import { openDatabase } from "./db.js";
import { buildServer } from "./server.js";
import { resolveReferenceTime } from "./config.js";

const port = Number(process.env.PORT ?? 3000);
const referenceTime = resolveReferenceTime();
const app = buildServer({ db: openDatabase(), referenceTime, logger: true });

app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info({ referenceTime }, "recommendations API ready");
});
