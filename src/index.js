import { generateBlogPost } from './handlers/generate.js';
import { publishToGitHub } from './handlers/publish.js';
import { diagnoseGitHubIssues } from './handlers/diagnose.js';
import { getHtmlTemplate } from './templates/index.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // Handle CORS
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            switch (path) {
                case '/':
                    return new Response(getHtmlTemplate(), {
                        headers: {
                            'Content-Type': 'text/html',
                            ...corsHeaders,
                        },
                    });

                case '/app.js':
                    return new Response(await getAppJs(), {
                        headers: {
                            'Content-Type': 'application/javascript',
                            ...corsHeaders,
                        },
                    });

                case '/api/generate':
                    if (request.method !== 'POST') {
                        return new Response('Method not allowed', { status: 405 });
                    }
                    return await generateBlogPost(request, env);

                case '/api/publish':
                    if (request.method !== 'POST') {
                        return new Response('Method not allowed', { status: 405 });
                    }
                    return await publishToGitHub(request, env);

                case '/api/status':
                    return new Response(JSON.stringify({
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        llm_configured: !!(env.LLM_API_KEY),
                        github_configured: !!(env.GITHUB_TOKEN),
                    }), {
                        headers: {
                            'Content-Type': 'application/json',
                            ...corsHeaders,
                        },
                    });

                case '/api/diagnose':
                    if (request.method !== 'GET') {
                        return new Response('Method not allowed', { status: 405 });
                    }
                    return await diagnoseGitHubIssues(request, env);

                case '/api/jobs':
                    if (request.method !== 'GET') {
                        return new Response('Method not allowed', { status: 405 });
                    }
                    return new Response(JSON.stringify([
                        {
                            id: 'create-branch',
                            name: 'Create cf-auto-blog branch',
                            description: 'Create new branch for Cloudflare auto blog fixes'
                        },
                        {
                            id: 'update-docs',
                            name: 'Update documentation',
                            description: 'Update README with new troubleshooting information'
                        },
                        {
                            id: 'push-to-main',
                            name: 'Push cf-auto-blog to main',
                            description: 'Merge cf-auto-blog branch into main branch'
                        },
                        {
                            id: 'deploy-production',
                            name: 'Deploy to production',
                            description: 'Deploy changes to Cloudflare Workers'
                        }
                    ]), {
                        headers: { 'Content-Type': 'application/json' }
                    });

                case '/api/run-job':
                    if (request.method !== 'POST') {
                        return new Response('Method not allowed', { status: 405 });
                    }
                    
                    const { jobId } = await request.json();
                    
                    // Import the git workflow
                    const { spawn } = require('child_process');
                    const { promisify } = require('util');
                    
                    try {
                        const { execAsync } = promisify(spawn);
                        
                        // Run the git-workflow.js script with the job ID
                        const result = await execAsync('node', ['git-workflow.js'], {
                            cwd: '.',
                            env: {
                                ...process.env,
                                RUN_SINGLE_JOB: jobId
                            }
                        });
                        
                        if (result.error) {
                            return new Response(JSON.stringify({
                                error: 'Failed to execute job',
                                details: result.error
                            }), {
                                status: 500,
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }
                        
                        // Parse the output to find the result
                        const output = result.stdout || '';
                        const successMatch = output.match(/🎉 All jobs completed!/);
                        
                        return new Response(JSON.stringify({
                            success: !!successMatch,
                            jobName: jobId,
                            output: output
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                        
                    } catch (error) {
                        return new Response(JSON.stringify({
                            error: 'Failed to execute job',
                            details: error.message
                        }), {
                            status: 500,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                case '/api/multi-jobs':
                    if (request.method === 'GET') {
                        return new Response(JSON.stringify({
                            availableJobs: [
                                { id: 'generate', name: 'Generate Blog Post', description: 'Generate a new blog post from prompt' },
                                { id: 'publish', name: 'Publish to GitHub', description: 'Publish generated content to GitHub' },
                                { id: 'commit', name: 'Commit Changes', description: 'Commit changes to local repository' },
                                { id: 'push', name: 'Push to Remote', description: 'Push changes to remote repository' }
                            ]
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    
                    if (request.method === 'POST') {
                        const { jobs } = await request.json();
                        
                        if (!Array.isArray(jobs)) {
                            return new Response(JSON.stringify({
                                error: 'Jobs must be an array'
                            }), {
                                status: 400,
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }

                        // Process jobs in parallel
                        const jobPromises = jobs.map(async (job) => {
                            try {
                                let result;
                                switch (job.type) {
                                    case 'generate':
                                        result = await generateBlogPost(new Request('https://example.com', {
                                            method: 'POST',
                                            body: JSON.stringify({ prompt: job.data?.prompt || 'Default prompt' })
                                        }), env);
                                        break;
                                    case 'publish':
                                        result = await publishToGitHub(new Request('https://example.com', {
                                            method: 'POST',
                                            body: JSON.stringify({ content: job.data?.content || '' })
                                        }), env);
                                        break;
                                    case 'commit':
                                        // Simulate commit operation
                                        result = { success: true, message: 'Changes committed', commitHash: 'abc123' };
                                        break;
                                    case 'push':
                                        // Simulate push operation
                                        result = { success: true, message: 'Changes pushed', url: 'https://github.com/example/repo' };
                                        break;
                                    default:
                                        throw new Error(`Unknown job type: ${job.type}`);
                                }
                                
                                return {
                                    jobId: job.id,
                                    success: true,
                                    result: await result.json()
                                };
                            } catch (error) {
                                return {
                                    jobId: job.id,
                                    success: false,
                                    error: error.message
                                };
                            }
                        });

                        const results = await Promise.allSettled(jobPromises);
                        const jobResults = results.map(result => result.value);
                        
                        return new Response(JSON.stringify({
                            success: true,
                            results: jobResults
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    
                    return new Response('Method not allowed', { status: 405 });

                case '/api/job-status':
                    if (request.method !== 'GET') {
                        return new Response('Method not allowed', { status: 405 });
                    }
                    
                    // Simulate job status tracking (in a real implementation, this would query a database)
                    return new Response(JSON.stringify({
                        activeJobs: [],
                        completedJobs: [],
                        queuedJobs: []
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });

                default:
                    return new Response('Not found', { status: 404 });
            }
        } catch (error) {
            console.error('Worker error:', error);
            return new Response(JSON.stringify({
                error: 'Internal server error',
                message: error.message,
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            });
        }
    },
};

async function getAppJs() {
    // This would normally be served from a file, but for simplicity in Workers,
    // we'll include it inline. In a real deployment, you might want to serve
    // this from a CDN or separate storage.
    return `
class BlogPostGenerator {
    constructor() {
        this.currentContent = '';
        this.originalPrompt = '';
        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.setupTextareaHandlers();
    }

    setupElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.charCount = document.getElementById('charCount');
        this.previewModal = document.getElementById('previewModal');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        this.markdownEditor = document.getElementById('markdownEditor');
        this.renderedPreview = document.getElementById('renderedPreview');
        this.markdownPreview = document.getElementById('markdownPreview');
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleSend());
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        document.getElementById('closePreview').addEventListener('click', () => this.closePreview());
        document.getElementById('cancelPublish').addEventListener('click', () => this.closePreview());
        document.getElementById('publishBtn').addEventListener('click', () => this.publishToGitHub());
        document.getElementById('regenerateBtn').addEventListener('click', () => this.regenerateContent());
        
        document.getElementById('editModeBtn').addEventListener('click', () => this.switchToEditMode());
        document.getElementById('previewModeBtn').addEventListener('click', () => this.switchToPreviewMode());
        
        this.markdownEditor.addEventListener('input', () => this.updatePreview());
    }

    setupTextareaHandlers() {
        this.messageInput.addEventListener('input', () => {
            const length = this.messageInput.value.length;
            this.charCount.textContent = \`\${length} / 1000\`;
            this.sendButton.disabled = length === 0 || length > 1000;
        });
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSend();
        }
    }

    async handleSend() {
        const prompt = this.messageInput.value.trim();
        if (!prompt || prompt.length > 1000) return;

        this.originalPrompt = prompt;
        this.messageInput.value = '';
        this.charCount.textContent = '0 / 1000';
        this.sendButton.disabled = true;

        this.addUserMessage(prompt);
        this.showLoading('Generating blog post...');

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }

            // Check if response is streaming (text/plain) or JSON
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('text/plain')) {
                // Handle streaming response
                await this.handleStreamingResponse(response);
            } else {
                // Handle JSON response
                const data = await response.json();
                this.hideLoading();
                
                if (data.error) {
                    this.addErrorMessage(data.error);
                } else {
                    this.currentContent = data.content;
                    this.addAssistantMessage(data.content);
                    this.openPreview(data.content);
                }
            }
        } catch (error) {
            this.hideLoading();
            this.addErrorMessage(\`Failed to generate blog post: \${error.message}\`);
        } finally {
            this.sendButton.disabled = false;
        }
    }

    async regenerateContent() {
        if (!this.originalPrompt) return;

        this.closePreview();
        this.showLoading('Regenerating blog post...');

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: this.originalPrompt }),
            });

            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }

            // Check if response is streaming (text/plain) or JSON
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('text/plain')) {
                // Handle streaming response
                await this.handleStreamingResponse(response);
            } else {
                // Handle JSON response
                const data = await response.json();
                this.hideLoading();
                
                if (data.error) {
                    this.addErrorMessage(data.error);
                } else {
                    this.currentContent = data.content;
                    this.addAssistantMessage(data.content);
                    this.openPreview(data.content);
                }
            }
        } catch (error) {
            this.hideLoading();
            this.addErrorMessage(\`Failed to regenerate blog post: \${error.message}\`);
        }
    }

    async publishToGitHub() {
        const content = this.markdownEditor.value;
        if (!content.trim()) {
            alert('Please add some content before publishing');
            return;
        }

        this.closePreview();
        this.showLoading('Publishing to GitHub...');

        try {
            const response = await fetch('/api/publish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content }),
            });

            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }

            const data = await response.json();
            this.hideLoading();
            
            if (data.error) {
                this.addErrorMessage(data.error);
            } else {
                this.addSuccessMessage(\`Blog post published successfully! \${data.message}\`);
            }
        } catch (error) {
            this.hideLoading();
            this.addErrorMessage(\`Failed to publish to GitHub: \${error.message}\`);
        }
    }

    addUserMessage(content) {
        const messageDiv = this.createMessageDiv('user', content);
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addAssistantMessage(content) {
        const messageDiv = this.createMessageDiv('assistant', content);
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addErrorMessage(content) {
        const messageDiv = this.createMessageDiv('error', content);
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addSuccessMessage(content) {
        const messageDiv = this.createMessageDiv('success', content);
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    createMessageDiv(type, content) {
        const div = document.createElement('div');
        div.className = \`flex gap-3 \${type === 'user' ? 'justify-end' : 'justify-start'}\`;

        let avatarHtml = '';
        let bubbleClass = '';
        let contentHtml = '';

        if (type === 'user') {
            avatarHtml = '<div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">You</div>';
            bubbleClass = 'bg-blue-600 text-white';
            contentHtml = \`<div class="whitespace-pre-wrap">\${this.escapeHtml(content)}</div>\`;
        } else if (type === 'assistant') {
            avatarHtml = '<div class="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white"><i class="fas fa-robot text-sm"></i></div>';
            bubbleClass = 'bg-white border border-gray-200';
            contentHtml = \`<div class="message-content">\${marked.parse(content)}</div>\`;
        } else if (type === 'error') {
            avatarHtml = '<div class="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white"><i class="fas fa-exclamation-triangle text-sm"></i></div>';
            bubbleClass = 'bg-red-50 border border-red-200 text-red-800';
            contentHtml = \`<div class="text-sm">\${this.escapeHtml(content)}</div>\`;
        } else if (type === 'success') {
            avatarHtml = '<div class="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white"><i class="fas fa-check text-sm"></i></div>';
            bubbleClass = 'bg-green-50 border border-green-200 text-green-800';
            contentHtml = \`<div class="text-sm">\${this.escapeHtml(content)}</div>\`;
        }

        div.innerHTML = \`
            \${type === 'user' ? \`
                <div class="max-w-lg">
                    <div class="\${bubbleClass} rounded-lg px-4 py-2 shadow-sm">
                        \${contentHtml}
                    </div>
                    <div class="text-xs text-gray-500 mt-1 text-right">\${new Date().toLocaleTimeString()}</div>
                </div>
                \${avatarHtml}
            \` : \`
                \${avatarHtml}
                <div class="max-w-lg">
                    <div class="\${bubbleClass} rounded-lg px-4 py-2 shadow-sm">
                        \${contentHtml}
                    </div>
                    <div class="text-xs text-gray-500 mt-1">\${new Date().toLocaleTimeString()}</div>
                </div>
            \`}
        \`;

        return div;
    }

    openPreview(content) {
        this.markdownEditor.value = content;
        this.updatePreview();
        this.previewModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closePreview() {
        this.previewModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    switchToEditMode() {
        document.getElementById('editModeBtn').className = 'px-2 py-1 text-xs bg-blue-600 text-white rounded';
        document.getElementById('previewModeBtn').className = 'px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded';
        document.querySelector('.edit-mode').classList.add('active');
        document.querySelector('.preview-mode').classList.remove('active');
    }

    switchToPreviewMode() {
        document.getElementById('editModeBtn').className = 'px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded';
        document.getElementById('previewModeBtn').className = 'px-2 py-1 text-xs bg-blue-600 text-white rounded';
        document.querySelector('.edit-mode').classList.remove('active');
        document.querySelector('.preview-mode').classList.add('active');
        this.updateMarkdownPreview();
    }

    updatePreview() {
        const content = this.markdownEditor.value;
        this.renderedPreview.innerHTML = marked.parse(content);
        this.updateMarkdownPreview();
    }

    updateMarkdownPreview() {
        const content = this.markdownEditor.value;
        this.markdownPreview.innerHTML = marked.parse(content);
    }

    showLoading(text = 'Loading...') {
        this.loadingText.textContent = text;
        this.loadingOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async handleStreamingResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';
        
        // Create a streaming message
        const streamingMessageId = this.addStreamingMessage();
        
        try {
            const textDecoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += textDecoder.decode(value, { stream: true });
                const lines = buffer.split('\\n');
                
                // Process each line
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.slice(6);
                        if (data === '[DONE]') {
                            break;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullContent += parsed.content;
                                this.updateStreamingMessage(streamingMessageId, fullContent);
                            }
                        } catch (e) {
                            // Skip malformed JSON - log but don't break
                            console.log('Malformed JSON chunk:', data);
                        }
                    }
                }
            }
        } catch (streamError) {
            console.error('Streaming error:', streamError);
            this.addErrorMessage('Streaming failed, please try again');
        }
        
        this.hideLoading();
        
        if (fullContent) {
            this.currentContent = fullContent;
            // Convert streaming message to regular assistant message
            this.finalizeStreamingMessage(streamingMessageId, fullContent);
            this.openPreview(fullContent);
        } else {
            this.addErrorMessage('No content received from streaming');
        }
    }

    addStreamingMessage() {
        const messageDiv = this.createMessageDiv('assistant', '');
        const messageContent = messageDiv.querySelector('.message-content');
        
        // Add typing indicator
        messageContent.innerHTML = \`
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
                <span style="margin-left: 8px; color: #6b7280;">Generating content...</span>
            </div>
        \`;
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageContent; // Return the content element for updates
    }

    updateStreamingMessage(messageElement, content) {
        // Update with markdown rendering of partial content
        messageElement.innerHTML = marked.parse(content);
        this.scrollToBottom();
    }

    finalizeStreamingMessage(messageElement, content) {
        // Remove typing indicator and set final content
        messageElement.innerHTML = marked.parse(content);
        this.scrollToBottom();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BlogPostGenerator();
});
    `;
}