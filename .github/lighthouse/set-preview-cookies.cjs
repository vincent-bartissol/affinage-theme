module.exports = async (browser) => {
	const password = process.env.SHOP_PASSWORD || '';
	const host = process.env.SHOP_HOST;
	const previewUrl = process.env.PREVIEW_URL;
	const page = await browser.newPage();

	if (password !== '') {
		await page.goto(`${host}/password${process.env.PREVIEW_QUERY}`);
		await page.waitForSelector('form[action*=password] input[type="password"]');
		await page.$eval(
			'form[action*=password] input[type="password"]',
			(input, value) => {
				input.value = value;
			},
			password,
		);
		await Promise.all([
			page.waitForNavigation(),
			page.$eval('form[action*=password]', (form) => form.submit()),
		]);
	}

	await page.goto(previewUrl);
	await page.close();
};
