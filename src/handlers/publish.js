import { extractTitleFromContent, generateFilename } from './generate.js';

export async function publishToGitHub(request, env) {
    try {
        console.log('Starting GitHub publish process...');
        
        // Parse and validate request
        let content;
        try {
            const requestBody = await request.json();
            content = requestBody.content;
        } catch (parseError) {
            console.error('Failed to parse request JSON:', parseError);
            return new Response(JSON.stringify({
                error: 'Invalid request format',
                details: 'Request must contain valid JSON with content field'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!content || typeof content !== 'string') {
            return new Response(JSON.stringify({
                error: 'Content is required and must be a string'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate environment variables
        if (!env.GITHUB_TOKEN) {
            console.error('GitHub token not configured in environment');
            return new Response(JSON.stringify({
                error: 'GitHub token not configured',
                details: 'Please set GITHUB_TOKEN in your Cloudflare Worker secrets'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get configuration with defaults
        const githubRepo = env.GITHUB_REPO || 'martinuke0/martinuke0.github.io';
        const postsPath = env.GITHUB_POSTS_PATH || 'posts';
        const branch = env.GITHUB_BRANCH || 'main';
        
        console.log(`Configuration - Repo: ${githubRepo}, Path: ${postsPath}, Branch: ${branch}`);

        // Validate content structure
        if (!content.includes('---') || !content.includes('title:')) {
            return new Response(JSON.stringify({
                error: 'Content must include proper frontmatter with title',
                details: 'Content should start with YAML frontmatter containing at least a title field'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Extract title and generate filename
        const title = extractTitleFromContent(content);
        if (!title || title === 'Untitled Post') {
            return new Response(JSON.stringify({
                error: 'Could not extract valid title from content',
                details: 'Ensure your frontmatter includes a proper title field'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const filename = generateFilename(title);
        const filePath = postsPath.endsWith('/') ? `${postsPath}${filename}` : `${postsPath}/${filename}`;
        
        console.log(`Generated filename: ${filename}, Full path: ${filePath}`);

        // Validate file path doesn't contain dangerous characters
        if (filePath.includes('..') || filePath.includes('~')) {
            return new Response(JSON.stringify({
                error: 'Invalid file path',
                details: 'File path contains potentially dangerous characters'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Perform GitHub operation
        const result = await createOrUpdateGitHubFile({
            token: env.GITHUB_TOKEN,
            repo: githubRepo,
            path: filePath,
            content: content,
            branch: branch,
            message: `Add new blog post: ${title}`
        });

        if (result.error) {
            console.error('GitHub operation failed:', result.error, result.details);
            return new Response(JSON.stringify({
                error: result.error,
                details: result.details,
                troubleshooting: 'Check your GitHub token permissions and repository access'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const successMessage = `Blog post "${title}" ${result.created ? 'created' : 'updated'} successfully at ${filePath}`;
        console.log('Publish successful:', successMessage);

        return new Response(JSON.stringify({
            success: true,
            message: successMessage,
            filename: filename,
            path: filePath,
            url: `https://github.com/${githubRepo}/blob/${branch}/${filePath}`,
            commit: result.commit,
            created: result.created
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Unexpected error in publishToGitHub:', error);
        
        return new Response(JSON.stringify({
            error: 'Internal server error during publishing',
            message: error.message,
            stack: error.stack // Include stack trace for debugging
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function createOrUpdateGitHubFile({ token, repo, path, content, branch, message }) {
    try {
        console.log(`Starting GitHub operation for repo: ${repo}, path: ${path}, branch: ${branch}`);
        
        // Validate token format
        if (!token || !token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
            return {
                error: 'Invalid GitHub token format',
                details: 'Token should start with "ghp_" or "github_pat_"'
            };
        }

        const [owner, repoName] = repo.split('/');
        
        // Validate repo format
        if (!owner || !repoName) {
            return {
                error: 'Invalid repository format',
                details: 'Repository should be in format "owner/repo"'
            };
        }
        
        // First, validate the repository exists and we have access
        const repoCheckUrl = `https://api.github.com/repos/${owner}/${repoName}`;
        console.log(`Checking repository access: ${repoCheckUrl}`);
        
        const repoCheckResponse = await fetch(repoCheckUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Blog-Post-Generator/1.0'
            }
        });

        if (!repoCheckResponse.ok) {
            const errorText = await repoCheckResponse.text();
            console.error('Repository access check failed:', errorText);
            
            if (repoCheckResponse.status === 401) {
                return { error: 'Invalid GitHub token', details: 'Token is expired, revoked, or invalid' };
            } else if (repoCheckResponse.status === 403) {
                return { error: 'Insufficient permissions', details: 'Token lacks required permissions for this repository' };
            } else if (repoCheckResponse.status === 404) {
                return { error: 'Repository not found', details: `Repository ${repo} does not exist or is not accessible` };
            }
            
            return {
                error: 'Repository access failed',
                details: `HTTP ${repoCheckResponse.status}: ${errorText}`
            };
        }

        const repoData = await repoCheckResponse.json();
        console.log('Repository access confirmed:', repoData.full_name);

        // Check if we have write permissions
        if (!repoData.permissions || !repoData.permissions.push) {
            return {
                error: 'Insufficient write permissions',
                details: 'Token does not have write access to this repository'
            };
        }

        // Check if file exists
        const getFileUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(path)}?ref=${branch}`;
        console.log(`Checking file existence: ${getFileUrl}`);
        
        let getFileResponse;
        try {
            getFileResponse = await fetch(getFileUrl, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Blog-Post-Generator/1.0'
                }
            });
        } catch (error) {
            console.error('Error checking file existence:', error);
            return { error: 'Failed to check file existence', details: error.message };
        }

        const fileData = getFileResponse.ok ? await getFileResponse.json() : null;
        console.log('File exists:', !!fileData);
        
        // Prepare the request body with proper UTF-8 encoding
        const body = {
            message: message,
            content: base64Encode(content),
            branch: branch
        };

        if (fileData && fileData.sha) {
            body.sha = fileData.sha;
            console.log('Updating existing file with SHA:', fileData.sha);
        } else {
            console.log('Creating new file');
        }

        const createOrUpdateUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(path)}`;
        console.log(`Creating/updating file: ${createOrUpdateUrl}`);
        
        const response = await fetch(createOrUpdateUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'Blog-Post-Generator/1.0'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GitHub API error:', errorText);
            
            // Parse GitHub error response for more details
            let errorDetails = `HTTP ${response.status}: ${errorText}`;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.message) {
                    errorDetails = errorJson.message;
                    if (errorJson.errors && errorJson.errors.length > 0) {
                        errorDetails += ` - ${errorJson.errors[0].message}`;
                    }
                }
            } catch (e) {
                // Use raw error text if JSON parsing fails
            }
            
            // Handle specific error cases
            if (response.status === 401) {
                return { error: 'Authentication failed', details: 'GitHub token is invalid or expired' };
            } else if (response.status === 403) {
                return { error: 'Permission denied', details: 'Token lacks required permissions or rate limit exceeded' };
            } else if (response.status === 404) {
                return { error: 'Resource not found', details: 'Repository or path does not exist' };
            } else if (response.status === 422) {
                return { error: 'Validation failed', details: errorDetails };
            }
            
            return {
                error: 'Failed to create/update file in GitHub',
                details: errorDetails
            };
        }

        const result = await response.json();
        console.log('GitHub operation successful:', result.commit.sha);
        
        return {
            success: true,
            commit: result.commit,
            created: !fileData
        };

    } catch (error) {
        console.error('Error in createOrUpdateGitHubFile:', error);
        return {
            error: 'Unexpected error during GitHub operation',
            details: error.message
        };
    }
}

// Helper function to properly encode UTF-8 strings to base64
function base64Encode(str) {
    try {
        // Convert string to UTF-8 bytes, then to base64
        return btoa(unescape(encodeURIComponent(str)));
    } catch (error) {
        console.error('Error encoding content to base64:', error);
        throw new Error('Failed to encode content for GitHub API');
    }
}

export async function validateGitHubPermissions(token, repo) {
    try {
        const [owner, repoName] = repo.split('/');
        const url = `https://api.github.com/repos/${owner}/${repoName}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Blog-Post-Generator/1.0'
            }
        });

        if (!response.ok) {
            return {
                valid: false,
                error: `Cannot access repository: HTTP ${response.status}`
            };
        }

        const repoData = await response.json();
        
        const permissions = repoData.permissions;
        if (!permissions || !permissions.push) {
            return {
                valid: false,
                error: 'Token does not have write permissions for this repository'
            };
        }

        return { valid: true };

    } catch (error) {
        return {
            valid: false,
            error: `Error validating permissions: ${error.message}`
        };
    }
}