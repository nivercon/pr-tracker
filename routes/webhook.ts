import { RouterMiddleware } from "./router.ts";

export const webhook: RouterMiddleware = async (ctx) => {
  const body = await (ctx.request.hasBody ? ctx.request.body().value : {});
  console.log(body);
  ctx.response.status = 204;
};
