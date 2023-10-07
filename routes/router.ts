import { oak } from "../deps.ts";
import { AppState } from "../mod.ts";
import { MessageTypes } from "../workers/workers.ts";
import { login } from "./login.ts";
import { pulls } from "./pulls.ts";

export type RouterMiddleware<
  R extends string = any,
  P extends oak.RouteParams<R> = oak.RouteParams<R>,
  S extends AppState = AppState,
> = oak.RouterMiddleware<R, P, S>;
export const router = new oak.Router({
  prefix: "/github",
});

router.get("/login", login);
router.get("/pulls", pulls);
router.get("/fetch/:username", async (ctx) => {
  const { kv } = ctx.state;
  await kv.enqueue({ type: MessageTypes.FETCH_PRS, userId: ctx.params.username });
  ctx.response.status = 204;
});
