const needle = require("needle");
const { createClioFolder, initiateClioFileUpload, formatClioHeaders, finaliseFileUpload, getMultiPartRanges } = require("../../utils/clio");
const { getDropboxFolderTree, getFileStream } = require("../../utils/dropbox");
const checkpoint = require('../../utils/checkpoint');
const { waitForOffPeak } = require("../../utils/timeWindow");
const logger = require ('./logger');

const ONE_HUNDRED_MB = 100 * 1024 * 1024;

const flattenFiles = treeNode => {
    let files = [];

    for (const child of treeNode.children) {
        if (child.type === 'file') {
            files.push(child);
        } else if (child.type === 'folder') {
            files = files.concat(flattenFiles(child));
        }
    }
    return files;
};

const uploadFileToClio = async (file, parentId, parentType) => {
    // Initiate file upload
    const uploadData = await initiateClioFileUpload(file.name, parentId, parentType, file.size);

    const version = uploadData.latest_document_version;
    const uuid = version.uuid;
    const docId = uploadData.id;

    // Single file upload
    if (file.size < ONE_HUNDRED_MB) {
        const putUrl = version.put_url;
        const putHeaders = formatClioHeaders(version.put_headers);
        const stream = await getFileStream(file.path);

        await new Promise((resolve, reject) => {
            needle.put(putUrl, stream, {headers: putHeaders }, (err, resp) => {
                if (err) return reject(err);
                if (resp.statusCode >= 200 && resp.statusCode < 300) return resolve();
                reject(new Error(`Upload failed: ${resp.statusCode}`));
            });
        });
    } else { // Multipart upload

        const multiparts = getMultiPartRanges(file.size);

        const mergedMultiparts = version.multiparts.map(clioPart => {
            const localPart = multiparts.find(lp => lp.part_number === clioPart.part_number);

            if (!localPart) {
                throw new Error(`No local range for Clio part ${clioPart.part_number}`);
            }

            return {
                part_number: clioPart.part_number,
                put_url: clioPart.put_url,
                put_headers: clioPart.put_headers,
                start: localPart.start,
                end: localPart.end,
                content_length: localPart.content_length
            };
        });

        for (const part of mergedMultiparts) {
            const { start, end, part_number, put_url, put_headers } = part;

            const stream = await getFileStream(file.path, start, end);
            const headers = formatClioHeaders(put_headers);

            logger.info(`Clio | Uploading part ${part_number} (${start}-${end})…`);

            await new Promise((resolve, reject) => {
                needle.put(put_url, stream, { headers }, (err, resp) => {
                    if (err) return reject(err);
                    if (resp.statusCode >= 200 && resp.statusCode < 300) return resolve();
                    reject(new Error(`Upload failed: ${resp.statusCode}`));
                });
            });
        }
    }

    await finaliseFileUpload(docId, uuid);
    logger.info(`Clio | Document ${docId} fully uploaded.`);
}


const migrateDropboxPathIntoClio = async (dropboxRootPath, matterId) => {
    try {
        // Wait until off-peak before starting
        await waitForOffPeak();

        // Skip case if already completed
        if (checkpoint.isCaseCompleted(dropboxRootPath)) {
            logger.info(`✔ Case ${dropboxRootPath} already completed; skipping.`);
            return;
        }

        // Mark case as started
        checkpoint.markCaseStarted(dropboxRootPath);

        // Create top-level "Dropbox Migration" folder in Clio
        const migrationRootName = "Dropbox Migration";
        const migrationRootClioFolder = await createClioFolder(migrationRootName, matterId, 'Matter');
        logger.info(`Clio | Created migration root folder ${migrationRootName} with Clio ID ${migrationRootClioFolder.id} for DropboxPath ${dropboxRootPath}`);

        const dropboxTree = await getDropboxFolderTree(dropboxRootPath);

        const folderMapping = {};
        folderMapping[dropboxRootPath.toLowerCase()] = migrationRootClioFolder.id;

        // Recursively recreate dropbox folders under migration root
        await (async function recurse(node) {
            for (const child of node.children.filter(c => c.type === 'folder')) {
                const clioParentId = folderMapping[node.path.toLowerCase()];

                const clioFolder = await createClioFolder(child.name, clioParentId, 'Folder');
                folderMapping[child.path.toLowerCase()] = clioFolder.id;

                await recurse(child);
            }
        })(dropboxTree);

        // Upload files
        for (const fileNode of flattenFiles(dropboxTree)) {
            const filePath = fileNode.path.toLowerCase();

            // Skip already uploaded files
            if (checkpoint.isFileCompleted(dropboxRootPath, filePath)) {
                logger.info(`  → Skipping ${filePath}; already completed.`);
                continue;
            }

            // Determine dropbox parent folder
            const parentPath = fileNode.path.substring(0, fileNode.path.lastIndexOf('/')).toLowerCase();
            const clioFolderId = folderMapping[parentPath];

            try {
                // File upload proces
                await uploadFileToClio(fileNode, clioFolderId, 'Folder');

                // Save upload completion to checkpoint
                checkpoint.markFileCompleted(dropboxRootPath,filePath, {
                    clioFolderId,
                    timestamp: new Date().toISOString()
                });
                logger.info(`  ✔ Uploaded ${filePath}`);
            } catch (error) {
                // Save failure to checkpoint
                checkpoint.markFileFailed(dropboxRootPath, filePath, error.message);
                logger.error(`  ✖ Failed ${filePath}:`, error);
            }

        }

        checkpoint.markCaseCompleted(dropboxRootPath);
        logger.info(`🎉 Case ${dropboxRootPath} migration fully completed.`);
    } catch (error) {
        logger.error(`Migration for case ${dropboxRootPath} failed:`, error);
        throw error;
    }

};

module.exports = migrateDropboxPathIntoClio;
