/***
 *
 * Copyright (c) 2019-2024 Tony Confrey, DataFoundries LLC
 *
 * This file is part of the BrainTool browser manager extension, open source licensed under the GNU AGPL license.
 * See the LICENSE file contained with this project.
 *
 ***/



/*** 
 * 
 * Summarizer module for BrainTool
 * Handles AI-powered text summarization using Chrome's built-in Summarizer API
 * and content extraction using Readability.js
 * 
 ***/
'use strict';

// Create Summarizer module
const Summarizer = (() => {
    // Store reference to Chrome's native Summarizer API before we override it
    // Note: self.ai is deprecated, the API is now directly at self.Summarizer
    let ChromeSummarizer = null;
    
    // Debug: Log what's available
    console.log('Checking for Chrome Summarizer API...');
    console.log('  self.Summarizer:', typeof self.Summarizer);
    if (typeof window !== 'undefined') {
        console.log('  window.Summarizer:', typeof window.Summarizer);
    }
    
    // Get reference to Chrome's Summarizer API
    if (typeof self !== 'undefined') {
        ChromeSummarizer = self.Summarizer || (typeof window !== 'undefined' ? window.Summarizer : null);
    }
    
    console.log('  ChromeSummarizer found:', !!ChromeSummarizer);
    
    let summarizerInstance = null;
    let initialized = false;
    let available = false;

    async function isAvailable() {
        // Check if Chrome Summarizer API exists and return availability status
        if (!ChromeSummarizer) {
            console.log('Summarizer API not found in this browser');
            return false;
        }
        
        try {
            const availability = await ChromeSummarizer.availability();
            console.log('Summarizer availability:', availability);
            // Returns: 'available', 'downloadable', 'downloading', or 'unavailable'
            return availability !== 'unavailable';
        } catch (e) {
            console.error('Error checking Summarizer availability:', e);
            return false;
        }
    }

    async function create() {
        // Create summarizer instance directly - must be called synchronously from user gesture
        if (summarizerInstance) {
            console.log('Summarizer already created');
            return summarizerInstance;
        }
        
        if (!ChromeSummarizer) {
            const errorMsg = 'AI Summarizer not available in this browser. ' +
                           'Make sure you have Chrome 128+ with the Summarization API enabled. ' +
                           'Visit chrome://flags/#summarization-api-for-gemini-nano and enable it.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        // Create summarizer with default options
        console.log('Creating Summarizer instance...');
        summarizerInstance = await ChromeSummarizer.create({
            type: 'tldr',
            length: 'medium',
            format: 'plain-text',
            monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                    const percent = Math.round(e.loaded * 100);
                    console.log(`Summarizer model download: ${percent}%`);
                });
            }
        });
        
        initialized = true;
        console.log('Summarizer created successfully');
        return summarizerInstance;
    }

    async function extractContent(tabId) {
        // Inject Readability library and extract article content from tab
        try {
            // Get tab info to validate URL
            const tab = await chrome.tabs.get(tabId);
            const url = tab.url;
            
            // Check if URL is accessible (not chrome://, about:, etc.)
            if (!url || url.startsWith('chrome://') || url.startsWith('about:') || 
                url.startsWith('chrome-extension://') || url.startsWith('edge://') || 
                url.startsWith('brave://')) {
                throw new Error('Cannot access protected browser pages (chrome://, about:, etc.)');
            }
            
            // First inject Readability.js
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['Readability.js']
            });

            // Then extract content - prioritize selected text, fallback to article
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                    // First check if user has selected any text
                    const selection = window.getSelection();
                    const selectedText = selection ? selection.toString().trim() : '';
                    
                    if (selectedText && selectedText.length > 0) {
                        console.log('Using selected text for summary');
                        return selectedText;
                    }
                    
                    // No selection, extract full article content
                    console.log('No text selected, extracting full article');
                    try {
                        const documentClone = document.cloneNode(true);
                        const reader = new Readability(documentClone);
                        const article = reader.parse();
                        return article ? article.textContent : document.body.innerText;
                    } catch (e) {
                        console.error('Readability parsing error:', e);
                        // Fallback to body text if Readability fails
                        return document.body.innerText;
                    }
                }
            });

            return results[0].result;
        } catch (e) {
            console.error('Error extracting content:', e);
            throw new Error('Failed to extract page content: ' + e.message);
        }
    }

    async function summarize(options) {
        // Generate summary from text or tab content
        // options: { tabId, text }
        const { tabId, text } = options || {};

        if (!summarizerInstance) {
            throw new Error('Summarizer not created - call create() first from user gesture');
        }

        // Get content to summarize
        let content = text;
        if (!content && tabId) {
            content = await extractContent(tabId);
        }

        if (!content || content.trim().length === 0) {
            throw new Error('No content to summarize');
        }

        // Generate summary using the initialized summarizer
        console.log('Generating summary...');
        const summary = await summarizerInstance.summarize(content);
        return summary;
    }

    function destroy() {
        // Clean up resources
        if (summarizerInstance) {
            summarizerInstance.destroy();
            summarizerInstance = null;
        }
        initialized = false;
    }

    return {
        isAvailable: isAvailable,
        create: create,
        extractContent: extractContent,
        summarize: summarize,
        destroy: destroy
    };
})();

// Make Summarizer available globally for service worker context
globalThis.Summarizer = Summarizer;
