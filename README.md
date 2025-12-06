# Nat Lang Push

A Cloudflare Workers-based application that provides a ChatGPT-like interface for generating and publishing blog posts to GitHub using LLM assistance.

## Features

- **ChatGPT-like Interface**: Clean, modern web interface for interacting with the LLM
- **Content Generation**: Generate high-quality blog posts with proper frontmatter
- **Live Preview**: Preview markdown content before publishing
- **Edit Before Publish**: Make final tweaks to generated content
- **One-Click Publishing**: Push approved posts directly to GitHub
- **Configurable**: All settings via environment variables
- **Serverless**: Built on Cloudflare Workers - no server maintenance needed

## Architecture

```
User Browser → Cloudflare Worker → z.ai API → Generated Content
                ↓
            GitHub API → Published Blog Post
```

## Prerequisites

1. **Node.js** and **npm** installed
2. **Cloudflare account** with Workers enabled
3. **z.ai API key** for LLM generation
4. **GitHub Personal Access Token** with repository write access
5. **GitHub repository** for your blog posts

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd natlangpush
npm install
```

### 2. Configure Cloudflare Workers

Install Wrangler CLI if you haven't already:

```bash
npm install -g wrangler
```

Login to Cloudflare:

```bash
wrangler login
```

### 3. Set Environment Variables

Configure your `wrangler.toml` file (already included):

```toml
name = "natlangpush"
main = "src/index.js"
compatibility_date = "2023-12-01"

[vars]
LLM_API_URL = "https://api.z.ai/api/paas/v4/chat/completions"
GITHUB_REPO = "martinuke0/martinuke0.github.io"
GITHUB_POSTS_PATH = "posts"
GITHUB_BRANCH = "main"
```

### 4. Set Secrets

Set your sensitive data as Cloudflare Worker secrets:

```bash
wrangler secret put LLM_API_KEY
# Enter your z.ai API key when prompted

wrangler secret put GITHUB_TOKEN
# Enter your GitHub Personal Access Token
```

### 5. GitHub Token Setup

Create a GitHub Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token"
3. Select these permissions:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
4. Copy the generated token

### 6. Deploy

```bash
wrangler deploy
```

Your application will be available at `https://natlangpush.your-subdomain.workers.dev`

## Usage

### 1. Generate a Blog Post

1. Open the web interface
2. Describe what kind of post you want to create, for example:
   - "Write a tutorial about React hooks for beginners"
   - "Create a guide on setting up Docker for development"
   - "Explain the basics of machine learning in simple terms"
3. Click send or press Enter

### 2. Review and Edit

1. The generated content will appear in a preview modal
2. Left panel: Raw markdown editor
3. Right panel: Rendered preview
4. Make any necessary edits in the editor

### 3. Publish to GitHub

1. Click "Publish to GitHub" when satisfied
2. The post will be automatically:
   - Named with date and slugified title
   - Placed in your configured posts directory
   - Committed with a descriptive message

### 4. Regenerate if Needed

If you're not satisfied with the generated content:
- Click "Regenerate" to create a new version
- The system will use your original prompt

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_URL` | z.ai API endpoint | `https://api.z.ai/api/paas/v4/chat/completions` |
| `LLM_API_KEY` | Your z.ai API key (secret) | - |
| `GITHUB_TOKEN` | GitHub Personal Access Token (secret) | - |
| `GITHUB_REPO` | GitHub repository (owner/repo) | `martinuke0/martinuke0.github.io` |
| `GITHUB_POSTS_PATH` | Directory for blog posts | `posts` |
| `GITHUB_BRANCH` | Target branch | `main` |

## Generated Post Format

The system generates posts with Jekyll-style frontmatter:

```yaml
---
title: "Your Blog Post Title"
date: 2025-12-04T15:46:00+02:00
draft: false
tags: ["tag1", "tag2", "tag3"]
---

## Table of Contents
1. [Introduction](#introduction)
2. [Main Content](#main-content)
3. [Conclusion](#conclusion)

---

## Introduction {#introduction}

Your content here...
```

## API Endpoints

### `GET /`
Returns the main HTML interface.

### `POST /api/generate`
Generates a blog post based on the provided prompt.

**Request:**
```json
{
  "prompt": "Write about React hooks"
}
```

**Response:**
```json
{
  "content": "Generated markdown content",
  "usage": { "tokens": 1500 }
}
```

### `POST /api/publish`
Publishes content to GitHub.

**Request:**
```json
{
  "content": "Markdown content with frontmatter"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Blog post published successfully",
  "filename": "2025-12-04-react-hooks-guide.md",
  "path": "posts/2025-12-04-react-hooks-guide.md",
  "url": "https://github.com/user/repo/blob/main/posts/file.md"
}
```

### `GET /api/status`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-04T15:46:00.000Z",
  "llm_configured": true,
  "github_configured": true
}
```

## Development

### Local Development

Run the Worker locally:

```bash
wrangler dev
```

The application will be available at `http://localhost:8787`

### View Logs

```bash
wrangler tail
```

### Project Structure

```
natlangpush/
├── src/
│   ├── index.js              # Main Worker entry point
│   ├── app.js                 # Frontend JavaScript
│   ├── handlers/
│   │   ├── generate.js        # LLM integration
│   │   └── publish.js         # GitHub integration
│   └── templates/
│       └── index.js           # HTML template
├── wrangler.toml              # Cloudflare Worker config
├── package.json
└── README.md
```

