export async function diagnoseGitHubIssues(request, env) {
    try {
        console.log('Starting GitHub diagnostics...');
        
        const diagnostics = {
            timestamp: new Date().toISOString(),
            checks: [],
            overall_status: 'unknown'
        };

        // Check 1: Environment variables
        const envCheck = {
            name: 'Environment Variables',
            status: 'pass',
            details: {}
        };

        if (!env.GITHUB_TOKEN) {
            envCheck.status = 'fail';
            envCheck.details.github_token = 'Missing GITHUB_TOKEN';
        } else {
            envCheck.details.github_token = 'Present';
            // Check token format
            if (env.GITHUB_TOKEN.startsWith('ghp_')) {
                envCheck.details.token_format = 'Classic token (ghp_)';
            } else if (env.GITHUB_TOKEN.startsWith('github_pat_')) {
                envCheck.details.token_format = 'Fine-grained token (github_pat_)';
            } else {
                envCheck.status = 'warning';
                envCheck.details.token_format = 'Unknown token format';
            }
        }

        envCheck.details.github_repo = env.GITHUB_REPO || 'Default: martinuke0/martinuke0.github.io';
        envCheck.details.github_posts_path = env.GITHUB_POSTS_PATH || 'Default: posts';
        envCheck.details.github_branch = env.GITHUB_BRANCH || 'Default: main';

        diagnostics.checks.push(envCheck);

        // Check 2: Token validation (only if token exists)
        if (env.GITHUB_TOKEN) {
            const tokenCheck = {
                name: 'GitHub Token Validation',
                status: 'unknown',
                details: {}
            };

            try {
                const response = await fetch('https://api.github.com/user', {
                    headers: {
                        'Authorization': `token ${env.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Blog-Post-Generator/1.0'
                    }
                });

                if (response.ok) {
                    const userData = await response.json();
                    tokenCheck.status = 'pass';
                    tokenCheck.details.user = userData.login;
                    tokenCheck.details.scopes = response.headers.get('X-OAuth-Scopes') || 'Not specified';
                } else {
                    tokenCheck.status = 'fail';
                    tokenCheck.details.error = `HTTP ${response.status}`;
                    tokenCheck.details.message = await response.text();
                }
            } catch (error) {
                tokenCheck.status = 'fail';
                tokenCheck.details.error = error.message;
            }

            diagnostics.checks.push(tokenCheck);

            // Check 3: Repository access (only if token is valid)
            if (tokenCheck.status === 'pass') {
                const repoCheck = {
                    name: 'Repository Access',
                    status: 'unknown',
                    details: {}
                };

                const githubRepo = env.GITHUB_REPO || 'martinuke0/martinuke0.github.io';
                const [owner, repoName] = githubRepo.split('/');

                if (!owner || !repoName) {
                    repoCheck.status = 'fail';
                    repoCheck.details.error = 'Invalid repository format';
                } else {
                    try {
                        const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
                            headers: {
                                'Authorization': `token ${env.GITHUB_TOKEN}`,
                                'Accept': 'application/vnd.github.v3+json',
                                'User-Agent': 'Blog-Post-Generator/1.0'
                            }
                        });

                        if (response.ok) {
                            const repoData = await response.json();
                            repoCheck.status = 'pass';
                            repoCheck.details.repository = repoData.full_name;
                            repoCheck.details.private = repoData.private;
                            repoCheck.details.default_branch = repoData.default_branch;
                            
                            // Check permissions
                            if (repoData.permissions) {
                                repoCheck.details.permissions = {
                                    read: repoData.permissions.pull,
                                    write: repoData.permissions.push,
                                    admin: repoData.permissions.admin
                                };
                                
                                if (!repoData.permissions.push) {
                                    repoCheck.status = 'warning';
                                    repoCheck.details.warning = 'No write permissions';
                                }
                            } else {
                                repoCheck.status = 'warning';
                                repoCheck.details.warning = 'Permissions not available in response';
                            }
                        } else {
                            repoCheck.status = 'fail';
                            repoCheck.details.error = `HTTP ${response.status}`;
                            repoCheck.details.message = await response.text();
                        }
                    } catch (error) {
                        repoCheck.status = 'fail';
                        repoCheck.details.error = error.message;
                    }
                }

                diagnostics.checks.push(repoCheck);
            }
        }

        // Check 4: Branch existence (if repo access is OK)
        const repoAccessCheck = diagnostics.checks.find(check => check.name === 'Repository Access');
        if (repoAccessCheck && repoAccessCheck.status === 'pass') {
            const branchCheck = {
                name: 'Branch Access',
                status: 'unknown',
                details: {}
            };

            const githubRepo = env.GITHUB_REPO || 'martinuke0/martinuke0.github.io';
            const [owner, repoName] = githubRepo.split('/');
            const branch = env.GITHUB_BRANCH || 'main';

            try {
                const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/branches/${branch}`, {
                    headers: {
                        'Authorization': `token ${env.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Blog-Post-Generator/1.0'
                    }
                });

                if (response.ok) {
                    const branchData = await response.json();
                    branchCheck.status = 'pass';
                    branchCheck.details.branch = branchData.name;
                    branchCheck.details.protected = branchData.protected;
                    branchCheck.details.last_commit = branchData.commit.sha;
                } else {
                    branchCheck.status = 'fail';
                    branchCheck.details.error = `HTTP ${response.status}`;
                    branchCheck.details.message = await response.text();
                }
            } catch (error) {
                branchCheck.status = 'fail';
                branchCheck.details.error = error.message;
            }

            diagnostics.checks.push(branchCheck);
        }

        // Determine overall status
        const failedChecks = diagnostics.checks.filter(check => check.status === 'fail');
        const warningChecks = diagnostics.checks.filter(check => check.status === 'warning');
        
        if (failedChecks.length > 0) {
            diagnostics.overall_status = 'fail';
        } else if (warningChecks.length > 0) {
            diagnostics.overall_status = 'warning';
        } else {
            diagnostics.overall_status = 'pass';
        }

        // Add recommendations
        diagnostics.recommendations = [];
        
        failedChecks.forEach(check => {
            switch (check.name) {
                case 'Environment Variables':
                    diagnostics.recommendations.push('Set up GITHUB_TOKEN secret using: wrangler secret put GITHUB_TOKEN');
                    break;
                case 'GitHub Token Validation':
                    diagnostics.recommendations.push('Check your GitHub token - it may be expired or invalid');
                    diagnostics.recommendations.push('Create a new token with proper permissions');
                    break;
                case 'Repository Access':
                    diagnostics.recommendations.push('Verify the repository name and your access to it');
                    diagnostics.recommendations.push('Ensure the token has repo scope permissions');
                    break;
                case 'Branch Access':
                    diagnostics.recommendations.push(`Verify branch '${env.GITHUB_BRANCH || 'main'}' exists in the repository`);
                    break;
            }
        });

        warningChecks.forEach(check => {
            if (check.details.warning === 'No write permissions') {
                diagnostics.recommendations.push('Ensure your GitHub token has write permissions (repo scope)');
            }
        });

        return new Response(JSON.stringify(diagnostics, null, 2), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in diagnoseGitHubIssues:', error);
        
        return new Response(JSON.stringify({
            error: 'Diagnostic tool failed',
            message: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}