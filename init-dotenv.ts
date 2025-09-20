const dotenv = Bun.file('.env');

const exists = await dotenv.exists();

if (!exists) {
	console.warn('.env file not found, copying from .env.example');
	await dotenv.write(await Bun.file('.env.example').text());
}

export {};
