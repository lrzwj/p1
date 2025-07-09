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
    const saveButtons = document.getElementById('saveButtons');
    const saveDocxBtn = document.getElementById('saveDocx');
    const savePdfBtn = document.getElementById('savePdf');
    
    let currentDocumentData = null;
    let improvedContent = '';
    
    // 绑定保存按钮事件
    if (saveDocxBtn) {
        saveDocxBtn.addEventListener('click', () => saveAsDocx());
    }
    if (savePdfBtn) {
        savePdfBtn.addEventListener('click', () => saveAsPdf());
    }
    
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
            
            // 显示原文内容（应用统一格式）
            originalContent.innerHTML = formatContent(currentDocumentData.originalContent);
            originalContent.style.display = 'block';
            
            // 显示AI分析结果
            displayAIAnalysis(analysisData);
            aiAnalysis.style.display = 'block';
            
        } catch (error) {
            console.error('原文分析失败:', error);
            originalContent.innerHTML = formatContent(currentDocumentData.originalContent);
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
                <div class="improved-text generated-content" id="improvedText"></div>
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
                                improvedContent = accumulatedText;
                                improvedText.innerHTML = formatContent(accumulatedText) + '<span class="cursor-blink">|</span>';
                                
                                // 滚动到底部
                                chatMessages.scrollTop = chatMessages.scrollHeight;
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
            
            // 移除光标效果
            const cursor = improvedText.querySelector('.cursor-blink');
            if (cursor) {
                cursor.remove();
            }
            
            // 显示保存按钮
            if (improvedContent && saveButtons) {
                saveButtons.style.display = 'flex';
            }
            
            showNotification('文档改进完成！', 'success');
            
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
    
    // 格式化内容 - 完全去除markdown符号，转换为纯净HTML
    // 在文件顶部添加marked库的引用
    // 需要在HTML中添加：<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    
    // 替换formatContent函数
    function formatContent(content) {
        if (!content) return '';
        
        try {
            // 配置marked选项
            marked.setOptions({
                breaks: true,
                gfm: true,
                sanitize: false,
                smartLists: true,
                smartypants: true
            });
            
            // 使用marked转换markdown为HTML
            let html = marked.parse(content);
            
            // 应用自定义样式类
            html = html
                .replace(/<h1>/g, '<h1 class="doc-h1">')
                .replace(/<h2>/g, '<h2 class="doc-h2">')
                .replace(/<h3>/g, '<h3 class="doc-h3">')
                .replace(/<h4>/g, '<h4 class="doc-h4">')
                .replace(/<p>/g, '<p class="doc-paragraph">')
                .replace(/<ul>/g, '<ul class="doc-list">')
                .replace(/<ol>/g, '<ol class="doc-list">')
                .replace(/<code>/g, '<code class="doc-code">')
                .replace(/<pre>/g, '<pre class="doc-pre">');
            
            return html;
        } catch (error) {
            console.error('Markdown解析错误:', error);
            // 降级到原有处理方式
            return content.replace(/\n/g, '<br>');
        }
    }
    
    // 保存为DOCX
    function saveAsDocx() {
        if (!improvedContent) {
            showNotification('没有可保存的内容', 'warning');
            return;
        }
        
        const saveData = {
            content: improvedContent,
            documentName: currentDocumentData.documentName + '_改进版',
            metadata: {
                generatedAt: new Date().toISOString(),
                originalDocument: currentDocumentData.documentName,
                improvementType: '智能修改'
            }
        };
        
        fetch('/api/save-document-docx', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(saveData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('保存失败');
            }
            return response.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentDocumentData.documentName}_改进版_${Date.now()}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification('DOCX文档已保存', 'success');
        })
        .catch(error => {
            console.error('保存DOCX失败:', error);
            showNotification('保存DOCX失败', 'error');
        });
    }
    
    // 保存为PDF
    function saveAsPdf() {
        if (!improvedContent) {
            showNotification('没有可保存的内容', 'warning');
            return;
        }
        
        const saveData = {
            content: improvedContent,
            documentName: currentDocumentData.documentName + '_改进版',
            metadata: {
                generatedAt: new Date().toISOString(),
                originalDocument: currentDocumentData.documentName,
                improvementType: '智能修改'
            }
        };
        
        fetch('/api/save-document-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(saveData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('保存失败');
            }
            return response.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentDocumentData.documentName}_改进版_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification('PDF文档已保存', 'success');
        })
        .catch(error => {
            console.error('保存PDF失败:', error);
            showNotification('保存PDF失败', 'error');
        });
    }
    
    // 显示通知
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        notification.style.background = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
});