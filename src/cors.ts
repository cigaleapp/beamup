export class CorsedResponse extends Response {
	constructor(body?: BodyInit | null, init?: ResponseInit) {
		super(body, init);
		this.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
	}

	static json(body: any, init?: ResponseInit) {
		const response = super.json(body, init);
		if (!response.headers.has('Access-Control-Allow-Origin'))
			response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
		return response;
	}

	static redirect(url: string, status?: number) {
		const response = super.redirect(url, status);
		if (!response.headers.has('Access-Control-Allow-Origin'))
			response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
		return response;
	}
}
