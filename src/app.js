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
        this.jobModal = document.getElementById('jobModal');
        this.jobManagerBtn = document.getElementById('jobManagerBtn');
        this.closeJobModal = document.getElementById('closeJobModal');
        this.jobList = document.getElementById('jobList');
        this.jobStatus = document.getElementById('jobStatus');
        
        // Multi-job elements
        this.multiJobBtn = document.getElementById('multiJobBtn');
        this.multiJobModal = document.getElementById('multiJobModal');
        this.closeMultiJobModal = document.getElementById('closeMultiJobModal');
        this.jobQueue = document.getElementById('jobQueue');
        this.activeJobs = document.getElementById('activeJobs');
        this.completedJobs = document.getElementById('completedJobs');
        this.addJobBtn = document.getElementById('addJobBtn');
        this.runAllJobsBtn = document.getElementById('runAllJobsBtn');
        
        // Commit/Push modal elements
        this.commitPushModal = document.getElementById('commitPushModal');
        this.closeCommitPushModal = document.getElementById('closeCommitPushModal');
        this.jobResultInfo = document.getElementById('jobResultInfo');
        this.commitOnlyBtn = document.getElementById('commitOnlyBtn');
        this.pushBtn = document.getElementById('pushBtn');
        this.skipBtn = document.getElementById('skipBtn');
        this.fabMultiJobBtn = document.getElementById('fabMultiJobBtn');
        
        // Job creation modal elements
        this.jobCreationModal = document.getElementById('jobCreationModal');
        this.closeJobCreationModal = document.getElementById('closeJobCreationModal');
        this.jobDescription = document.getElementById('jobDescription');
        this.cancelJobCreation = document.getElementById('cancelJobCreation');
        this.confirmJobCreation = document.getElementById('confirmJobCreation');
        this.selectedJobType = null;
        
        // Job management
        this.jobQueueData = [];
        this.activeJobsData = [];
        this.completedJobsData = [];
        this.jobIdCounter = 1;
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
        
        // Job manager event listeners
        this.jobManagerBtn.addEventListener('click', () => this.openJobManager());
        this.closeJobModal.addEventListener('click', () => this.closeJobManager());
        
        // Multi-job event listeners
        this.multiJobBtn.addEventListener('click', () => this.openMultiJobManager());
        this.closeMultiJobModal.addEventListener('click', () => this.closeMultiJobManager());
        this.addJobBtn.addEventListener('click', () => this.addJobToQueue());
        this.runAllJobsBtn.addEventListener('click', () => this.runAllJobs());
        
        // Commit/Push modal event listeners
        this.closeCommitPushModal.addEventListener('click', () => this.closeCommitPushModal());
        this.commitOnlyBtn.addEventListener('click', () => this.handleCommitOnly());
        this.pushBtn.addEventListener('click', () => this.handlePush());
        this.skipBtn.addEventListener('click', () => this.handleSkip());
        
        // FAB button event listener
        this.fabMultiJobBtn.addEventListener('click', () => this.openMultiJobManager());
        
        // Job creation modal event listeners
        this.closeJobCreationModal.addEventListener('click', () => this.closeJobCreationModal());
        this.cancelJobCreation.addEventListener('click', () => this.closeJobCreationModal());
        this.confirmJobCreation.addEventListener('click', () => this.confirmAddJob());
        
        // Job option selection
        document.querySelectorAll('.job-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectJobType(e.currentTarget.dataset.jobType));
        });
    }

    setupTextareaHandlers() {
        this.messageInput.addEventListener('input', () => {
            const length = this.messageInput.value.length;
            this.charCount.textContent = `${length} / 1000`;
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
                throw new Error(`HTTP error! status: ${response.status}`);
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
            this.addErrorMessage(`Failed to generate blog post: ${error.message}`);
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
                throw new Error(`HTTP error! status: ${response.status}`);
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
            this.addErrorMessage(`Failed to regenerate blog post: ${error.message}`);
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.hideLoading();
            
            if (data.error) {
                this.addErrorMessage(data.error);
            } else {
                this.addSuccessMessage(`Blog post published successfully! ${data.message}`);
            }
        } catch (error) {
            this.hideLoading();
            this.addErrorMessage(`Failed to publish to GitHub: ${error.message}`);
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
        div.className = `flex gap-3 ${type === 'user' ? 'justify-end' : 'justify-start'}`;

        let avatarHtml = '';
        let bubbleClass = '';
        let contentHtml = '';

        if (type === 'user') {
            avatarHtml = '<div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">You</div>';
            bubbleClass = 'bg-blue-600 text-white';
            contentHtml = `<div class="whitespace-pre-wrap">${this.escapeHtml(content)}</div>`;
        } else if (type === 'assistant') {
            avatarHtml = '<div class="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white"><i class="fas fa-robot text-sm"></i></div>';
            bubbleClass = 'bg-white border border-gray-200';
            contentHtml = `<div class="message-content">${marked.parse(content)}</div>`;
        } else if (type === 'error') {
            avatarHtml = '<div class="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white"><i class="fas fa-exclamation-triangle text-sm"></i></div>';
            bubbleClass = 'bg-red-50 border border-red-200 text-red-800';
            contentHtml = `<div class="text-sm">${this.escapeHtml(content)}</div>`;
        } else if (type === 'success') {
            avatarHtml = '<div class="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white"><i class="fas fa-check text-sm"></i></div>';
            bubbleClass = 'bg-green-50 border border-green-200 text-green-800';
            contentHtml = `<div class="text-sm">${this.escapeHtml(content)}</div>`;
        }

        div.innerHTML = `
            ${type === 'user' ? `
                <div class="max-w-lg">
                    <div class="${bubbleClass} rounded-lg px-4 py-2 shadow-sm">
                        ${contentHtml}
                    </div>
                    <div class="text-xs text-gray-500 mt-1 text-right">${new Date().toLocaleTimeString()}</div>
                </div>
                ${avatarHtml}
            ` : `
                ${avatarHtml}
                <div class="max-w-lg">
                    <div class="${bubbleClass} rounded-lg px-4 py-2 shadow-sm">
                        ${contentHtml}
                    </div>
                    <div class="text-xs text-gray-500 mt-1">${new Date().toLocaleTimeString()}</div>
                </div>
            `}
        `;

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
                const lines = buffer.split('\n');
                
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
                            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                fullContent += parsed.choices[0].delta.content;
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
        messageContent.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
                <span style="margin-left: 8px; color: #6b7280;">Generating content...</span>
            </div>
        `;
        
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

    openJobManager() {
        this.jobModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        this.loadAndDisplayJobs();
    }

    closeJobManager() {
        this.jobModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    async loadAndDisplayJobs() {
        try {
            const response = await fetch('/api/jobs');
            if (!response.ok) {
                throw new Error(`Failed to load jobs: ${response.status}`);
            }
            
            const jobs = await response.json();
            this.displayJobs(jobs);
        } catch (error) {
            console.error('Error loading jobs:', error);
            this.displayJobs([]);
        }
    }

    displayJobs(jobs) {
        this.jobList.innerHTML = '';
        
        if (jobs.length === 0) {
            this.jobList.innerHTML = '<div class="text-gray-500 text-sm p-4">No jobs available</div>';
            return;
        }

        jobs.forEach((job, index) => {
            const jobElement = document.createElement('div');
            jobElement.className = 'flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer';
            jobElement.innerHTML = `
                <div class="flex-1">
                    <div class="text-sm font-medium">${job.name}</div>
                    <div class="text-xs text-gray-500">${job.description}</div>
                </div>
                <div class="flex items-center gap-2">
                    <button class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" onclick="app.runJob('${job.id}')">
                        Run Job
                    </button>
                </div>
            `;
            
            this.jobList.appendChild(jobElement);
        });
    }

    async runJob(jobId) {
        try {
            const response = await fetch('/api/run-job', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ jobId })
            });

            if (!response.ok) {
                throw new Error(`Failed to run job: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.addSuccessMessage(`Job "${result.jobName}" completed successfully`);
                this.closeJobManager();
                this.loadAndDisplayJobs(); // Refresh job list
            } else {
                this.addErrorMessage(`Job failed: ${result.error}`);
            }
        } catch (error) {
            this.addErrorMessage(`Error running job: ${error.message}`);
        }
    }

    // Multi-job management methods
    openMultiJobManager() {
        this.multiJobModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        this.refreshJobDisplays();
    }

    closeMultiJobManager() {
        this.multiJobModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    addJobToQueue() {
        this.selectedJobType = null;
        this.jobDescription.value = '';
        this.jobCreationModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeJobCreationModal() {
        this.jobCreationModal.classList.add('hidden');
        document.body.style.overflow = '';
        this.selectedJobType = null;
        
        // Reset selection
        document.querySelectorAll('.job-option').forEach(option => {
            option.classList.remove('border-blue-500', 'bg-blue-50');
            option.classList.add('border-gray-200');
        });
    }

    selectJobType(jobType) {
        this.selectedJobType = jobType;
        
        // Update UI to show selection
        document.querySelectorAll('.job-option').forEach(option => {
            if (option.dataset.jobType === jobType) {
                option.classList.remove('border-gray-200');
                option.classList.add('border-blue-500', 'bg-blue-50');
            } else {
                option.classList.remove('border-blue-500', 'bg-blue-50');
                option.classList.add('border-gray-200');
            }
        });
    }

    confirmAddJob() {
        if (!this.selectedJobType) {
            this.addErrorMessage('Please select a job type');
            return;
        }

        const jobTypes = {
            generate: { name: 'Generate Blog Post', description: 'Generate a new blog post from prompt' },
            publish: { name: 'Publish to GitHub', description: 'Publish generated content to GitHub' },
            commit: { name: 'Commit Changes', description: 'Commit changes to local repository' },
            push: { name: 'Push to Remote', description: 'Push changes to remote repository' }
        };

        const selectedJobType = jobTypes[this.selectedJobType];
        const customDescription = this.jobDescription.value.trim();
        
        const job = {
            id: this.jobIdCounter++,
            type: this.selectedJobType,
            name: selectedJobType.name,
            description: customDescription || selectedJobType.description,
            status: 'queued',
            createdAt: new Date(),
            data: {}
        };

        this.jobQueueData.push(job);
        this.refreshJobDisplays();
        this.closeJobCreationModal();
        this.addSuccessMessage(`Job "${job.name}" added to queue`);
    }

    async runAllJobs() {
        if (this.jobQueueData.length === 0) {
            this.addErrorMessage('No jobs in queue to run');
            return;
        }

        // Move all queued jobs to active
        this.activeJobsData = [...this.activeJobsData, ...this.jobQueueData];
        this.jobQueueData = [];
        this.refreshJobDisplays();

        // Run jobs concurrently
        const jobPromises = this.activeJobsData.map(job => this.runSingleJob(job, true));
        await Promise.allSettled(jobPromises);
        
        // After all jobs complete, show commit/push dialog once
        const completedGenerateOrPublishJobs = this.completedJobsData.filter(
            job => (job.type === 'generate' || job.type === 'publish') && job.status === 'completed'
        );
        
        if (completedGenerateOrPublishJobs.length > 0) {
            this.showBatchCommitPushDialog(completedGenerateOrPublishJobs);
        }
    }

    async runSingleJob(job, skipDialog = false) {
        job.status = 'running';
        job.startedAt = new Date();
        this.refreshJobDisplays();

        try {
            let result;
            switch (job.type) {
                case 'generate':
                    result = await this.runGenerateJob(job);
                    break;
                case 'publish':
                    result = await this.runPublishJob(job);
                    break;
                case 'commit':
                    result = await this.runCommitJob(job);
                    break;
                case 'push':
                    result = await this.runPushJob(job);
                    break;
                default:
                    throw new Error(`Unknown job type: ${job.type}`);
            }

            job.status = 'completed';
            job.completedAt = new Date();
            job.result = result;
            
            // Move to completed jobs
            this.activeJobsData = this.activeJobsData.filter(j => j.id !== job.id);
            this.completedJobsData.push(job);
            
            this.refreshJobDisplays();
            
            // Only show commit/push dialog if not running in batch mode
            if (!skipDialog && (job.type === 'generate' || job.type === 'publish')) {
                this.showCommitPushDialog(job);
            }
            
        } catch (error) {
            job.status = 'failed';
            job.error = error.message;
            job.completedAt = new Date();
            
            // Move to completed jobs
            this.activeJobsData = this.activeJobsData.filter(j => j.id !== job.id);
            this.completedJobsData.push(job);
            
            this.refreshJobDisplays();
            this.addErrorMessage(`Job "${job.name}" failed: ${error.message}`);
        }
    }

    async runGenerateJob(job) {
        const prompt = job.data.prompt || 'Generate a blog post about technology trends';
        
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            throw new Error(`Generate job failed: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        return { content: data.content, title: this.extractTitleFromContent(data.content) };
    }

    async runPublishJob(job) {
        const content = job.data.content || this.currentContent;
        
        if (!content) {
            throw new Error('No content to publish');
        }

        const response = await fetch('/api/publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content })
        });

        if (!response.ok) {
            throw new Error(`Publish job failed: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        return data;
    }

    async runCommitJob(job) {
        // Simulate commit job
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { message: 'Changes committed successfully', commitHash: 'abc123' };
    }

    async runPushJob(job) {
        // Simulate push job
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { message: 'Changes pushed to remote', url: 'https://github.com/example/repo' };
    }

    refreshJobDisplays() {
        this.displayJobQueue();
        this.displayActiveJobs();
        this.displayCompletedJobs();
        this.updateJobCounts();
    }

    updateJobCounts() {
        document.getElementById('queueCount').textContent = this.jobQueueData.length;
        document.getElementById('activeCount').textContent = this.activeJobsData.length;
        document.getElementById('completedCount').textContent = this.completedJobsData.length;
    }

    displayJobQueue() {
        this.jobQueue.innerHTML = '';
        
        if (this.jobQueueData.length === 0) {
            this.jobQueue.innerHTML = '<div class="text-gray-500 text-sm p-4 text-center">No jobs in queue. Click "Add Job" to get started!</div>';
            return;
        }

        this.jobQueueData.forEach(job => {
            const jobElement = this.createJobElement(job, 'queue');
            this.jobQueue.appendChild(jobElement);
        });
    }

    displayActiveJobs() {
        this.activeJobs.innerHTML = '';
        
        if (this.activeJobsData.length === 0) {
            this.activeJobs.innerHTML = '<div class="text-gray-500 text-sm p-4 text-center">No active jobs</div>';
            return;
        }

        this.activeJobsData.forEach(job => {
            const jobElement = this.createJobElement(job, 'active');
            this.activeJobs.appendChild(jobElement);
        });
    }

    displayCompletedJobs() {
        this.completedJobs.innerHTML = '';
        
        if (this.completedJobsData.length === 0) {
            this.completedJobs.innerHTML = '<div class="text-gray-500 text-sm p-4 text-center">No completed jobs</div>';
            return;
        }

        this.completedJobsData.forEach(job => {
            const jobElement = this.createJobElement(job, 'completed');
            this.completedJobs.appendChild(jobElement);
        });
    }

    createJobElement(job, context) {
        const jobElement = document.createElement('div');
        jobElement.className = 'p-3 border border-gray-200 rounded-lg hover:bg-gray-50';
        
        let statusIcon = '';
        let statusColor = '';
        
        if (job.status === 'queued') {
            statusIcon = '<i class="fas fa-clock text-gray-500"></i>';
            statusColor = 'text-gray-600';
        } else if (job.status === 'running') {
            statusIcon = '<i class="fas fa-spinner fa-spin text-blue-500"></i>';
            statusColor = 'text-blue-600';
        } else if (job.status === 'completed') {
            statusIcon = '<i class="fas fa-check-circle text-green-500"></i>';
            statusColor = 'text-green-600';
        } else if (job.status === 'failed') {
            statusIcon = '<i class="fas fa-exclamation-circle text-red-500"></i>';
            statusColor = 'text-red-600';
        }

        jobElement.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        ${statusIcon}
                        <span class="font-medium text-sm ${statusColor}">${job.name}</span>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">${job.description}</div>
                    <div class="text-xs text-gray-400 mt-1">ID: ${job.id}</div>
                </div>
                ${context === 'queue' ? `
                    <button class="text-red-500 hover:text-red-700 text-sm" onclick="app.removeJobFromQueue(${job.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        `;
        
        return jobElement;
    }

    removeJobFromQueue(jobId) {
        this.jobQueueData = this.jobQueueData.filter(job => job.id !== jobId);
        this.refreshJobDisplays();
    }

    showCommitPushDialog(job) {
        this.currentJobForAction = job;
        this.currentJobsForAction = [job];
        this.jobResultInfo.innerHTML = `
            <div class="text-sm">
                <div class="font-medium">${job.name}</div>
                <div class="text-gray-600 mt-1">Status: ${job.status}</div>
                ${job.result ? `<div class="text-gray-600 mt-1">Result: ${JSON.stringify(job.result).substring(0, 100)}...</div>` : ''}
            </div>
        `;
        this.commitPushModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    showBatchCommitPushDialog(jobs) {
        this.currentJobsForAction = jobs;
        this.currentJobForAction = jobs[0]; // Keep for backward compatibility
        
        const jobSummary = jobs.map(job => `
            <div class="p-2 bg-white rounded border border-gray-200 mb-2">
                <div class="font-medium text-sm">${job.name}</div>
                <div class="text-xs text-gray-600">Status: ${job.status}</div>
                ${job.result && job.result.title ? `<div class="text-xs text-gray-500">Title: ${job.result.title}</div>` : ''}
            </div>
        `).join('');
        
        this.jobResultInfo.innerHTML = `
            <div class="text-sm">
                <div class="font-semibold mb-2">${jobs.length} job(s) completed successfully:</div>
                ${jobSummary}
            </div>
        `;
        this.commitPushModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeCommitPushModal() {
        this.commitPushModal.classList.add('hidden');
        document.body.style.overflow = '';
        this.currentJobForAction = null;
        this.currentJobsForAction = null;
    }

    async handleCommitOnly() {
        if (!this.currentJobsForAction || this.currentJobsForAction.length === 0) return;
        
        const jobNames = this.currentJobsForAction.map(j => j.name).join(', ');
        const commitJob = {
            id: this.jobIdCounter++,
            type: 'commit',
            name: 'Commit to Main',
            description: `Commit changes from: ${jobNames}`,
            status: 'queued',
            createdAt: new Date(),
            data: {
                sourceJobIds: this.currentJobsForAction.map(j => j.id),
                action: 'commit'
            }
        };
        
        this.jobQueueData.push(commitJob);
        this.refreshJobDisplays();
        this.closeCommitPushModal();
        this.addSuccessMessage(`Commit job added to queue for ${this.currentJobsForAction.length} completed job(s)`);
    }

    async handlePush() {
        if (!this.currentJobsForAction || this.currentJobsForAction.length === 0) return;
        
        const jobNames = this.currentJobsForAction.map(j => j.name).join(', ');
        
        // Add both commit and push jobs
        const commitJob = {
            id: this.jobIdCounter++,
            type: 'commit',
            name: 'Commit to Main',
            description: `Commit changes from: ${jobNames}`,
            status: 'queued',
            createdAt: new Date(),
            data: {
                sourceJobIds: this.currentJobsForAction.map(j => j.id),
                action: 'commit'
            }
        };
        
        const pushJob = {
            id: this.jobIdCounter++,
            type: 'push',
            name: 'Push to Remote',
            description: `Push changes from: ${jobNames}`,
            status: 'queued',
            createdAt: new Date(),
            data: {
                sourceJobIds: this.currentJobsForAction.map(j => j.id),
                action: 'push'
            }
        };
        
        this.jobQueueData.push(commitJob, pushJob);
        this.refreshJobDisplays();
        this.closeCommitPushModal();
        this.addSuccessMessage(`Commit and push jobs added to queue for ${this.currentJobsForAction.length} completed job(s)`);
    }

    async handleSkip() {
        this.closeCommitPushModal();
        this.addSuccessMessage('Skipped commit/push actions');
    }

    extractTitleFromContent(content) {
        if (!content || typeof content !== 'string') {
            return 'Untitled Post';
        }
        
        // Try to extract title from frontmatter
        const frontmatterMatch = content.match(/^---\s*\ntitle:\s*["']([^"']+)["']/m);
        if (frontmatterMatch) {
            return frontmatterMatch[1];
        }
        
        // Try alternative frontmatter format
        const altFrontmatterMatch = content.match(/^title:\s*(.+)$/m);
        if (altFrontmatterMatch) {
            return altFrontmatterMatch[1].replace(/["']/g, '').trim();
        }
        
        // Try to extract from H1 heading
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match) {
            return h1Match[1].trim();
        }
        
        // Try to extract from first line if it looks like a title
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > 0 && lines[0].length < 100 && !lines[0].startsWith('#') && !lines[0].startsWith('---')) {
            return lines[0].trim();
        }
        
        return 'Untitled Post';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new BlogPostGenerator();
});