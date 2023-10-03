import { dotenv, ptera, z } from "./deps.ts";
dotenv.loadSync({ export: true });

export const AppConfig = z.object({
  CLIENT_ID: z.string(),
  CLIENT_SECRET: z.string(),
  APP_ID: z.string(),
  REDIRECT_URI: z.string().url(),
  WELCOME_URL: z.string().url(),
  PULLS_PERIOD_START: z.string(),
  PULLS_PERIOD_END: z.string(),
  PULLS_FETCH_INTERVAL: z.coerce.number().optional().default(ptera.MILLISECONDS_IN_HOUR),
  PULLS_REQUIRED_TOPIC: z.string(),
  KV_URL: z.string().optional(),
}).transform((obj) => ({
  clientId: obj.CLIENT_ID,
  clientSecret: obj.CLIENT_SECRET,
  appId: obj.APP_ID,
  redirectUri: obj.REDIRECT_URI,
  welcomeUrl: obj.WELCOME_URL,
  pullsPeriodStart: ptera.datetime(obj.PULLS_PERIOD_START),
  pullsPeriodEnd: ptera.datetime(obj.PULLS_PERIOD_END),
  pullsFetchInterval: obj.PULLS_FETCH_INTERVAL,
  pullsRequiredTopic: obj.PULLS_REQUIRED_TOPIC,
  kvUrl: obj.KV_URL,
}));

export const config = AppConfig.parse(Deno.env.toObject());

export type AppConfig = z.infer<typeof AppConfig>;
