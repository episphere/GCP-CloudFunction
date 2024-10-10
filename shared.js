const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

const setHeaders = (res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers','Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
}

const fetchSecrets = async (local) => {
    const secrets = {};

    if (local) {
        secrets.client_id = process.env.GITHUB_CLIENT_ID_DEV;
        secrets.client_secret = process.env.GITHUB_CLIENT_SECRET_DEV;
    }
    else{
        secrets.client_id = process.env.GITHUB_CLIENT_ID;
        secrets.client_secret = process.env.GITHUB_CLIENT_SECRET;
    }

    const client = new SecretManagerServiceClient();
    let fetchedSecrets = {};

    for (const [key, value] of Object.entries(secrets)) {
        const [version] = await client.accessSecretVersion({ name: value });
        fetchedSecrets[key] = version.payload.data.toString();
    }
    
    return fetchedSecrets;
}

const updateIndexFile = async (octokit, owner, repo, filePath, content) => {
    try {
        const indexPath = 'index.json';
        let indexContent = {};
        let indexSha = null;
    
        // Step 1: Fetch the existing index.json (if it exists)
        try {
            const indexResponse = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                owner,
                repo,
                path: indexPath,
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28',
                },
            });
    
            const indexData = Buffer.from(indexResponse.data.content, 'base64').toString('utf-8');
            indexContent = JSON.parse(indexData);
            indexSha = indexResponse.data.sha;
        } catch (error) {
            // If index.json doesn't exist, we'll create a new one
            if (error.status !== 404) {
                throw error;
            }
        }
    
        // Ensure indexContent is an object
        if (!indexContent || typeof indexContent !== 'object') {
            indexContent = {};
        }
    
        // Step 2: Read the "key" value from the file content
        const fileData = Buffer.from(content, 'base64').toString('utf-8');
        const fileJson = JSON.parse(fileData);
        const keyValue = fileJson.key || '';
    
        // Step 3: Update the indexContent with the new/updated entry
        indexContent[filePath] = keyValue;
    
        // Step 4: Commit the updated index.json
        const updatedIndexContent = Buffer.from(JSON.stringify(indexContent, null, 2)).toString('base64');
    
        const commitMessage = `Update index.json for ${filePath}`;
    
        await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
            owner,
            repo,
            path: indexPath,
            message: commitMessage,
            content: updatedIndexContent,
            sha: indexSha, // If indexSha is null, it will create the file
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });
    } catch (error) {
        console.error('Error updating index.json:', error);
        throw error;
    }
};
 
module.exports = {
    setHeaders,
    fetchSecrets,
    updateIndexFile
}