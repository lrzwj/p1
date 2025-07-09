// 文档生成器主要逻辑
class DocumentGenerator {
    constructor() {
        this.generationData = null;
        this.isGenerating = false;
        this.generatedContent = '';
        this.init();
    }
    
    init() {
        // 从sessionStorage获取生成数据
        const data = sessionStorage.getItem('documentGenerationData');
        if (data) {
            this.generationData = JSON.parse(data);
            this.loadDocumentInfo();
        } else {
            this.showError('未找到文档生成数据，请重新操作');
            return;
        }
        
        // 绑定事件
        this.bindEvents();
    }
    
    loadDocumentInfo() {
        const docMeta = document.getElementById('docMeta');
        const data = this.generationData;
        
        docMeta.innerHTML = `
            <h4><i class='bx bx-file'></i> ${data.documentName}</h4>
            <p><strong>描述：</strong>${data.description || '暂无描述'}</p>
            <p><strong>缺失原因：</strong>${data.reason || '未说明'}</p>
            <p><strong>影响评估：</strong>${data.impact || '未评估'}</p>
            <p><strong>优先级：</strong><span class="priority-badge priority-${data.priority || 'medium'}">${this.getPriorityText(data.priority)}</span></p>
            <p><strong>参照标准：</strong>${data.diagnosisContext?.standard || 'ISO 9001'}</p>
        `;
    }
    
