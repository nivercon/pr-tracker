import { AppConfig } from "../config.ts";
import { ms, oak, Octokit, z } from "../deps.ts";
import { MessageTypes } from "../workers/workers.ts";
import { RouterMiddleware } from "./router.ts";

export const AuthInfo = z
  .object({
    access_token: z.string(),
    expires_in: z.coerce.number(),
    refresh_token: z.string(),
    refresh_token_expires_in: z.coerce.number(),
  })
  .transform((data) => ({
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshToken: data.refresh_token,
    refreshTokenExpiresAt: Date.now() + data.refresh_token_expires_in * 1000,
  }));

export type AuthInfo = z.infer<typeof AuthInfo>;

export const User = z.object({
  login: z.string(),
  id: z.number(),
  node_id: z.string(),
  avatar_url: z.string(),
  gravatar_id: z.string(),
  url: z.string(),
  html_url: z.string(),
  followers_url: z.string(),
  following_url: z.string(),
  gists_url: z.string(),
  starred_url: z.string(),
  subscriptions_url: z.string(),
  organizations_url: z.string(),
  repos_url: z.string(),
  events_url: z.string(),
  received_events_url: z.string(),
  type: z.string(),
  site_admin: z.boolean(),
  name: z.string(),
  company: z.string(),
  blog: z.string(),
  location: z.string(),
  email: z.null(),
  hireable: z.null(),
  bio: z.string(),
  twitter_username: z.null(),
  public_repos: z.number(),
  public_gists: z.number(),
  followers: z.number(),
  following: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type User = z.infer<typeof User>;

async function validateState(kv: Deno.Kv, state: string | null) {
  if (!state) throw oak.createHttpError(400, "Missing state parameter");

  const { uuid, timestamp } = JSON.parse(state);
  const storedTimestamp = await kv.get(["state", uuid]).then((entry) => entry.value);

  if (!storedTimestamp) throw oak.createHttpError(400, "Invalid state parameter");
  if (timestamp !== storedTimestamp) {
    throw oak.createHttpError(400, `Invalid timestamp (${timestamp} vs ${storedTimestamp})`);
  }
  if (Date.now() - timestamp > Number(ms("10m"))) throw oak.createHttpError(400, "Expired request");
}

async function redirectToLogin(kv: Deno.Kv, config: AppConfig, ctx: oak.Context) {
  const state = { uuid: crypto.randomUUID(), timestamp: Date.now() };
  await kv.set(["state", state.uuid], state.timestamp);

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.append("client_id", config.clientId);
  url.searchParams.append("redirect_uri", config.redirectUri);
  url.searchParams.append("state", JSON.stringify(state));

  return ctx.response.redirect(url);
}

export const login: RouterMiddleware = async (ctx) => {
  const { config, kv } = ctx.state;
  const params = ctx.request.url.searchParams;

  if (!params.has("code")) return redirectToLogin(kv, config, ctx);

  const code = params.get("code")!;
  const state = params.get("state");

  await validateState(kv, state);

  const url = new URL("https://github.com/login/oauth/access_token");
  url.searchParams.append("client_id", config.clientId);
  url.searchParams.append("client_secret", config.clientSecret);
  url.searchParams.append("code", code);

  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" } });

  if (!response.ok) throw oak.createHttpError(500, "Authentication failed. Please try again.", { expose: true });

  const responseBody = Object.fromEntries(await response.formData().then((data) => data.entries()));
  const authInfo = AuthInfo.parse(responseBody);

  const ok = new Octokit({ auth: authInfo.accessToken });
  const user = await ok.rest.users.getAuthenticated();

  const userKey = ["user", user.data.id];
  const saveUser = await kv.atomic().check({ key: userKey, versionstamp: null }).set(userKey, {
    authInfo,
    user: user.data,
  }).commit();

  if (saveUser.ok) await kv.enqueue({ type: MessageTypes.FETCH_PRS, userId: user.data.id });

  return ctx.response.redirect(config.welcomeUrl);
};
