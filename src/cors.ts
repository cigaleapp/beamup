export class CorsedResponse extends Response {
	constructor(body?: BodyInit | null, init?: ResponseInit) {
		super(body, init);
		this.headers.set('Access-Control-Allow-Origin', Bun.env.ALLOWED_ORIGINS || '*');
	}

	static override json(body: any, init?: ResponseInit) {
		const response = super.json(body, init);
		if (!response.headers.has('Access-Control-Allow-Origin'))
			response.headers.set('Access-Control-Allow-Origin', Bun.env.ALLOWED_ORIGINS || '*');
		return response;
	}

	static override redirect(url: string, status?: number) {
		const response = super.redirect(url, status);
		if (!response.headers.has('Access-Control-Allow-Origin'))
			response.headers.set('Access-Control-Allow-Origin', Bun.env.ALLOWED_ORIGINS || '*');
		return response;
	}

	static html(body: string, init?: ResponseInit) {
		const response = new CorsedResponse(body, init);
		response.headers.set('Content-Type', 'text/html; charset=utf-8');
		return response;
	}
}
