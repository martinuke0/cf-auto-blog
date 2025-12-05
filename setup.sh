#!/bin/bash

# Nat Lang Push Setup Script
# This script helps set up the Nat Lang Push on Cloudflare Workers

echo "🚀 Nat Lang Push Setup"
echo "=============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo " Node.js is not installed. Please install Node.js first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo " npm is not installed. Please install npm first."
    exit 1
fi

echo " Node.js and npm are installed"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing Wrangler CLI..."
    npm install -g wrangler
    if [ $? -ne 0 ]; then
        echo " Failed to install Wrangler CLI"
        exit 1
    fi
else
    echo " Wrangler CLI is already installed"
fi

# Install project dependencies
echo "📦 Installing project dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo " Failed to install project dependencies"
    exit 1
fi

echo " Dependencies installed"

# Login to Cloudflare
echo ""
echo "🔐 Please login to your Cloudflare account..."
wrangler login
if [ $? -ne 0 ]; then
    echo " Failed to login to Cloudflare"
    exit 1
fi

echo " Logged in to Cloudflare"

# Set up secrets
echo ""
echo "🔑 Setting up secrets..."
echo "You'll need to provide your API keys now."

# LLM API Key
echo ""
echo "Please enter your z.ai API key:"
read -s LLM_API_KEY
if [ -z "$LLM_API_KEY" ]; then
    echo " LLM API key is required"
    exit 1
fi

echo "Setting LLM_API_KEY secret..."
wrangler secret put LLM_API_KEY << EOF
$LLM_API_KEY
EOF

if [ $? -ne 0 ]; then
    echo " Failed to set LLM_API_KEY secret"
    exit 1
fi

# GitHub Token
echo ""
echo "Please enter your GitHub Personal Access Token:"
echo "(Make sure it has 'repo' permissions)"
read -s GITHUB_TOKEN
if [ -z "$GITHUB_TOKEN" ]; then
    echo " GitHub token is required"
    exit 1
fi

echo "Setting GITHUB_TOKEN secret..."
wrangler secret put GITHUB_TOKEN << EOF
$GITHUB_TOKEN
EOF

if [ $? -ne 0 ]; then
    echo " Failed to set GITHUB_TOKEN secret"
    exit 1
fi

echo " Secrets configured"

# Optional: Configure custom settings
echo ""
echo "⚙️  Configuration (press Enter to use defaults):"

# GitHub Repository
echo "GitHub repository (owner/repo) [martinuke0/martinuke0.github.io]:"
read GITHUB_REPO
if [ -z "$GITHUB_REPO" ]; then
    GITHUB_REPO="martinuke0/martinuke0.github.io"
fi

# Posts Path
echo "Posts directory path [posts]:"
read POSTS_PATH
if [ -z "$POSTS_PATH" ]; then
    POSTS_PATH="posts"
fi

# Branch
echo "Target branch [main]:"
read BRANCH
if [ -z "$BRANCH" ]; then
    BRANCH="main"
fi

# Update wrangler.toml with custom settings
echo ""
echo "📝 Updating configuration..."
sed -i.bak "s|GITHUB_REPO = \".*\"|GITHUB_REPO = \"$GITHUB_REPO\"|" wrangler.toml
sed -i.bak "s|GITHUB_POSTS_PATH = \".*\"|GITHUB_POSTS_PATH = \"$POSTS_PATH\"|" wrangler.toml
sed -i.bak "s|GITHUB_BRANCH = \".*\"|GITHUB_BRANCH = \"$BRANCH\"|" wrangler.toml

echo " Configuration updated"

# Deploy the Worker
echo ""
echo "🚀 Deploying to Cloudflare Workers..."
wrangler deploy
if [ $? -ne 0 ]; then
    echo " Failed to deploy"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Your Nat Lang Push is now live!"
echo ""
echo "Next steps:"
echo "1. Open your browser and visit your Workers URL"
echo "2. Start generating blog posts!"
echo ""
echo "To view logs: wrangler tail"
echo "To redeploy: wrangler deploy"
echo ""
echo "Enjoy! 🚀"