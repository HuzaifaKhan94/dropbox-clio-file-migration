const logger = require ('./logger');

const sleep = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const isOffPeak = () => {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    if (day === 0 || day === 6) return true;
    if (hour < 7 || hour >= 22) return true;

    return false;
};

const msUntilNextOffPeak = () => {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    const atUTC = (d, h, m=0, s=0) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, s) - Date.now();

    // If weekend return 0
    if (day === 0 || day === 6) return 0;

    // If before 07:00 return 0
    if (hour < 7) return 0;

    // If after 22:00 return 0
    if (hour >= 22) return 0;

    // Next off-peak begins at 22:00
    const msTo2200 = atUTC(now, 22, 0, 0);
    return msTo2200 > 0 ? msTo2200 : 0;
};

const waitForOffPeak = async () => {
    while (!isOffPeak()) {
        const waitMs = msUntilNextOffPeak();
        logger.info(
            `🔶 On-peak hours: sleeping ${Math.ceil(waitMs/1000)}s ` +
            `until off-peak (>=22:00 UTC)…`
        );

        await sleep(waitMs);
    }
};

module.exports = { isOffPeak, waitForOffPeak };