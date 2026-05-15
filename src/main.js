import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset } from 'crawlee';

await Actor.init();

const input = await Actor.getInput();
const startUrl = input.startUrl;

const seen = new Set();

const crawler = new PlaywrightCrawler({
    requestHandlerTimeoutSecs: 60,

    async requestHandler({ request, page, enqueueLinks, log }) {
        log.info(`Opening: ${request.url}`);

        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

        if (request.label === 'DETAIL') {
            const title = await page.locator('h1').first().textContent().catch(() => null);
            const bodyText = await page.locator('body').innerText().catch(() => '');

            await Dataset.pushData({
                title: title?.trim() ?? '',
                url: request.url,
                fullText: bodyText
            });

            return;
        }

        const links = await page.locator('a[href*="/jobs/vacancies/"]').evaluateAll((anchors) =>
            anchors.map((a) => a.href)
        ).catch(() => []);

        for (const url of links) {
            if (!seen.has(url)) {
                seen.add(url);
                await crawler.addRequests([{ url, label: 'DETAIL' }]);
            }
        }

        log.info(`Found ${seen.size} vacancy links`);
    }
});

await crawler.run([{ url: startUrl, label: 'LIST' }]);

await Actor.exit();