## Security Considerations

-  API keys stored as Cloudflare secrets
-  CORS headers configured
-  Input validation on all endpoints
-  Error handling without sensitive information exposure
-  GitHub token with minimal required permissions

## Troubleshooting

### Common Issues

1. **"LLM API key not configured"**
   - Run `wrangler secret put LLM_API_KEY` and enter your z.ai API key

2. **"GitHub token not configured"**
   - Run `wrangler secret put GITHUB_TOKEN` and enter your GitHub PAT

3. **"Cannot access repository"**
   - Ensure your GitHub token has `repo` permissions
   - Verify the repository name in `GITHUB_REPO` variable

4. **"Failed to generate content from LLM"**
   - Check your z.ai API key is valid
   - Verify the `LLM_API_URL` is correct

### GitHub Publishing Errors (HTTP 500)

If you encounter "Failed to publish to GitHub: HTTP error! status: 500", follow these steps:

#### 1. Run Diagnostics
```bash
# Access the diagnostic endpoint
curl https://your-worker-url.workers.dev/api/diagnose
```

#### 2. Test GitHub Connection Locally
```bash
# Test your GitHub token and repository
node test-github.js YOUR_GITHUB_TOKEN owner/repo-name
```

#### 3. Common GitHub Issues

**Invalid Token:**
- Token must start with `ghp_` (classic) or `github_pat_` (fine-grained)
- Token may be expired or revoked
- Solution: Create a new token at https://github.com/settings/tokens

**Insufficient Permissions:**
- Token must have `repo` scope for classic tokens
- For fine-grained tokens, ensure repository write permissions
- Solution: Regenerate token with proper permissions

**Repository Not Found:**
- Repository name format should be `owner/repo`
- Repository must exist and be accessible
- Solution: Verify repository name and access

**Branch Not Found:**
- Default branch is `main` (can be changed with `GITHUB_BRANCH`)
- Branch must exist in the repository
- Solution: Check branch name and create if needed

**Rate Limiting:**
- GitHub API has rate limits
- Solution: Wait and retry, or use authenticated requests

#### 4. Debug Steps

1. **Check Environment Variables:**
   ```bash
   wrangler secret list
   ```

2. **View Detailed Logs:**
   ```bash
   wrangler tail --format pretty
   ```

3. **Verify Token Manually:**
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" \
        https://api.github.com/user
   ```

4. **Test Repository Access:**
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" \
        https://api.github.com/repos/owner/repo
   ```

#### 5. Fix Common Configuration Issues

**Update wrangler.toml:**
```toml
[vars]
GITHUB_REPO = "your-username/your-repo"
GITHUB_POSTS_PATH = "content/posts"  # or "posts", "_posts", etc.
GITHUB_BRANCH = "main"  # or "master", etc.
```

**Reset Secrets:**
```bash
wrangler secret put GITHUB_TOKEN
# Enter your new token when prompted
```

### Debug Mode

Add logging to see detailed error information:

```bash
wrangler tail --format pretty
```

### API Diagnostics

Use the built-in diagnostic endpoint:

```bash
curl https://your-worker-url.workers.dev/api/diagnose
```

This will check:
- Environment variables configuration
- GitHub token validity and scopes
- Repository access and permissions
- Branch existence and accessibility

### Test Script

Use the provided test script for comprehensive GitHub testing:

```bash
node test-github.js YOUR_TOKEN owner/repo-name
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `wrangler dev`
5. Deploy to test with `wrangler deploy`
6. Submit a pull request

### Quick Git Commands for Development

```bash
# Create and switch to new branch
git checkout -b cf-auto-blog

# Add all changes (excluding wrangler.toml)
git add .
git reset HEAD wrangler.toml

# Commit changes
git commit -m "Fix GitHub publishing UTF-8 encoding and add diagnostic tools"

# Push to remote
git push origin cf-auto-blog
```

### Interactive Git Workflow

For more complex workflows with multiple jobs and interactive choices:

```bash
# Run the interactive workflow manager
node git-workflow.js
```

The workflow manager provides:
- Multiple predefined jobs
- Interactive yes/no prompts for each step
- Ability to choose commit/push actions
- Error handling and recovery options

#### Available Jobs:
1. **Create cf-auto-blog branch** - Creates branch, adds files, prompts for commit/push
2. **Update documentation** - Updates README with changes, prompts for commit/push
3. **Push cf-auto-blog to main** - Merges cf-auto-blog into main branch
4. **Deploy to production** - Pushes current branch to remote

### Note on wrangler.toml
The `wrangler.toml` file contains personal configuration (GitHub username/repository) and should not be committed to avoid exposing personal information in forks.

### .gitignore
A `.gitignore` file is included to automatically exclude sensitive files:
- `wrangler.toml` (personal GitHub configuration)
- `.wrangler/` (Cloudflare Worker local data)
- Environment files (`.env*`)
- Node modules and logs

This ensures personal information stays private when contributing.

## License

MIT License - see LICENSE file for details.

## Support

If you encounter issues or have questions:

1. Check the troubleshooting section above
2. Review the Cloudflare Workers documentation
3. Check the z.ai API documentation
4. Create an issue in this repository

---

Built with ❤️ using Cloudflare Workers, z.ai, and GitHub API