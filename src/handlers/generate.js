export async function generateBlogPost(request, env) {
    try {
        const { prompt } = await request.json();

        if (!prompt || typeof prompt !== 'string') {
            return new Response(JSON.stringify({
                error: 'Prompt is required and must be a string'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!env.LLM_API_KEY) {
            return new Response(JSON.stringify({
                error: 'LLM API key not configured'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const currentDate = new Date().toISOString().substring(0, 23); // Truncate to 2 decimal places
        const systemPrompt = `You are a professional blog post writer. Generate high-quality, well-structured blog posts based on the user's requirements.

CRITICAL REQUIREMENTS:
- NEVER truncate or cut off content mid-sentence
- ALWAYS complete the entire blog post
- Ensure the conclusion and final sections are fully written
- If approaching token limits, be more concise but COMPLETE the post

Follow these guidelines:
1. Always include proper frontmatter at the top with this EXACT format:
   ---
   title: "Your Title Here"
   date: "${currentDate}"
   draft: false
   tags: ["tag1", "tag2", "tag3", "tag4", "tag5"]
   ---
   
   IMPORTANT FRONTMATTER RULES:
   - Title MUST be wrapped in double quotes
   - Date MUST be wrapped in double quotes and use this exact value: ${currentDate}
   - Tags MUST be a JSON array with each tag in double quotes
   - Use 3-6 relevant tags
   - Do NOT use YAML list format (no dashes), use JSON array format

2. Include a table of contents if the post is longer than 1000 words

3. Structure the content with:
   - Clear introduction
   - Well-organized sections with proper headings
   - Code examples where appropriate
   - Conclusion or summary
   - Resources chapter (if requested)

4. Use proper markdown formatting:
   - Use ## for main sections, ### for subsections
   - Use code blocks with language specification
   - Use bullet points and numbered lists for clarity
   - Include blockquotes for important notes

5. Keep the tone professional but accessible
6. Aim for comprehensive coverage - better to be slightly shorter but COMPLETE than to be cut off
7. Ensure all technical information is accurate
8. ALWAYS include a proper conclusion and any requested final chapters

IMPORTANT: Complete the entire post. Do not stop mid-content. If you need to be more concise to fit, do so but FINISH the article.

Format your response as a complete markdown file ready to be published.`;

        const userPrompt = `Write a blog post about: ${prompt}

Please create a comprehensive, well-researched article that would be valuable to readers interested in this topic.`;

        // Try with primary model first, then fallback if needed
        let primaryResponse;
        let modelUsed = 'openrouter/auto';
        
        try {
            primaryResponse = await fetch(env.LLM_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.LLM_API_KEY}`,
                    'HTTP-Referer': 'https://natlangpush.workers.dev',
                    'X-Title': 'Blog Post Generator'
                },
                body: JSON.stringify({
                    model: modelUsed,
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userPrompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 8000,
                    stream: false  // Disable streaming to avoid JSON parsing issues
                })
            });
        } catch (error) {
            console.error('Network error with primary model:', error);
            return new Response(JSON.stringify({
                error: 'Network error when calling LLM API',
                details: error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Clone the response to allow multiple reads
        const clonedResponse = primaryResponse.clone();
        
        // Handle streaming response
        if (primaryResponse.body) {
            const reader = primaryResponse.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    
                    // Process complete lines
                    for (let i = 0; i < lines.length - 1; i++) {
                        const line = lines[i].trim();
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                break;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                    fullContent += parsed.choices[0].delta.content;
                                }
                            } catch (e) {
                                // Skip malformed JSON
                            }
                        }
                    }
                    
                    // Keep the incomplete line for next iteration
                    buffer = lines[lines.length - 1];
                }
            } catch (streamError) {
                console.error('Streaming error:', streamError);
                // Fallback to non-streaming if streaming fails
                return await handleNonStreamingResponse(env, modelUsed, systemPrompt, userPrompt);
            }

            // If we got streaming content, return it as streaming response
            if (fullContent) {
                // Return as Server-Sent Events for proper streaming
                const stream = new ReadableStream({
                    start(controller) {
                        // Send initial chunk
                        controller.enqueue(`data: ${JSON.stringify({
                            content: fullContent,
                            usage: null,
                            model_used: modelUsed,
                            streamed: true
                        })}\n\n`);
                        controller.close();
                    }
                });

                return new Response(stream, {
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                    }
                });
            }
        }

        // Fallback for non-streaming response - use clonedResponse for JSON response
        return await handleNonStreamingResponse(env, modelUsed, systemPrompt, userPrompt, clonedResponse);
    } catch (error) {
        console.error('Error in generateBlogPost:', error);
        
        return new Response(JSON.stringify({
            error: 'Internal server error during content generation',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleNonStreamingResponse(env, modelUsed, systemPrompt, userPrompt, responseToUse = null) {
    try {
        const response = responseToUse || await fetch(env.LLM_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.LLM_API_KEY}`,
                'HTTP-Referer': 'https://natlangpush.workers.dev',
                'X-Title': 'Blog Post Generator'
            },
            body: JSON.stringify({
                model: modelUsed,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 8000,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LLM API error with model', modelUsed, ':', errorText);
            
            // Try fallback models if primary fails
            if (response.status === 400 && (errorText.includes('model') || errorText.includes('not found'))) {
                const fallbackModels = [
                    'openai/gpt-4',
                    'openai/gpt-3.5-turbo',
                    'anthropic/claude-3-haiku',
                    'google/gemini-pro'
                ];
                
                for (const fallbackModel of fallbackModels) {
                    console.log('Trying fallback model:', fallbackModel);
                    
                    try {
                        const fallbackResponse = await fetch(env.LLM_API_URL, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${env.LLM_API_KEY}`,
                                'HTTP-Referer': 'https://natlangpush.workers.dev',
                                'X-Title': 'Blog Post Generator'
                            },
                            body: JSON.stringify({
                                model: fallbackModel,
                                messages: [
                                    {
                                        role: 'system',
                                        content: systemPrompt
                                    },
                                    {
                                        role: 'user',
                                        content: userPrompt
                                    }
                                ],
                                temperature: 0.7,
                                max_tokens: 8000,
                                stream: false
                            })
                        });
                        
                        if (fallbackResponse.ok) {
                            const fallbackData = await fallbackResponse.json();
                            return new Response(JSON.stringify({
                                content: fallbackData.choices[0].message.content,
                                usage: fallbackData.usage || null,
                                model_used: fallbackModel,
                                streamed: false
                            }), {
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }
                    } catch (fallbackError) {
                        console.log('Fallback model', fallbackModel, 'also failed:', fallbackError.message);
                    }
                }
            }
            
            return new Response(JSON.stringify({
                error: 'Failed to generate content from LLM - all models failed',
                details: `HTTP ${response.status}: ${errorText}`,
                suggestion: 'Please check your OpenRouter API key and ensure you have access to models'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            return new Response(JSON.stringify({
                error: 'Invalid response from LLM API',
                details: JSON.stringify(data)
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const content = data.choices[0].message.content;

        if (!content.includes('---') || !content.includes('title:')) {
            return new Response(JSON.stringify({
                error: 'Generated content is missing required frontmatter',
                content: content
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            content: content,
            usage: data.usage || null,
            model_used: modelUsed,
            streamed: false
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in handleNonStreamingResponse:', error);
        return new Response(JSON.stringify({
            error: 'Failed to generate content from LLM - all models failed',
            details: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export function extractTitleFromContent(content) {
    const frontmatterMatch = content.match(/^---\s*\ntitle:\s*["']([^"']+)["']/m);
    if (frontmatterMatch) {
        return frontmatterMatch[1];
    }
    
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
        return h1Match[1];
    }
    
    return 'Untitled Post';
}

export function generateFilename(title) {
    const slug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    
    const date = new Date().toISOString().split('T')[0];
    return `${date}-${slug}.md`;
}