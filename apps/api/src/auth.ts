import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, line } from "better-auth/plugins/generic-oauth";
import { jwtVerify } from "jose";
import { db } from "./db";

const CHANNEL_ID = process.env.LINE_CHANNEL_ID ?? "";
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? "";
const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";

export const auth = betterAuth({
  baseURL: BASE_URL,
  basePath: "/api/auth", // callback = /api/auth/oauth2/callback/line
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me-32chars!!",
  trustedOrigins: [BASE_URL],
  database: drizzleAdapter(db, { provider: "pg" }),
  // dev/e2e only: lets /api/dev/login mint a real session without LINE (see app.ts). Never on in prod.
  emailAndPassword: { enabled: process.env.DEV_LOGIN === "1" },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 天
    updateAge: Number(process.env.SESSION_UPDATE_AGE ?? 60 * 60 * 24), // 滑動；POC V4 可設 10 秒
  },
  user: {
    additionalFields: {
      role: { type: ["member", "staff", "admin"], required: false, defaultValue: "member", input: false },
    },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          ...line({ clientId: CHANNEL_ID, clientSecret: CHANNEL_SECRET, scopes: ["openid", "profile"], pkce: true }),
          // preset 只 decodeJwt 不驗簽 → 改成 HS256 驗證（LINE web login id_token 以 channel secret 簽）
          getUserInfo: async (tokens) => {
            if (!tokens.idToken) return null;
            const { payload } = await jwtVerify(tokens.idToken, new TextEncoder().encode(CHANNEL_SECRET), {
              algorithms: ["HS256"],
              issuer: "https://access.line.me",
              audience: CHANNEL_ID,
            });
            return {
              id: payload.sub as string, // LINE userId → account.accountId
              name: (payload.name as string) ?? "",
              image: payload.picture as string | undefined,
              email: `${payload.sub}@line.invalid`, // 不要 email scope；better-auth 的 user.email NOT NULL → 合成佔位值
              emailVerified: false,
            };
          },
        },
      ],
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
