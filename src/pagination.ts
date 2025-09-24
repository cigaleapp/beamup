import { type } from 'arktype';
import { CorsedResponse as Response } from './cors';

export const PaginatedResponseSchema = type('<Item>', {
	next_url: 'string.url | null',
	items: 'Item[]'
});

export type PaginatedResponse<Item> = {
	next_url: string | null;
	items: Item[];
};

export function paginated<Item, T extends Bun.BunRequest>(
	perPage: number,
	getItems: (
		req: T,
		pagination: { limit: number; offset: number }
	) => Promise<{ hasNext: boolean; items: Item[] }>
): (req: T) => Promise<Response> {
	return async (req) => {
		const pagesize = type('number|string.integer.parse').assert(
			new URL(req.url).searchParams.get('pagesize') || perPage
		);

		if (pagesize > perPage)
			return Response.json({ error: `Max pagesize is ${perPage}` }, { status: 400 });

		const page = type('number|string.integer.parse').assert(
			new URL(req.url).searchParams.get('page') || 1
		);

		const offset = (page - 1) * pagesize;

		try {
			const { items, hasNext } = await getItems(req, { limit: pagesize, offset });

			return Response.json({
				next_url: hasNext ? nextUrl(req.url, page + 1) : null,
				items
			} satisfies PaginatedResponse<(typeof items)[number]>);
		} catch (error) {
			if (error instanceof Response) {
				return error;
			}

			throw error;
		}
	};
}

function nextUrl(url: string, newPagenumber: number) {
	const u = new URL(url);
	u.searchParams.set('page', newPagenumber.toString());
	return u.toString();
}
