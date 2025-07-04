// 文档体系缺失诊断功能
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const uploadArea = document.getElementById('uploadArea');
    const fileUpload = document.getElementById('fileUpload');
    const fileList = document.getElementById('fileList');
    const referenceStandard = document.getElementById('referenceStandard');
    const diagnosisDepth = document.getElementById('diagnosisDepth');
    const startDiagnosis = document.getElementById('startDiagnosis');
    // 获取DOM元素
    const diagnosisResults = document.querySelector('.diagnosis-results');
    const completenessProgress = document.getElementById('completenessProgress');
    const completenessValue = document.getElementById('completenessValue');
    const healthProgress = document.getElementById('healthProgress');
    const healthValue = document.getElementById('healthValue');
    const missingList = document.getElementById('missingList');
    // 删除这行：const issuesList = document.getElementById('issuesList');
    const generateReport = document.getElementById('generateReport');
    const downloadMissingList = document.getElementById('downloadMissingList');
    const newDiagnosis = document.getElementById('newDiagnosis');

    // 存储上传的文件和诊断结果
    let uploadedFiles = [];
    let currentDiagnosisResult = null;

    // 文件上传区域点击事件
    if (uploadArea) {
        uploadArea.addEventListener('click', function() {
            fileUpload.click();
        });

        // 拖拽上传功能
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            handleFileUpload(files);
        });
    }

    // 文件选择事件
    if (fileUpload) {
        fileUpload.addEventListener('change', function(e) {
            handleFileUpload(e.target.files);
        });
    }

    // 处理文件上传
    function handleFileUpload(files) {
        const allowedTypes = ['.doc', '.docx', '.pdf', '.txt'];
        
        Array.from(files).forEach(file => {
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            
            if (!allowedTypes.includes(fileExtension)) {
                if (typeof showNotification === 'function') {
                    showNotification(`不支持的文件格式: ${file.name}`, 'error');
                } else {
                    alert(`不支持的文件格式: ${file.name}`);
                }
                return;
            }

            // 检查文件是否已存在
            if (uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
                if (typeof showNotification === 'function') {
                    showNotification(`文件已存在: ${file.name}`, 'warning');
                } else {
                    alert(`文件已存在: ${file.name}`);
                }
                return;
            }

            uploadedFiles.push(file);
            addFileToList(file);
        });

        updateUploadArea();
    }

    // 添加文件到列表
    function addFileToList(file) {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = `
            <div class="file-info">
                <i class='bx bx-file'></i>
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${formatFileSize(file.size)})</span>
            </div>
            <button class="btn-small btn-danger" onclick="removeFile('${file.name}', ${file.size})">
                <i class='bx bx-trash'></i>
            </button>
        `;
        fileList.appendChild(li);
    }

    // 移除文件
    window.removeFile = function(fileName, fileSize) {
        uploadedFiles = uploadedFiles.filter(f => !(f.name === fileName && f.size === fileSize));
        updateFileList();
        updateUploadArea();
    };

    // 更新文件列表显示
    function updateFileList() {
        fileList.innerHTML = '';
        uploadedFiles.forEach(file => {
            addFileToList(file);
        });
    }

    // 更新上传区域状态
    function updateUploadArea() {
        if (uploadedFiles.length > 0) {
            uploadArea.classList.add('has-files');
        } else {
            uploadArea.classList.remove('has-files');
        }
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 开始诊断
    if (startDiagnosis) {
        startDiagnosis.addEventListener('click', async function() {
            if (uploadedFiles.length === 0) {
                if (typeof showNotification === 'function') {
                    showNotification('请先上传文档文件', 'warning');
                } else {
                    alert('请先上传文档文件');
                }
                return;
            }

            const originalText = this.innerHTML;
            this.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> 诊断中...';
            this.disabled = true;

            try {
                // 创建FormData对象
                const formData = new FormData();
                uploadedFiles.forEach(file => {
                    formData.append('documents', file);
                });
                formData.append('standard', referenceStandard.value);
                formData.append('depth', diagnosisDepth.value);

                const response = await fetch('/api/diagnose-documents', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                
                if (result.success) {
                    currentDiagnosisResult = result.data;
                    displayDiagnosisResults(result.data);
                    
                    if (typeof showNotification === 'function') {
                        showNotification('文档诊断完成', 'success');
                    }
                } else {
                    throw new Error(result.message || '诊断失败');
                }
            } catch (error) {
                console.error('诊断失败:', error);
                if (typeof showNotification === 'function') {
                    showNotification('诊断失败: ' + error.message, 'error');
                } else {
                    alert('诊断失败: ' + error.message);
                }
            } finally {
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    }

    // 显示诊断结果
    // 在displayDiagnosisResults函数开头添加
    function displayDiagnosisResults(data) {
        if (!diagnosisResults) return;
        
        // 将诊断结果设置为全局变量，供openDocumentEditor使用
        window.currentDiagnosisResult = data;
        
        // 显示结果区域
        diagnosisResults.style.display = 'block';
    
        // 更新完整度
        if (completenessProgress && completenessValue) {
            const completeness = data.completeness?.percentage || 0;
            completenessProgress.style.width = completeness + '%';
            completenessValue.textContent = completeness + '%';
            
            // 根据完整度设置颜色
            if (completeness >= 80) {
                completenessProgress.className = 'progress progress-success';
            } else if (completeness >= 60) {
                completenessProgress.className = 'progress progress-warning';
            } else {
                completenessProgress.className = 'progress progress-danger';
            }
        }
    
        // 更新健康度
        if (healthProgress && healthValue) {
            const health = data.healthScore?.score || 0;
            healthProgress.style.width = health + '%';
            healthValue.textContent = health + '%';
            
            // 根据健康度设置颜色
            if (health >= 80) {
                healthProgress.className = 'progress progress-success';
            } else if (health >= 60) {
                healthProgress.className = 'progress progress-warning';
            } else {
                healthProgress.className = 'progress progress-danger';
            }
        }
    
        // 新增：显示现有文档分析
        displayExistingDocumentsAnalysis(data.existingDocumentAnalysis || []);
    
        // 显示缺失文档
        if (missingList && data.missingDocuments) {
            missingList.innerHTML = '';
            data.missingDocuments.forEach(doc => {
                const li = document.createElement('li');
                li.className = 'missing-item';
                li.innerHTML = `
                    <div class="missing-info">
                        <strong>${doc.name}</strong>
                        <p class="missing-description">${doc.description || '暂无描述'}</p>
                        <p class="missing-reason"><strong>缺失原因：</strong>${doc.reason || '未说明'}</p>
                        <p class="missing-impact"><strong>影响：</strong>${doc.impact || '未评估'}</p>
                        <span class="priority priority-${doc.priority || 'medium'}">${getPriorityText(doc.priority)}</span>
                    </div>
                `;
                missingList.appendChild(li);
            });
        }

        // 新增：显示改进建议
        displayRecommendations(data.recommendations || []);
    }

    // 新增：显示现有文档分析的函数
    function displayExistingDocumentsAnalysis(existingDocs) {
        const existingDocsList = document.getElementById('existingDocsList');
        if (!existingDocsList) return;
    
        existingDocsList.innerHTML = '';
        
        if (existingDocs.length === 0) {
            existingDocsList.innerHTML = '<p class="no-data">暂无现有文档分析数据</p>';
            return;
        }
    
        existingDocs.forEach((doc, index) => {
            const docCard = document.createElement('div');
            docCard.className = 'existing-doc-card';
            
            const qualityScore = doc.currentQuality?.score || 0;
            const qualityClass = qualityScore >= 80 ? 'high' : qualityScore >= 60 ? 'medium' : 'low';
            
            docCard.innerHTML = `
                <div class="doc-header">
                    <h5><i class='bx bx-file'></i> ${doc.documentName}</h5>
                    <div class="doc-actions">
                        <button class="btn-small btn-primary smart-edit-btn" 
                                data-doc-index="${index}" 
                                data-doc-name="${doc.documentName}">
                            <i class='bx bx-edit-alt'></i> 智能修改
                        </button>
                        <div class="quality-score quality-${qualityClass}">
                            <span class="score-value">${qualityScore}</span>
                            <span class="score-label">质量评分</span>
                        </div>
                    </div>
                </div>
                
                <div class="doc-analysis">
                    ${doc.currentQuality?.strengths?.length > 0 ? `
                        <div class="strengths">
                            <h6><i class='bx bx-check-circle'></i> 优点</h6>
                            <ul>
                                ${doc.currentQuality.strengths.map(strength => `<li>${strength}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${doc.currentQuality?.weaknesses?.length > 0 ? `
                        <div class="weaknesses">
                            <h6><i class='bx bx-x-circle'></i> 不足</h6>
                            <ul>
                                ${doc.currentQuality.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${doc.missingContent?.length > 0 ? `
                        <div class="missing-content">
                            <h6><i class='bx bx-error'></i> 缺失内容</h6>
                            <div class="missing-elements">
                                ${doc.missingContent.map(missing => `
                                    <div class="missing-element priority-${missing.priority || 'medium'}">
                                        <strong>${missing.element}</strong>
                                        <p>${missing.description}</p>
                                        <span class="impact">影响：${missing.impact}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${doc.improvementSuggestions?.length > 0 ? `
                        <div class="improvement-suggestions">
                            <h6><i class='bx bx-bulb'></i> 改进建议</h6>
                            <ul>
                                ${doc.improvementSuggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
            
            existingDocsList.appendChild(docCard);
        });
        
        // 添加智能修改按钮事件监听
        document.querySelectorAll('.smart-edit-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const docIndex = this.getAttribute('data-doc-index');
                const docName = this.getAttribute('data-doc-name');
                openDocumentEditor(docIndex, docName, existingDocs[docIndex]);
            });
        });
    };

    // 新增：显示改进建议的函数
    function displayRecommendations(recommendations) {
        const recommendationsList = document.getElementById('recommendationsList');
        if (!recommendationsList) return;
    
        recommendationsList.innerHTML = '';
        
        if (recommendations.length === 0) {
            recommendationsList.innerHTML = '<p class="no-data">暂无改进建议</p>';
            return;
        }
    
        const groupedRecommendations = {
            immediate: [],
            short_term: [],
            long_term: []
        };
    
        recommendations.forEach(rec => {
            const type = rec.type || 'short_term';
            if (groupedRecommendations[type]) {
                groupedRecommendations[type].push(rec);
            }
        });
    
        const typeLabels = {
            immediate: '立即执行',
            short_term: '短期计划',
            long_term: '长期规划'
        };
    
        Object.keys(groupedRecommendations).forEach(type => {
            if (groupedRecommendations[type].length > 0) {
                const section = document.createElement('div');
                section.className = `recommendations-section ${type}`;
                section.innerHTML = `
                    <h6><i class='bx bx-time'></i> ${typeLabels[type]}</h6>
                    <div class="recommendations-list">
                        ${groupedRecommendations[type].map(rec => `
                            <div class="recommendation-item">
                                <h7>${rec.title}</h7>
                                <ul>
                                    ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                                </ul>
                            </div>
                        `).join('')}
                    </div>
                `;
                recommendationsList.appendChild(section);
            }
        });
    }

    // 删除getSeverityText函数
    function getPriorityText(priority) {
        const priorityMap = {
            // 支持英文优先级
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

    // 获取严重程度文本
    function getSeverityText(severity) {
        const severityMap = {
            'high': '严重',
            'medium': '一般',
            'low': '轻微'
        };
        return severityMap[severity] || '一般';
    }

    // 生成诊断报告
    if (generateReport) {
        generateReport.addEventListener('click', async function() {
            if (!currentDiagnosisResult) {
                if (typeof showNotification === 'function') {
                    showNotification('请先进行文档诊断', 'warning');
                } else {
                    alert('请先进行文档诊断');
                }
                return;
            }

            const originalText = this.innerHTML;
            this.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> 生成中...';
            this.disabled = true;

            try {
                const response = await fetch('/api/generate-diagnosis-report', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        diagnosisResult: currentDiagnosisResult,
                        standard: referenceStandard.value,
                        depth: diagnosisDepth.value
                    })
                });

                if (!response.ok) {
                    throw new Error('报告生成失败');
                }

                const blob = await response.blob();
                
                // 创建下载链接
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `文档体系缺失分析报告_${Date.now()}.docx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                if (typeof showNotification === 'function') {
                    showNotification('诊断报告下载完成', 'success');
                }
            } catch (error) {
                console.error('报告生成失败:', error);
                if (typeof showNotification === 'function') {
                    showNotification('报告生成失败: ' + error.message, 'error');
                } else {
                    alert('报告生成失败: ' + error.message);
                }
            } finally {
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    }

    // 下载缺失清单
    if (downloadMissingList) {
        downloadMissingList.addEventListener('click', function() {
            if (!currentDiagnosisResult || !currentDiagnosisResult.missingDocuments) {
                if (typeof showNotification === 'function') {
                    showNotification('暂无缺失文档数据', 'warning');
                } else {
                    alert('暂无缺失文档数据');
                }
                return;
            }

            // 生成CSV格式的缺失清单
            let csvContent = '文档名称,描述,优先级\n';
            currentDiagnosisResult.missingDocuments.forEach(doc => {
                csvContent += `"${doc.name}","${doc.description || ''}","${getPriorityText(doc.priority)}"\n`;
            });

            // 创建下载
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `缺失文档清单_${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (typeof showNotification === 'function') {
                showNotification('缺失清单下载完成', 'success');
            }
        });
    }

    // 新诊断
    if (newDiagnosis) {
        newDiagnosis.addEventListener('click', function() {
            // 重置所有状态
            uploadedFiles = [];
            currentDiagnosisResult = null;
            
            // 清空文件列表
            fileList.innerHTML = '';
            
            // 隐藏结果区域
            diagnosisResults.style.display = 'none';
            
            // 重置上传区域
            updateUploadArea();
            
            // 重置表单
            if (fileUpload) fileUpload.value = '';
            
            if (typeof showNotification === 'function') {
                showNotification('已重置，可以开始新的诊断', 'info');
            }
        });
    }
});

// 新增：打开文档编辑器的函数
// 修改openDocumentEditor函数，确保正确传递文档内容
function openDocumentEditor(docIndex, docName, docData) {
    // 获取当前诊断结果中的改进建议
    const improvementSuggestions = docData.improvementSuggestions || [];
    const missingContent = docData.missingContent || [];
    const weaknesses = docData.currentQuality?.weaknesses || [];
    
    // 尝试从多个可能的字段获取原始内容
    let originalContent = docData.content || 
                         docData.originalContent || 
                         docData.extractedContent || 
                         docData.textContent || 
                         docData.contentPreview || 
                         '';
    
    // 如果还是没有内容，从当前诊断结果中查找对应文档的内容
    if (!originalContent && window.currentDiagnosisResult && window.currentDiagnosisResult.uploadedDocuments) {
        const matchedDoc = window.currentDiagnosisResult.uploadedDocuments.find(doc => 
            doc.name === docName || doc.name.includes(docName.replace(/\.[^/.]+$/, ""))
        );
        if (matchedDoc) {
            originalContent = matchedDoc.content || matchedDoc.contentPreview || '';
        }
    }
    
    // 如果仍然没有内容，提供更详细的提示
    if (!originalContent || originalContent.trim() === '') {
        originalContent = `文档内容暂时无法获取，请检查文档是否正确上传或联系管理员。`; // 修复了字符串闭合问题
    }
    
    // 将文档数据存储到sessionStorage中，供编辑页面使用
    const editorData = {
        documentName: docName,
        documentIndex: docIndex,
        documentData: docData,
        originalContent: originalContent,
        analysisResult: docData,
        // 新增：改进建议相关数据
        improvementSuggestions: improvementSuggestions,
        missingContent: missingContent,
        weaknesses: weaknesses,
        // 新增：诊断上下文
        diagnosisContext: {
            standard: document.getElementById('referenceStandard')?.value || '',
            depth: document.getElementById('diagnosisDepth')?.value || '',
            industry: '制造业' // 可以从其他地方获取
        }
    };
    
    sessionStorage.setItem('documentEditorData', JSON.stringify(editorData));
    
    // 打开新窗口或跳转到编辑页面
    window.open('document-editor.html', '_blank');
}