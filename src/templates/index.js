export function getHtmlTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nat Lang Push</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        .message-content {
            line-height: 1.6;
        }
        .message-content h1 { font-size: 1.5rem; font-weight: bold; margin: 1rem 0; }
        .message-content h2 { font-size: 1.25rem; font-weight: bold; margin: 0.75rem 0; }
        .message-content h3 { font-size: 1.125rem; font-weight: bold; margin: 0.5rem 0; }
        .message-content p { margin: 0.5rem 0; }
        .message-content ul, .message-content ol { margin: 0.5rem 0; padding-left: 1.5rem; }
        .message-content li { margin: 0.25rem 0; }
        .message-content code { background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.875rem; }
        .message-content pre { background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 0.5rem 0; }
        .message-content blockquote { border-left: 4px solid #e5e7eb; padding-left: 1rem; margin: 0.5rem 0; font-style: italic; }
        
        .typing-indicator {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
        }
        .typing-indicator span {
            width: 0.5rem;
            height: 0.5rem;
            background: #6b7280;
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-0.5rem); }
        }
        
        .preview-mode {
            display: none;
        }
        .preview-mode.active {
            display: block;
        }
        .edit-mode.active {
            display: block;
        }
        .edit-mode {
            display: none;
        }
    </style>
</head>
<body class="bg-gray-50 h-screen flex flex-col">
    <header class="bg-white border-b border-gray-200 px-4 py-3">
        <div class="max-w-4xl mx-auto flex items-center justify-between">
            <div class="flex items-center gap-3">
                <i class="fas fa-robot text-blue-600 text-xl"></i>
                <h1 class="text-xl font-semibold text-gray-900">Nat Lang Push</h1>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-500">
                <i class="fas fa-circle text-green-500 text-xs"></i>
                <span>Connected</span>
            </div>
        </div>
    </header>

    <main class="flex-1 overflow-hidden">
        <div class="max-w-4xl mx-auto h-full flex flex-col">
            <div id="messagesContainer" class="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-pen-to-square text-4xl mb-3 text-gray-300"></i>
                    <p class="text-lg font-medium">Welcome to Nat Lang Push</p>
                    <p class="text-sm mt-1">Describe the blog post you want to create</p>
                </div>
            </div>

            <div class="border-t border-gray-200 bg-white px-4 py-4">
                <div class="flex gap-3">
                    <textarea 
                        id="messageInput" 
                        placeholder="Describe the blog post you want to create (e.g., 'Write a tutorial about React hooks for beginners')"
                        class="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows="3"
                    ></textarea>
                    <button 
                        id="sendButton"
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>Press Enter to send, Shift+Enter for new line</span>
                    <span id="charCount">0 / 1000</span>
                </div>
            </div>
        </div>
    </main>

    <div id="previewModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden">
        <div class="h-full flex items-center justify-center p-4">
            <div class="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
                <div class="flex items-center justify-between p-4 border-b">
                    <h2 class="text-lg font-semibold">Review & Publish Blog Post</h2>
                    <button id="closePreview" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <div class="flex-1 overflow-hidden">
                    <div class="flex h-full">
                        <div class="w-1/2 border-r flex flex-col">
                            <div class="flex items-center justify-between p-3 border-b bg-gray-50">
                                <span class="text-sm font-medium">Markdown Editor</span>
                                <div class="flex gap-2">
                                    <button id="editModeBtn" class="px-2 py-1 text-xs bg-blue-600 text-white rounded">Edit</button>
                                    <button id="previewModeBtn" class="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">Preview</button>
                                </div>
                            </div>
                            <textarea 
                                id="markdownEditor" 
                                class="flex-1 p-4 font-mono text-sm resize-none focus:outline-none edit-mode active"
                                placeholder="Blog post content will appear here..."
                            ></textarea>
                            <div id="markdownPreview" class="flex-1 p-4 overflow-y-auto preview-mode message-content"></div>
                        </div>
                        
                        <div class="w-1/2 flex flex-col">
                            <div class="p-3 border-b bg-gray-50">
                                <span class="text-sm font-medium">Rendered Preview</span>
                            </div>
                            <div id="renderedPreview" class="flex-1 p-4 overflow-y-auto message-content"></div>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center justify-between p-4 border-t">
                    <div class="flex gap-2">
                        <button id="regenerateBtn" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                            <i class="fas fa-arrow-rotate-left mr-2"></i>Regenerate
                        </button>
                    </div>
                    <div class="flex gap-2">
                        <button id="cancelPublish" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                            Cancel
                        </button>
                        <button id="publishBtn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            <i class="fas fa-cloud-upload-alt mr-2"></i>Publish to GitHub
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="loadingOverlay" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div class="text-center">
                <div class="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                    <i class="fas fa-spinner fa-spin text-blue-600 text-xl"></i>
                </div>
                <p class="text-lg font-medium text-gray-900" id="loadingText">Generating blog post...</p>
                <p class="text-sm text-gray-500 mt-1">This may take a moment</p>
            </div>
        </div>
    </div>

    <script src="/app.js"></script>
</body>
</html>`;
}