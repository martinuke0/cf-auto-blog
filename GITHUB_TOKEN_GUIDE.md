# GitHub Personal Access Token Setup Guide

This guide will help you create the perfect GitHub Personal Access Token for the Nat Lang Push.

## Required Permissions

For the Nat Lang Push to work properly, your token needs these specific permissions:

### **Core Permissions (Required):**
-  **`repo`** - Full control of private repositories
  - Allows creating, updating, and deleting files
  - Required for pushing blog posts to your repository

### **Optional Permissions (Recommended):**
-  **`workflow`** - Update GitHub Action workflows
  - Useful if your blog uses GitHub Actions for deployment
  - Not strictly required for basic functionality

## Step-by-Step Token Creation

### 1. Navigate to GitHub Settings
1. Log in to your GitHub account
2. Click your profile picture in the top-right corner
3. Select **"Settings"** from the dropdown menu

### 2. Access Developer Settings
1. In the left sidebar, scroll down to **"Developer settings"**
2. Click on **"Personal access tokens"**
3. Select **"Tokens (classic)"**

### 3. Generate New Token
1. Click the **"Generate new token"** button
2. You may be prompted to enter your GitHub password

### 4. Configure Token Details
Fill in the following fields:

**Note:** `Nat Lang Push` (or any descriptive name)

**Expiration:** Choose based on your preference:
- `30 days` (recommended for security)
- `90 days` (convenient)
- `No expiration` (not recommended for security reasons)

### 5. Select Permissions (Scopes)
Check these specific boxes:

####  **Required:**
- ☑️ **`repo`** - Full control of private repositories
  - This will automatically check:
    - `repo:status`
    - `repo_deployment`
    - `public_repo`
    - `repo:invite`
    - `security_events`
    - `write:packages`
    - `read:packages`
    - `delete:packages`
    - `admin:org`
    - `admin:public_key`
    - `admin:repo_hook`
    - `user`
    - `read:org`
    - `read:public_key`
    - `read:repo_hook`

####  **Optional (Recommended):**
- **`workflow`** - Update GitHub Action workflows

####  **Do NOT select:**
- `admin:org` (unless you need org-wide access)
- `admin:public_key` (unless you need key management)
- `admin:repo_hook` (unless you need webhook management)
- `delete_repo` (dangerous - allows repository deletion)
- `gist` (unless you need gist access)
- `notifications` (not needed)
- `user:email` (not needed)
- `user:follow` (not needed)

### 6. Generate and Copy Token
1. Click **"Generate token"** at the bottom
2. **IMPORTANT:** Copy the token immediately - you won't be able to see it again!
3. Store it securely (password manager recommended)

## 🔍 Token Example

Your token should look something like this:
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## ⚠️ Security Best Practices

###  Do:
- Store the token in a secure password manager
- Use the minimum required permissions
- Set an expiration date
- Rotate tokens regularly
- Keep the token secret (never share it)

###  Don't:
- Commit the token to any repository
- Share it in chat/email
- Use it in public code
- Give it to others
- Store it in plain text files

## 🔄 Token Renewal

### When to Renew:
- Before expiration date
- If you suspect it's compromised
- After changing team members
- Every 90 days (recommended)

### Renewal Process:
1. Follow the same creation steps
2. Update the token in your Cloudflare Worker secrets:
   ```bash
   wrangler secret put GITHUB_TOKEN
   ```
3. Enter your new token when prompted

## Testing Your Token

### Quick Test:
```bash
curl -H "Authorization: token YOUR_TOKEN_HERE" \
     https://api.github.com/user/repos
```

You should see a JSON list of your repositories.

### In the Nat Lang Push:
The system will automatically validate your token when you try to publish. If there are permission issues, you'll see specific error messages.

## Troubleshooting Common Issues

### Error: "Bad credentials"
- Token is incorrect or expired
- Solution: Create a new token

### Error: "Not Found"
- Repository name is wrong
- Token doesn't have access to the repository
- Solution: Check repository name and permissions

### Error: "Forbidden"
- Token lacks required permissions
- Solution: Ensure `repo` scope is selected

### Error: "Repository access denied"
- Token doesn't have write access
- Solution: Regenerate token with `repo` scope

## Quick Checklist

Before proceeding with the setup:

- [ ] Created token with `repo` scope
- [ ] Optional: Added `workflow` scope
- [ ] Set expiration date (recommended)
- [ ] Copied token securely
- [ ] Tested token works with your repository
- [ ] Ready to enter in setup script

---

**Ready?** Run `./setup.sh` and enter your GitHub Personal Access Token when prompted!