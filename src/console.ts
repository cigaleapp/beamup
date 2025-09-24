import { styleText } from 'node:util';

export function strong(str: string | number) {
	return styleText(['bold', 'cyanBright'], str.toString());
}

export function em(str: string | number) {
	return styleText(['blueBright', 'italic'], str.toString());
}

export function boolean(val: unknown, falseWord = 'false', trueWord = 'true') {
	return styleText(['bold', val ? 'green' : 'red'], val ? trueWord : falseWord);
}
