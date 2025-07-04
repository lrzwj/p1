// 文档智能修改功能
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const documentTitle = document.getElementById('documentTitle');
    const originalContent = document.getElementById('originalContent');
    const originalContentLoading = document.getElementById('originalContentLoading');
    const aiAnalysis = document.getElementById('aiAnalysis');
    const chatMessages = document.getElementById('chatMessages');
    const autoImprovement = document.getElementById('autoImprovement');
    const autoImprovementLoading = document.getElementById('autoImprovementLoading');
    
    let currentDocumentData = null;
    
    // 初始化页面
    initializePage();
    
    async function initializePage() {
        // 从sessionStorage获取文档数据
        const editorData = sessionStorage.getItem('documentEditorData');
        if (!editorData) {
            alert('未找到文档数据，请返回诊断页面重新选择文档');
            window.close();
            return;
        }
        
        currentDocumentData = JSON.parse(editorData);
        
        // 设置页面标题
        documentTitle.textContent = `智能修改 - ${currentDocumentData.documentName}`;
        
        // 加载并分析原文内容
        await loadAndAnalyzeOriginalContent();
        
        // 自动生成改进版本
        await generateAutoImprovement();
    }
    
    async function loadAndAnalyzeOriginalContent() {
        try {
            // 显示加载状态
            originalContentLoading.style.display = 'block';
            originalContent.style.display = 'none';
            aiAnalysis.style.display = 'none';
            
            // 调用AI分析原文内容
            const response = await fetch('/api/analyze-document-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    documentName: currentDocumentData.documentName,
                    originalContent: currentDocumentData.originalContent,
                    analysisResult: currentDocumentData.analysisResult
                })
            });
            
            if (!response.ok) {
                throw new Error('AI分析失败');
            }
            
            const analysisData = await response.json();
            
            // 显示原文内容
            originalContent.textContent = currentDocumentData.originalContent;
            originalContent.style.display = 'block';
            
            // 显示AI分析结果
            displayAIAnalysis(analysisData);
            aiAnalysis.style.display = 'block';
            
        } catch (error) {
            console.error('原文分析失败:', error);
            originalContent.textContent = currentDocumentData.originalContent;
            originalContent.style.display = 'block';
        } finally {
            originalContentLoading.style.display = 'none';
        }
    }
    
    async function generateAutoImprovement() {
        try {
            // 显示加载状态
            autoImprovementLoading.style.display = 'block';
            autoImprovement.style.display = 'none';
            
            // 调用AI自动改进API
            const response = await fetch('/api/auto-improve-document', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    documentData: currentDocumentData
                })
            });
            
            if (!response.ok) {
                throw new Error('自动改进失败');
            }
            
            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';
            
            // 创建改进内容容器
            autoImprovement.innerHTML = `
                <h4><i class='bx bx-check-circle'></i> 基于诊断建议的自动改进版本</h4>
                <div class="improved-text" id="improvedText"></div>
            `;
            
            const improvedText = document.getElementById('improvedText');
            autoImprovement.style.display = 'block';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            break;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                accumulatedText += parsed.content;
                                improvedText.textContent = accumulatedText;
                                
                                // 滚动到底部
                                chatMessages.scrollTop = chatMessages.scrollHeight;
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('自动改进失败:', error);
            autoImprovement.innerHTML = `
                <h4><i class='bx bx-error'></i> 自动改进失败</h4>
                <p>抱歉，无法自动生成改进版本，请稍后重试。</p>
            `;
            autoImprovement.style.display = 'block';
        } finally {
            autoImprovementLoading.style.display = 'none';
        }
    }
    
    function displayAIAnalysis(analysisData) {
        let analysisHTML = '<h4><i class="bx bx-brain"></i> AI 内容分析</h4>';
        
        if (analysisData.structure) {
            analysisHTML += `
                <div class="analysis-section">
                    <h4>文档结构</h4>
                    <ul>
                        ${analysisData.structure.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (analysisData.keyPoints) {
            analysisHTML += `
                <div class="analysis-section">
                    <h4>关键要点</h4>
                    <ul>
                        ${analysisData.keyPoints.map(point => `<li>${point}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (analysisData.issues) {
            analysisHTML += `
                <div class="analysis-section">
                    <h4>发现的问题</h4>
                    <ul>
                        ${analysisData.issues.map(issue => `<li>${issue}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        aiAnalysis.innerHTML = analysisHTML;
    }
});