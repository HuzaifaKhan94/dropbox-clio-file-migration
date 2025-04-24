const axios = require('axios');
const needle = require('needle');
const logger = require ('./logger');
const { getAccessToken } = require('./clioAuth');

const ONE_HUNDRED_MB = 100 * 1024 * 1024;
const CHUNK_SIZE = 30 * 1024 * 1024;

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

const fetchAllMatters = async () => {
    const ACCESS_TOKEN = await getAccessToken();
    const baseUrl = 'https://eu.app.clio.com/api/v4/matters.json';

    const params = new URLSearchParams({
        fields: 'id,number,display_number,description',
        order: 'id(asc)'
    });

    const headers =  { Authorization: `Bearer ${ACCESS_TOKEN}` };

    let matters = [];
    let url = `${baseUrl}?${params}`;

    while (url) {
        try {
            const response = await clioRequestWithBackoff({
                method: 'get',
                url,
                headers
            }, {
                maxRetries: 8,
                baseDelay: 1000
            });
    
            matters.push(...response.data.data);
    
            url = response.data.meta?.paging?.next || null;
        } catch (error) {
            logger.error(`Clio | Error fetching Clio Matters`, error.response?.data || error.message);
            throw error;
        }
    }

    return matters;
};

const formatClioHeaders = headerArray => {
    return headerArray.reduce((h, {name, value}) => {
        h[name] = value;
        return h;
    }, {});
};

const createClioFolder = async (folderName, parentId, parentType) => {
    const ACCESS_TOKEN = await getAccessToken();
    const clioUrl = "https://eu.app.clio.com/api/v4/folders.json?fields=id,type,name,parent{id,type,name}";

    const payload = {
        data: {
            name: folderName,
            parent: {
                id: parentId,
                type: parentType
            }
        }
    };

    const axiosConfig = {
        method: 'post',
        url: clioUrl,
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        data: payload
    };

    try {
        const response = await clioRequestWithBackoff(axiosConfig, {
            maxRetries: 8,
            baseDelay: 1000
        });

        logger.info(`Clio | Clio folder created. Folder ID ${response.data.data.id}`);
        return response.data.data;
    } catch (error) {
        logger.error(`Clio | Error creating Clio Folder ${folderName}`, error.response?.data || error.message);
        throw error;
    }
};


const getMultiPartRanges = (fileSize, MAX_PART_SIZE=CHUNK_SIZE) => {
    const ranges = [];
    let start = 0;
    let partNumber = 1;

    while (start < fileSize) {
        const end = Math.min(start + MAX_PART_SIZE, fileSize) - 1;
        const size = end - start + 1;

        ranges.push({
            part_number: partNumber,
            start,
            end,
            content_length: size
        });

        start = end + 1;
        partNumber++;
    }

    return ranges;
};

const initiateClioFileUpload = async (fileName, parentId, parentType='Folder', fileSize) => {
    const ACCESS_TOKEN = await getAccessToken();
    const clioUrl = 'https://eu.app.clio.com/api/v4/documents?fields=id,latest_document_version{uuid,put_url,put_headers,multiparts}';
    let payload;

    // Single file upload
    if (fileSize < ONE_HUNDRED_MB) {
        payload = {
            data: {
                name: fileName,
                parent: {
                    id: parentId,
                    type: parentType
                }
            }
        };
    } else { // Multi-part upload

        const multiparts = getMultiPartRanges(fileSize, CHUNK_SIZE);

        payload = {
            data: {
              name: fileName,
              parent: {
                id: parentId,
                type: parentType
              },
              multiparts: multiparts
            }
        };
    }

    const axiosConfig = {
        method: 'post',
        url: clioUrl,
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        data: payload
    };

    try {
        const response = await clioRequestWithBackoff(axiosConfig, {
            maxRetries: 8,
            baseDelay: 1000
        });

        logger.info(`Clio | Clio document created. Document ID: ${response.data.data.id}`);
        return response.data.data;
    } catch (error) {
        logger.error('Clio | Error creating Clio document:', error.response?.data || error.message);
        throw error;
    }
};



const streamFileToClio = async (filestream, clioPutUrl, putHeaders) => {
    filestream.pipe(
        needle.put(clioPutUrl, filestream, { headers: putHeaders }, function(err, resp) {
            if (err) {
                logger.error('Clio | Error during streaming upload: ', err);
            } else {
                logger.info('Clio | Streaming upload success: ', resp.statusCode);
            }
        })
    );
};

const finaliseFileUpload = async (documentId, uuid) => {
    const ACCESS_TOKEN = await getAccessToken();
    const url = `https://eu.app.clio.com/api/v4/documents/${documentId}?fields=id,latest_document_version{fully_uploaded}`;

    const payload = {
        data: {
            uuid,
            fully_uploaded: true
        }
    };

    const axiosConfig = {
        method: 'patch',
        url,
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        data: payload
    };

    try {
        const response = await clioRequestWithBackoff(axiosConfig, {
            maxRetries: 8,
            baseDelay: 1000
        });

        logger.info(`Clio | Clio file upload finalised. Document ID: ${documentId}`);
        return response.data.data;
    } catch (error) {
        logger.error(`Clio | Error finalising Clio document upload ${documentId}:`, error.response?.data || error.message);
        throw error;
    }
};

module.exports = {
    initiateClioFileUpload,
    createClioFolder,
    formatClioHeaders,
    streamFileToClio,
    finaliseFileUpload,
    getMultiPartRanges,
    fetchAllMatters,
    clioRequestWithBackoff
}

