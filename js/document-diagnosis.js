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
    // 显示诊断结果
    function displayDiagnosisResults(data) {
        if (!diagnosisResults) return;
    
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

        // 显示缺失文档
        if (missingList && data.missingDocuments) {
            missingList.innerHTML = '';
            data.missingDocuments.forEach(doc => {
                const li = document.createElement('li');
                li.className = 'missing-item';
                li.innerHTML = `
                    <div class="missing-info">
                        <strong>${doc.name}</strong>
                        <p>${doc.description || '暂无描述'}</p>
                        <span class="priority priority-${doc.priority || 'medium'}">${getPriorityText(doc.priority)}</span>
                    </div>
                `;
                missingList.appendChild(li);
            });
        }

        // 删除整个"显示内容问题"部分的代码
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