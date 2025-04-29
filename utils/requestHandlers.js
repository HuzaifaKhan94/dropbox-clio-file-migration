const axios = require('axios');
const logger = require ('./logger');

const sleep = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};


const clioRequestWithBackoff = async (axiosConfig, {
    maxRetries = 5,
    baseDelay = 1000
} = {}) => {
    let attempt = 0;

    while (true) {
        try {
            const response = await axios(axiosConfig);
            return response;
        } catch (err) {
            const status = err.response?.status;

            if (status === 429 && attempt < maxRetries) {
                const headers = err.response.headers;

                let waitMs = 0;
                if (headers['retry-after']) {
                    waitMs = parseFloat(headers['retry-after']) * 1000;
                    logger.warn(`Clio | 429: retry-after=${headers['retry-after']}s`);
                } else if (headers['x-ratelimit-reset']) {
                    const resetTs = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
                    waitMs = resetTs - Date.now();
                    logger.warn(`Clio | 429: rate-limit-reset at ${new Date(resetTs).toISOString()}`);
                } else {
                    waitMs = baseDelay * (2 ** attempt);
                    logger.warn(`Clio | 429: no headers, backoff ${waitMs}ms`);
                }

                waitMs = Math.max(waitMs, 0);

                logger.info(`Clio | → Waiting ${waitMs}ms before retrying Clio request…`);
                await sleep(waitMs);
                attempt++;
                continue;
            }

            throw err;
        }
    }
};

const dropboxRequestWithBackoff = async (fn, args=[], {
    maxRetries = 5,
    baseDelay = 1000
} = {}) => {
    let attempt = 0;

    while (true) {
        try {
            return await fn(...args);
        } catch (err) {
            const status = err?.status || err?.response?.status || 0;

            // Attempt retry on rate limit
            if ((status === 429 || status === 503) && attempt < maxRetries) {
                // Parse Retry-After if present
                const retryAfterSec = parseInt(err?.response?.headers?.['retry-after'], 10);

                const retryAfterMs = Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : baseDelay * (2 ** attempt);

                logger.warn(`Dropbox | Rate Limited (HTTP ${status}). Retrying in ${retryAfterMs}ms...`);
                await sleep(retryAfterMs);
                attempt++;
                continue;
            }
            throw err;
        }
    }
};


module.exports = {
    clioRequestWithBackoff,
    dropboxRequestWithBackoff
};
