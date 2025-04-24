const axios = require('axios');
const { getDbxClient } = require('./dropboxAuth');
const logger = require ('./logger');

const sleep = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
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

// Recursively build tree of folders/files within 'rootPath'
const getDropboxFolderTree = async (rootPath) => {
    const dbx = await getDbxClient();

    let entries = [];
    // Fetch everything under rootPath
    let res = await dropboxRequestWithBackoff(
        dbx.filesListFolder.bind(dbx),
        [{
            path: rootPath,
            recursive: true,
            include_media_info: false,
            include_deleted: false
        }],
        {maxRetries: 8, baseDelay: 1000 }
    );

    entries.push(...res.result.entries);

    while (res.result.has_more) {
        res = await dropboxRequestWithBackoff(
            dbx.filesListFolderContinue.bind(dbx),
            [{ cursor: res.result.cursor }],
            {maxRetries: 8, baseDelay: 1000 }
        );

        entries.push(...res.result.entries);
    }

    logger.info(`Dropbox | Fetched files and folders for ${rootPath}`);

    // Init tree
    const tree = {
        name: rootPath === '' ? '' : rootPath.split('/').pop(),
        path: rootPath,
        type: 'folder',
        children: []
    };

    // Helper fn to find/create child folder in a node
    const getOrCreateFolder = (node, folderName, folderPath) => {
        let child = node.children.find(c => c.type === "folder" && c.name === folderName);
        if (!child) {
            child = { name: folderName, path: folderPath, type: 'folder', children: [] };
            node.children.push(child);
        }
        return child;
    };

    // Insert each entry into tree
    for (const entry of entries) {
        // Skip rootPath
        if (entry.path_lower === rootPath.toLowerCase()) continue;
        // Compute path relative to rootPath, then split
        const relPath = entry.path_lower.slice(rootPath.length + 1);
        const parts = relPath.split('/');

        let cursor = tree;
        // Walk/create intermediate folders
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            const fullPath = rootPath + '/' + parts.slice(0, i + 1).join('/');

            if (isLast && entry['.tag'] === 'file') {
                // Leaf = file
                cursor.children.push({
                    name: entry.name,
                    path: entry.path_lower,
                    type: 'file',
                    size: entry.size,
                    id: entry.id,
                    client_modified: entry.client_modified
                });
            } else {
                // Intermediate folder
                cursor = getOrCreateFolder(cursor, part, fullPath);
            }
        }
    }

    logger.info(`Dropbox | Constructed folder tree for ${rootPath}`);

    return tree;
};

const getTempFileLink = async (dropboxPath) => {
    const dbx = await getDbxClient();
    try {
        const { result } = await dropboxRequestWithBackoff(
            dbx.filesGetTemporaryLink.bind(dbx),
            [{ path: dropboxPath }],
            {maxRetries: 8, baseDelay: 1000}
        );

        return result.link;
    } catch (error) {
        logger.error(`Dropbox | Error getting temp file link for file ${dropboxPath}`, error);
        throw error;
    }
};

const getFileStream = async (dropboxPath, start, end) => {
    try {
        const url = await getTempFileLink(dropboxPath);
        const headers = {};

        if (typeof start === 'number' && typeof end === 'number') {
            headers.Range = `bytes=${start}-${end}`;
        }
    
        const resp = await axios.get(url, {
            responseType: 'stream',
            headers
        });
    
        return resp.data;
    } catch (error) {
        logger.error(`Dropbox | Error getting stream for file ${dropboxPath}`, error);
        throw error;
    }
};


module.exports = {
    getDropboxFolderTree,
    getFileStream
}