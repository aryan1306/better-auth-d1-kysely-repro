import { betterAuth } from "better-auth";

type Env = { DB: D1Database };

// Memoized per isolate, the usual Workers pattern.
let auth: ReturnType<typeof betterAuth> | undefined;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		auth ??= betterAuth({
			secret: "repro-secret-repro-secret-repro-secret",
			baseURL: "http://localhost:8799",
			database: env.DB,
			emailAndPassword: { enabled: true },
		});
		const url = new URL(request.url);
		try {
			if (url.pathname === "/session") {
				const session = await auth.api.getSession({ headers: request.headers });
				return Response.json({ ok: true, session: session?.user.id ?? null });
			}
			return auth.handler(request);
		} catch (error) {
			return Response.json({ ok: false, error: String(error) }, { status: 500 });
		}
	},
};
