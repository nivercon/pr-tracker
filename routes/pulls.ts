import { User } from "./login.ts";
import { RouterMiddleware } from "./router.ts";

export const pulls: RouterMiddleware = async (ctx) => {
  const { kv } = ctx.state;

  const pullKeys = await kv.list<{ username: string; pulls: Array<unknown> }>({ prefix: ["pulls"] });
  const results = [];

  for await (const { value } of pullKeys) {
    const userEntry = await kv.get<{ user: User }>(["user", value.username]).then((entry) => entry.value);
    if (!userEntry) continue;

    const { user } = userEntry;
    results.push({ username: value.username, avatar: user.avatar_url, pulls: value.pulls.length });
  }

  ctx.response.body = results;
};
