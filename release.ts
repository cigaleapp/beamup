const bump = process.argv[2] as 'major' | 'minor' | 'patch';

if (!bump) {
	console.error('Please specify a bump type: major, minor, or patch');
	process.exit(1);
}

// Ensure git is clean before proceeding
const code = await Bun.spawn(['git', 'diff', '--quiet']).exited;
if (code !== 0) {
	console.error(
		'Git working directory is not clean. Please commit or stash your changes before releasing.'
	);
	process.exit(1);
}

const pkgjson = (await Bun.file('package.json').json()) as { version: string };

const [major, minor, patch] = pkgjson.version.split('.').map((part) => {
	const parsed = Number.parseInt(part, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
});

if (major === undefined || minor === undefined || patch === undefined) {
	console.error('Invalid version in package.json');
	process.exit(1);
}

switch (bump) {
	case 'major':
		pkgjson.version = `${major + 1}.0.0`;
		break;
	case 'minor':
		pkgjson.version = `${major}.${minor + 1}.0`;
		break;
	case 'patch':
		pkgjson.version = `${major}.${minor}.${patch + 1}`;
		break;
	default:
		console.error('Invalid bump type. Use "major", "minor", or "patch".');
		process.exit(1);
}

await Bun.write('package.json', JSON.stringify(pkgjson, null, 2) + '\n');

await Bun.spawn(['git', 'add', 'package.json']).exited;
await Bun.spawn(['git', 'commit', '-m', `🔖 Release ${pkgjson.version}`]).exited;
await Bun.spawn(['git', 'tag', `v${pkgjson.version}`]).exited;
