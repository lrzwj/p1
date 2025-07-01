class DiagnosisManager {
    constructor() {
        this.currentDiagnosisResult = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 开始诊断按钮
        const startDiagnosis = document.getElementById('startDiagnosis');
        if (startDiagnosis) {
            startDiagnosis.addEventListener('click', () => this.startDiagnosis());
        }

        // 下载缺失清单按钮 - 修复ID
        const downloadMissingList = document.getElementById('downloadMissingList');
        if (downloadMissingList) {
            downloadMissingList.addEventListener('click', () => this.downloadMissingList());
        }

        // 生成诊断报告按钮 - 修复ID
        const generateReport = document.getElementById('generateReport');
        if (generateReport) {
            generateReport.addEventListener('click', () => this.generateReport());
        }

        // 新诊断按钮
        const newDiagnosis = document.getElementById('new-diagnosis');
        if (newDiagnosis) {
            newDiagnosis.addEventListener('click', () => this.resetDiagnosis());
        }
    }

    async startDiagnosis() {
        try {
            // 获取诊断参数
            const industryType = document.getElementById('industryTypeDiagnosis')?.value || 'manufacturing';
            const referenceStandard = document.getElementById('referenceStandard')?.value || 'iso9001';
            const diagnosisDepth = document.getElementById('diagnosisDepth')?.value || 'basic';
            const enterpriseId = document.getElementById('enterprise-id')?.value || 'default';
            const useAIEnhancement = document.getElementById('ai-enhancement')?.checked || false;
            
            // 获取已上传的文件信息
            const uploadedFiles = this.getUploadedFiles();
            
            // 显示加载状态
            this.showLoadingState('正在进行智能诊断分析...');
            
            // 调用诊断API
            const response = await fetch('/api/upload/diagnose-enhanced', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    enterpriseId: enterpriseId,
                    industryType: industryType,  // 新增：行业类型参数
                    referenceStandard: referenceStandard,
                    diagnosisDepth: diagnosisDepth,
                    useAIEnhancement: true,
                    uploadedFiles: uploadedFiles
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentDiagnosisResult = result.result;  // 保存结果
                this.displayDiagnosisResults(result.result);
                // 如果使用了AI增强，显示特殊标识
                if (result.analysisSource === 'deepseek_enhanced') {
                    this.showAIEnhancementBadge();
                }
            } else {
                this.showError('诊断失败: ' + (result.error || '未知错误'));
            }
        } catch (error) {
            console.error('诊断请求失败:', error);
            this.showError('网络错误，请检查连接后重试');
        } finally {
            this.hideLoadingState();
        }
    }
    
    showAIEnhancementBadge() {
        const badge = document.createElement('div');
        badge.className = 'ai-enhancement-badge';
        badge.innerHTML = '🤖 Deepseek AI 增强分析';
        badge.style.cssText = `
            background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            margin: 10px 0;
            display: inline-block;
            box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
        `;
        
        const resultContainer = document.getElementById('diagnosis-result');
        if (resultContainer) {
            resultContainer.insertBefore(badge, resultContainer.firstChild);
        }
    }

    displayEnhancedResults(result, analysisSource) {
        // 显示基础结果
        this.displayDiagnosisResults(result);
        
        // 如果是AI增强结果，显示额外信息
        if (analysisSource === 'ai_enhanced') {
            this.displayAIInsights(result.aiInsights);
            this.displayIntelligentRecommendations(result.intelligentRecommendations);
            this.displayConfidenceScore(result.summary.confidenceScore);
        }
    }

    displayAIInsights(aiInsights) {
        const container = document.getElementById('ai-insights');
        if (!container || !aiInsights) return;
        
        const html = `
            <div class="ai-insights-panel">
                <h3>🤖 AI分析洞察</h3>
                <div class="insights-content">
                    <p>已分析文档：${aiInsights.analyzedCount}个</p>
                    <p>识别问题：${aiInsights.identifiedIssues}个</p>
                    <p>改进机会：${aiInsights.improvementOpportunities}个</p>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        container.style.display = 'block';
    }

    displayDiagnosisResults(result) {
        console.log('接收到的诊断结果:', result);
        
        // 直接显示JSON数据
        const jsonContainer = document.getElementById('jsonResult');
        if (jsonContainer) {
            jsonContainer.textContent = JSON.stringify(result, null, 2);
        }
        
        // 只保留基本的完整度和健康度显示
        const completenessElement = document.getElementById('completenessValue');
        if (completenessElement) {
            let completenessValue = '0';
            if (result.summary?.completenessRate) {
                completenessValue = result.summary.completenessRate.replace('%', '');
            } else if (result.completenessRate) {
                completenessValue = result.completenessRate.toString().replace('%', '');
            }
            completenessElement.textContent = completenessValue + '%';
        }
        
        // 更新完整度进度条
        const completenessProgress = document.getElementById('completenessProgress');
        if (completenessProgress && completenessElement) {
            const completenessValue = completenessElement.textContent.replace('%', '');
            completenessProgress.style.width = completenessValue + '%';
        }
    
        // 更新健康度显示
        const healthElement = document.getElementById('healthValue');
        if (healthElement) {
            const healthValue = result.health || result.summary?.health || '0';
            healthElement.textContent = healthValue + '%';
        }
        
        // 更新健康度进度条
        const healthProgress = document.getElementById('healthProgress');
        if (healthProgress) {
            const healthValue = result.health || result.summary?.health || '0';
            healthProgress.style.width = healthValue + '%';
        }
    
        // 显示诊断结果面板
        const resultsPanel = document.querySelector('.diagnosis-results');
        if (resultsPanel) {
            resultsPanel.style.display = 'block';
        }
    }

    // 删除第180-198行的错误代码
    // 这些代码应该被完全移除

    displayMissingDocuments(missingDocuments) {
        const container = document.getElementById('missingList'); // 修复容器ID
        if (!container) return;

        if (missingDocuments.length === 0) {
            container.innerHTML = '<li class="no-missing">恭喜！没有发现缺失的文档。</li>';
            return;
        }

        const html = missingDocuments.map(doc => `
            <li class="missing-document-item">
                <div class="doc-info">
                    <strong>${doc.name}</strong>
                    <span class="doc-category">类别: ${doc.category}</span>
                    <span class="doc-priority priority-${doc.priority}">优先级: ${this.getPriorityText(doc.priority)}</span>
                    ${doc.description ? `<p class="doc-description">${doc.description}</p>` : ''}
                </div>
            </li>
        `).join('');

        container.innerHTML = html;
    }

    displayContentIssues(contentIssues) {
        const container = document.getElementById('issuesList'); // 修复容器ID
        if (!container) return;

        if (contentIssues.length === 0) {
            container.innerHTML = '<li class="no-issues">未发现内容问题。</li>';
            return;
        }

        const html = contentIssues.map(issue => `
            <li class="content-issue-item severity-${issue.severity}">
                <strong>${issue.document}</strong>
                <p class="issue-description">${issue.issue}</p>
                <span class="severity-badge">${this.getSeverityText(issue.severity)}</span>
            </li>
        `).join('');

        container.innerHTML = html;
    }

    displayRecommendations(recommendations) {
        // 由于HTML中没有recommendations容器，我们可以将建议添加到内容问题下方
        // 或者修改HTML添加recommendations容器
        const container = document.getElementById('issuesList');
        if (!container || !recommendations || recommendations.length === 0) return;

        const recommendationsHtml = `
            <li class="recommendations-section">
                <strong>改进建议：</strong>
                <ul>
                    ${recommendations.map(rec => `<li class="recommendation-item">${rec}</li>`).join('')}
                </ul>
            </li>
        `;
        
        container.insertAdjacentHTML('beforeend', recommendationsHtml);
    }

    resetDiagnosis() {
        this.currentDiagnosisResult = null;
        
        // 隐藏结果面板
        const resultsPanel = document.querySelector('.diagnosis-results');
        if (resultsPanel) {
            resultsPanel.style.display = 'none';
        }
        
        // 清空结果显示 - 修复容器ID
        const containers = [
            'missingList',
            'issuesList'
        ];
        
        containers.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '';
            }
        });
        
        // 重置评分显示 - 修复选择器
        const completenessValue = document.getElementById('completenessValue');
        const healthValue = document.getElementById('healthValue');
        const completenessProgress = document.getElementById('completenessProgress');
        const healthProgress = document.getElementById('healthProgress');
        
        if (completenessValue) completenessValue.textContent = '0%';
        if (healthValue) healthValue.textContent = '0%';
        if (completenessProgress) completenessProgress.style.width = '0%';
        if (healthProgress) healthProgress.style.width = '0%';
    }

    async downloadMissingList() {
        if (!this.currentDiagnosisResult) {
            this.showError('请先执行诊断');
            return;
        }

        try {
            const referenceStandard = document.getElementById('reference-standard')?.value || 'ISO 9001:2015';
            const diagnosisDepth = document.getElementById('diagnosis-depth')?.value || '基础分析';
            const enterpriseId = this.getEnterpriseId();

            const url = `/api/upload/export-missing-list?enterpriseId=${enterpriseId}&referenceStandard=${encodeURIComponent(referenceStandard)}&diagnosisDepth=${encodeURIComponent(diagnosisDepth)}`;
            
            // 创建下载链接
            const link = document.createElement('a');
            link.href = url;
            link.download = 'missing-documents.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('下载失败:', error);
            this.showError('下载失败，请稍后重试');
        }
    }

    generateReport() {
        if (!this.currentDiagnosisResult) {
            this.showError('请先执行诊断');
            return;
        }

        // 生成并下载诊断报告
        const reportContent = this.generateReportContent(this.currentDiagnosisResult);
        this.downloadReport(reportContent);
    }

    generateReportContent(result) {
        const reportContent = `
# 文档体系诊断报告

## 基本信息
- 诊断标准: ${result.standard}
- 诊断时间: ${new Date(result.diagnosisDate).toLocaleString()}
- 完整度: ${result.summary?.completenessRate || '0%'}

## 诊断结果
### 缺失文档
${result.missingItems?.map(item => `- ${item.name} (${item.category})`).join('\n') || '无缺失文档'}

### 改进建议
${result.recommendations?.map(rec => `- ${rec}`).join('\n') || '暂无建议'}
    `;
        
        return reportContent;
    }

    downloadReport(content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `诊断报告_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    resetDiagnosis() {
        this.currentDiagnosisResult = null;
        
        // 隐藏结果面板
        const resultsPanel = document.querySelector('.diagnosis-results');
        if (resultsPanel) {
            resultsPanel.style.display = 'none';
        }
        
        // 清空结果显示
        const containers = [
            'missing-documents-list',
            'content-issues-list', 
            'recommendations-list'
        ];
        
        containers.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '';
            }
        });
        
        // 重置评分显示
        const scoreElements = document.querySelectorAll('.completeness-score, .health-score');
        scoreElements.forEach(element => {
            element.textContent = '--';
            element.className = element.className.split(' ')[0];
        });
    }

    // 将getUploadedFiles移到类内部作为方法
    getUploadedFiles() {
        const fileList = document.getElementById('fileList');
        const files = [];
        
        fileList.querySelectorAll('.file-item').forEach(item => {
            const fileData = item.dataset;
            files.push({
                name: fileData.name,
                filename: fileData.filename, // 确保包含完整的带时间戳的文件名
                originalname: fileData.originalname,
                size: parseInt(fileData.size),
                path: fileData.path
            });
        });
        
        console.log('获取的文件信息:', files);
        return files;
    }

    getScoreClass(score) {
        if (score >= 90) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 70) return 'fair';
        return 'poor';
    }

    getPriorityText(priority) {
        const priorityMap = {
            'high': '高',
            'medium': '中',
            'low': '低'
        };
        return priorityMap[priority] || priority;
    }

    getSeverityText(severity) {
        const severityMap = {
            'high': '严重',
            'medium': '中等',
            'low': '轻微'
        };
        return severityMap[severity] || severity;
    }

    showLoadingState(message) {
        const button = document.getElementById('startDiagnosis');  // 修复：使用正确的ID
        if (button) {
            button.disabled = true;
            button.textContent = '诊断中...';
        }
        
        // 显示加载消息
        if (message) {
            const loadingElement = document.getElementById('loading-message');
            if (loadingElement) {
                loadingElement.textContent = message;
                loadingElement.style.display = 'block';
            }
        }
    }

    hideLoadingState() {
        const button = document.getElementById('startDiagnosis');  // 修复：使用正确的ID
        if (button) {
            button.disabled = false;
            button.textContent = '开始诊断';
        }
        
        // 隐藏加载消息
        const loadingElement = document.getElementById('loading-message');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    showError(message) {
        // 显示错误消息
        const errorContainer = document.getElementById('error-message');
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }
}

// 确保类在全局作用域中可用
window.DiagnosisManager = DiagnosisManager;

// 初始化诊断管理器
document.addEventListener('DOMContentLoaded', function() {
    new DiagnosisManager();
});