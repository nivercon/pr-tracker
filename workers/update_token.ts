import { config } from "../config.ts";
import { AuthInfo, User } from "../routes/login.ts";
import { Message, MessageTypes } from "./workers.ts";

const isUpdateTokensMessage = (msg: unknown): msg is Message =>
  typeof msg === "object" && msg !== null && "type" in msg && msg["type"] === MessageTypes.UPDATE_TOKEN;

export const updateTokensWorker = (kv: Deno.Kv) => async (msg: unknown) => {
  if (!isUpdateTokensMessage(msg)) return;

  const user = await kv.get<{ authInfo: AuthInfo; user: User }>(["user", msg.userId]).then((value) => value?.value);
  if (!user) return;

  const url = new URL("https://github.com/login/oauth/access_token");
  url.searchParams.append("client_id", config.clientId);
  url.searchParams.append("client_secret", config.clientSecret);
  url.searchParams.append("grant_type", "refresh_token");
  url.searchParams.append("refresh_token", user.authInfo.refreshToken);

  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" } });

  const responseBody = Object.fromEntries(await response.formData().then((data) => data.entries()));
  const authInfo = AuthInfo.parse(responseBody);

  await kv.set(["user", user.user.id], { authInfo, user: user.user });

  if (msg.nextTask) {
    await kv.enqueue({ type: msg.nextTask, userId: user.user.id });
  }
};
