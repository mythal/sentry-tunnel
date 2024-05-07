/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */


const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "*",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Max-Age": "86400",
};


// Set known project IDs for the Sentry projects you want to accept through this proxy
const knownProjectIds: string[] = ["4507212656148480"];


function handleOptions(request: Request) {
	// Make sure the necessary headers are present
	// for this to be a valid pre-flight request
	let headers = request.headers;
	if (
		headers.get("Origin") !== null &&
		headers.get("Access-Control-Request-Method") !== null &&
		headers.get("Access-Control-Request-Headers") !== null
	) {
		// Handle CORS pre-flight request.
		// If you want to check or reject the requested method + headers
		// you can do that here.
		let respHeaders = {
			...corsHeaders,
			// Allow all future content Request headers to go back to browser
			// such as Authorization (Bearer) or X-Client-Name-Version
			"Access-Control-Allow-Headers": request.headers.get(
				"Access-Control-Request-Headers"
			) || corsHeaders['Access-Control-Allow-Headers'],
		};

		return new Response(null, {
			headers: respHeaders,
		});
	} else {
		// Handle standard OPTIONS request.
		// If you want to allow other HTTP Methods, you can do that here.
		return new Response(null, {
			headers: {
				Allow: "*",
			},
		});
	}
}


async function handleRequest(request: Request) {
	const host = "sentry.io";

	const envelope = await request.text();
	const pieces = envelope.split("\n", 2);
	if (pieces.length < 2) {
		return new Response("pieces < 2", { status: 400 });
	}

	let header;
	try {
		header = JSON.parse(pieces[0]);
	} catch {
		return new Response("failed to parse header", { status: 400 });
	}

	if (header["dsn"]) {
		const dsn = new URL(header["dsn"]);

		const projectId = parseInt(dsn.pathname.split("/").filter(Boolean)[0]);

		if (knownProjectIds.includes(String(projectId))) {

			const response = await fetch(
				`https://${host}/api/${projectId}/envelope/`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-sentry-envelope",
					},
					body: envelope,
				}
			);

			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: {
					...response.headers,
					...corsHeaders,
				},
			});
		}
	}

	// Return a 404 Not Found response for all other requests
	return new Response(null, { status: 404 });
}

// Export a default object containing event handlers
export default {
	// The fetch handler is invoked when this worker receives a HTTP(S) request
	// and should return a Response (optionally wrapped in a Promise)
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === "OPTIONS") {
			return await handleOptions(request);
		}

		// You'll find it helpful to parse the request.url string into a URL object. Learn more at https://developer.mozilla.org/en-US/docs/Web/API/URL
		const url = new URL(request.url);

		if (url.pathname.startsWith('/tunnel/')) {
			return await handleRequest(request);
		}

		return new Response(
			`Hello world.`,
			{ headers: { 'Content-Type': 'text/html' } }
		);
	},
};
