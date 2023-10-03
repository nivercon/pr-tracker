import { oak } from "../deps.ts";
import { AppState } from "../mod.ts";
import { login } from "./login.ts";
import { pulls } from "./pulls.ts";
import { webhook } from "./webhook.ts";

export type RouterMiddleware<
  R extends string = any,
  P extends oak.RouteParams<R> = oak.RouteParams<R>,
  S extends AppState = AppState,
> = oak.RouterMiddleware<R, P, S>;
export const router = new oak.Router({
  prefix: "/github",
});

router.post("/webhook", webhook);
router.get("/login", login);
router.get("/pulls", pulls);
