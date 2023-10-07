import { config } from "../config.ts";
import { gql, Octokit, ptera, z } from "../deps.ts";
import { AuthInfo, User } from "../routes/login.ts";
import { Message, MessageTypes } from "./workers.ts";

export const PRData = z.object({
  viewer: z.object({
    pullRequests: z.object({
      nodes: z.array(z.object({
        title: z.string(),
        url: z.string(),
        createdAt: z.coerce.date(),
        repository: z.object({
          owner: z.object({
            login: z.string(),
          }),
          repositoryTopics: z.object({
            nodes: z.array(z.object({
              topic: z.object({
                name: z.string(),
              }),
            })),
          }),
        }),
      })),
    }),
  }),
});

const isPrMessage = (msg: unknown): msg is Message =>
  typeof msg === "object" && msg !== null && "type" in msg && msg["type"] === MessageTypes.FETCH_PRS;

export const fetchPrsWorker = (kv: Deno.Kv) => async (msg: unknown) => {
  if (!isPrMessage(msg)) return;

  console.log("fetching prs for", msg.userId);

  const { userId } = msg;
  const userData = await kv.get<{ authInfo: AuthInfo; user: User }>(["user", userId]).then((value) => value?.value);
  if (!userData) return;

  console.log("found user data");

  const { accessToken, expiresAt } = userData.authInfo;

  if (expiresAt <= Date.now()) {
    console.log("token expired, updating");
    await kv.enqueue({ type: MessageTypes.UPDATE_TOKEN, userId: msg.userId, nextTask: MessageTypes.FETCH_PRS });
    return;
  }

  console.log("token valid, fetching prs");

  const ok = new Octokit({ auth: accessToken });
  const response = await ok.graphql(gql`{
    viewer {
      pullRequests(
        first: 100,
        orderBy: {field: CREATED_AT, direction: DESC}
      ) {
        nodes {
          title
          url
          createdAt
          repository {
            owner {
              login
            }
            repositoryTopics(first: 100) {
              nodes {
                topic {
                  name
                }
              }
            }
          }
        }
      }
    }
  }`);

  const pulls = PRData
    .parse(response)
    .viewer.pullRequests.nodes
    .filter((pr) => {
      const createdAt = ptera.datetime(pr.createdAt);

      const isDateValid = createdAt.isBetween(config.pullsPeriodStart, config.pullsPeriodEnd);
      const isTopicValid = pr.repository.repositoryTopics.nodes.some((node) =>
        node.topic.name === config.pullsRequiredTopic
      );
      const isOwnerValid = pr.repository.owner.login !== userData.user.login;

      const isPrValid = isDateValid && isTopicValid && isOwnerValid;

      if (isPrValid) console.log("found valid pr", pr.title);

      return isPrValid;
    });

  console.log("found", pulls.length, "valid prs for", userData.user.login);
  await kv.set(["pulls", userId], { username: userData.user.login, pulls });

  console.log(await kv.get(["pulls", userId]).then((e) => [e.key, e.value]));

  if (msg.nextTask) {
    console.log("enqueuing next task", msg.nextTask);
    await kv.enqueue({ type: msg.nextTask, userId: msg.userId });
    return;
  }

  console.log("enqueuing next fetch task");
  await kv.enqueue({ type: MessageTypes.FETCH_PRS, userId: msg.userId }, { delay: config.pullsFetchInterval });
  console.log("done fetching prs for", msg.userId);
};
