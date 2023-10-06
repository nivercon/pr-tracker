import { AppConfig, config } from "./config.ts";
import { oak } from "./deps.ts";
import { errorMiddleware } from "./middlewares/error.ts";
import { router } from "./routes/router.ts";
import { registerWorkers } from "./workers/workers.ts";

const kv = await Deno.openKv(config.kvUrl);

export type AppState = {
  config: AppConfig;
  kv: Deno.Kv;
};
const app = new oak.Application<AppState>();

app.use(errorMiddleware);

app.use((ctx, next) => {
  ctx.state.config = config;
  ctx.state.kv = kv;
  return next();
});

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", ({ port }) => {
  console.log(`Listening on port ${port}`);
});

app.listen({ port: 3000 });
await registerWorkers(kv);
