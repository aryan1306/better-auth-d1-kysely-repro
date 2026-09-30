const base = "http://localhost:8799";
const rounds = Number(process.argv[2] ?? 20);
const concurrency = Number(process.argv[3] ?? 50);
const email = `u${Date.now()}@example.com`;
const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
	method: "POST",
	headers: { "content-type": "application/json", origin: base },
	body: JSON.stringify({ email, password: "password1234", name: "Repro" }),
});
const cookie = signUp.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
console.log("sign-up", signUp.status, cookie ? "got cookie" : "no cookie");
const counts = {};
for (let round = 0; round < rounds; round++) {
	const results = await Promise.all(
		Array.from({ length: concurrency }, () =>
			fetch(`${base}/session`, { headers: { cookie } })
				.then(async (r) => `${r.status} ${(await r.text()).slice(0, 160)}`)
				.catch((e) => `fetch-error ${e.cause?.code ?? e.message}`),
		),
	);
	for (const r of results) {
		const key = r.startsWith("200") ? "200 ok" : r;
		counts[key] = (counts[key] ?? 0) + 1;
	}
}
console.log(counts);