    bindEvents() {
        const startBtn = document.getElementById('startGeneration');
        const editBtn = document.getElementById('editDocument');
        
        // 绑定开始生成按钮
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startGeneration());
        }
        
        // 绑定编辑按钮
        if (editBtn) {
            editBtn.addEventListener('click', () => this.editDocument());
        }
        
        // 绑定保存按钮（需要等到生成完成后才会显示）
        const saveDocxBtn = document.getElementById('saveDocx');
        const savePdfBtn = document.getElementById('savePdf');
        
        if (saveDocxBtn) {
            saveDocxBtn.addEventListener('click', () => this.saveAsDocx());
        }
        
        if (savePdfBtn) {
            savePdfBtn.addEventListener('click', () => this.saveAsPdf());
        }
    }
    
    async startGeneration() {
        if (this.isGenerating) return;
        
        this.isGenerating = true;
        this.generatedContent = '';
        
        // 更新UI状态
        this.updateGenerationUI(true);
        
        try {
            // 准备生成请求数据
            const generateData = {
                documentName: this.generationData.documentName,
                description: this.generationData.description,
                reason: this.generationData.reason,
                impact: this.generationData.impact,
                priority: this.generationData.priority,
                diagnosisContext: this.generationData.diagnosisContext,
                // 添加生成设置
                generationMode: document.getElementById('generationMode').value,
                contentStyle: document.getElementById('contentStyle').value,
                includeExamples: document.getElementById('includeExamples').checked
            };
            
            // 发起流式生成请求
            await this.streamGeneration(generateData);
            
        } catch (error) {
            console.error('生成失败:', error);
            this.showError('文档生成失败: ' + error.message);
        } finally {
            this.isGenerating = false;
            this.updateGenerationUI(false);
        }
    }
    
    async streamGeneration(generateData) {
        const response = await fetch('/api/generate-missing-document-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(generateData)
        });
        
        if (!response.ok) {
            throw new Error('生成请求失败');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const output = document.getElementById('generationOutput');
        
        output.innerHTML = '';
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    
                    if (data === '[DONE]') {
                        this.onGenerationComplete();
                        return;
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            // 只在这里累加一次
                            this.generatedContent += parsed.content;
                            this.updateOutput(); // 不传参数，直接更新显示
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }
    }
    
    // 添加Markdown转HTML的函数
    markdownToHtml(markdown) {
        if (!markdown) return '';
        
        return markdown
            // 先处理 Markdown 标题（按层级从深到浅）
            .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // 然后处理数字编号标题（按层级深度正确分配）
            .replace(/^(\d+\.\d+\.\d+)\s+(.*$)/gim, '<h4>$1 $2</h4>') // 三级编号如 4.1.1
            .replace(/^(\d+\.\d+)\s+(.*$)/gim, '<h3>$1 $2</h3>') // 二级编号如 4.1
            .replace(/^(\d+\.)\s+(.*$)/gim, '<h2>$1 $2</h2>') // 一级编号如 4.
            // 处理粗体，去除**符号
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // 处理斜体，去除*符号
            .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
            // 处理代码，去除`符号
            .replace(/`([^`]+?)`/g, '<code>$1</code>')
            // 代码块
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // 处理无序列表，去除-和*符号
            .replace(/^[*-]\s+(.*$)/gim, '<li>$1</li>')
            // 处理有序列表，去除数字和点号
            .replace(/^\d+\.\s+(.*$)/gim, '<li>$1</li>')
            // 处理分隔线，去除---
            .replace(/^---+$/gm, '<hr>')
            // 处理段落分隔
            .replace(/\n\s*\n/g, '||PARAGRAPH||')
            // 处理单个换行
            .replace(/\n/g, '<br>')
            // 恢复段落分隔
            .split('||PARAGRAPH||')
            .map(paragraph => {
                paragraph = paragraph.trim();
                if (!paragraph) return '';
                
                // 如果段落包含标题标签，不包装在p标签中
                if (paragraph.match(/<h[1-6]>/)) {
                    return paragraph;
                }
                // 如果段落包含列表项，包装在ul标签中
                if (paragraph.includes('<li>')) {
                    return '<ul>' + paragraph + '</ul>';
                }
                // 如果是分隔线，直接返回
                if (paragraph === '<hr>') {
                    return paragraph;
                }
                // 普通段落包装在p标签中
                return '<p>' + paragraph + '</p>';
            })
            .filter(p => p) // 过滤空段落
            .join('');
    }
    
    updateOutput() {
        const output = document.getElementById('generationOutput');
        
        // 获取或创建内容容器
        const contentDiv = output.querySelector('.generated-content') || this.createContentDiv();
        
        // 转换整个内容为HTML并显示
        const htmlContent = this.markdownToHtml(this.generatedContent);
        contentDiv.innerHTML = htmlContent;
        
        // 滚动到底部
        output.scrollTop = output.scrollHeight;
    }
    
    createContentDiv() {
        const output = document.getElementById('generationOutput');
        output.innerHTML = '';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'generated-content';
        output.appendChild(contentDiv);
        
        return contentDiv;
    }
    
    updateGenerationUI(isGenerating) {
        const startBtn = document.getElementById('startGeneration');
        const saveButtons = document.getElementById('saveButtons');
        const editBtn = document.getElementById('editDocument');
        const indicator = document.getElementById('streamingIndicator');
        const progress = document.getElementById('generationProgress');
        
        if (isGenerating) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> 生成中...';
            indicator.classList.add('active');
            progress.classList.add('active');
            if (saveButtons) saveButtons.style.display = 'none';
            if (editBtn) editBtn.style.display = 'none';
        } else {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="bx bx-play"></i> 重新生成';
            indicator.classList.remove('active');
            progress.classList.remove('active');
            
            if (this.generatedContent) {
                if (saveButtons) saveButtons.style.display = 'flex';
                if (editBtn) editBtn.style.display = 'inline-block';
            }
        }
    }
    
    onGenerationComplete() {
        // 移除光标效果
        const output = document.getElementById('generationOutput');
        const cursor = output.querySelector('.cursor-blink');
        if (cursor) {
            cursor.classList.remove('cursor-blink');
        }
        
        this.showNotification('文档生成完成！', 'success');
    }
    
    saveAsDocx() {
        if (!this.generatedContent) {
            this.showNotification('没有可保存的内容', 'warning');
            return;
        }
        
        const saveData = {
            content: this.generatedContent,
            documentName: this.generationData.documentName,
            metadata: {
                generatedAt: new Date().toISOString(),
                priority: this.generationData.priority,
                documentType: this.generationData.documentType
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
            a.download = `${this.generationData.documentName}_${Date.now()}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('DOCX文档已保存', 'success');
        })
        .catch(error => {
            console.error('保存DOCX失败:', error);
            this.showNotification('保存DOCX失败', 'error');
        });
    }
    
    saveAsPdf() {
        if (!this.generatedContent) {
            this.showNotification('没有可保存的内容', 'warning');
            return;
        }
        
        const saveData = {
            content: this.generatedContent,
            documentName: this.generationData.documentName,
            metadata: {
                generatedAt: new Date().toISOString(),
                priority: this.generationData.priority,
                documentType: this.generationData.documentType
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
            a.download = `${this.generationData.documentName}_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('PDF文档已保存', 'success');
        })
        .catch(error => {
            console.error('保存PDF失败:', error);
            this.showNotification('保存PDF失败', 'error');
        });
    }
    
    editDocument() {
        if (!this.generatedContent) {
            this.showNotification('没有可编辑的内容', 'warning');
            return;
        }
        
        // 将生成的内容传递给文档编辑器
        const editorData = {
            documentName: this.generationData.documentName,
            isNewDocument: true,
            originalContent: this.generatedContent,
            generatedContent: this.generatedContent,
            generationContext: this.generationData.diagnosisContext,
            missingDocInfo: this.generationData
        };
        
        sessionStorage.setItem('documentEditorData', JSON.stringify(editorData));
        window.open('document-editor.html', '_blank');
    }
    
    getPriorityText(priority) {
        const priorityMap = {
            // 支持英文优先级
            'critical': '关键优先级',
            'high': '高优先级',
            'medium': '中优先级',
            'low': '低优先级',
            // 支持中文优先级
            '高': '高优先级',
            '中': '中优先级',
            '低': '低优先级'
        };
        return priorityMap[priority] || '中优先级';
    }
    
    showNotification(message, type = 'info') {
        // 简单的通知实现
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
    
    showError(message) {
        const output = document.getElementById('generationOutput');
        output.innerHTML = `
            <div style="color: #ef4444; text-align: center; margin-top: 50px;">
                <i class='bx bx-error' style="font-size: 48px; display: block; margin-bottom: 15px;"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new DocumentGenerator();
});