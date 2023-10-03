import { RouterMiddleware } from "./router.ts";

export const pulls: RouterMiddleware = async (ctx) => {
  const { kv } = ctx.state;

  const pullKeys = await kv.list<{ username: string; pulls: Array<unknown> }>({ prefix: ["pulls"] });
  const pulls = [];

  for await (const { value } of pullKeys) {
    pulls.push([value.username, value.pulls]);
  }

  ctx.response.body = { pulls: Object.fromEntries(pulls) };
};
