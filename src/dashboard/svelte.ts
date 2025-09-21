import { plugin } from 'bun';

import * as svelte from 'svelte/compiler';

plugin({
	name: 'Svelte',
	setup(build) {
		build.onLoad({ filter: /\.svelte(\?.*)?$/ }, async (args) => {
			const searchParams = new URLSearchParams(args.path.split('?')[1]);
			const dom = searchParams.has('dom');
			const path = args.path.replace(/\?.*$/, '');

			const file = await Bun.file(path).text();
			const { js, warnings } = svelte.compile(file, {
				filename: path,
				generate: dom ? 'client' : 'server',
				css: 'injected',
				hmr: !process.env.PROD
			});

			for (const warning of warnings) {
				console.warn(`[svelte] ${warning.message}`);
			}

			return dom
				? {
						loader: 'object',
						exports: { default: js.code }
					}
				: { contents: js.code, loader: 'js' };
		});
	}
});
