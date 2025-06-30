// 三元组抽取功能
document.addEventListener('DOMContentLoaded', function() {
    const extractBtn = document.getElementById('extractTriples');
    const extractionText = document.getElementById('extractionText');
    const triplesResults = document.getElementById('triplesContainer');
    const saveTriplesBtn = document.getElementById('saveTriples');
    const exportTriplesBtn = document.getElementById('exportTriples');
    const uploadForExtractionBtn = document.getElementById('uploadForExtraction');
    console.log('extractBtn:', extractBtn);
    console.log('uploadForExtractionBtn:', uploadForExtractionBtn);

    // 抽取三元组
    if (extractBtn && extractionText) {
        extractBtn.addEventListener('click', async function() {
            const text = extractionText.value.trim();
            
            if (!text) {
                showNotification('请输入文本内容', 'warning');
                return;
            }
            
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 抽取中...';
            this.disabled = true;
            
            try {
                const response = await fetch('/api/extract-triples', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text })
                });
                
                const result = await response.json();
                console.log('API返回结果:', result);
                
                if (result.success && triplesResults) {
                    console.log('三元组数据:', result.triples);
                    displayTriples(result.triples);
                    showNotification(`成功抽取 ${result.triples.length} 个三元组`, 'success');
                } else {
                    console.log('API调用失败或triplesContainer未找到');
                    showNotification(result.message || '抽取失败', 'error');
                }
            } catch (error) {
                console.error('抽取失败:', error);
                showNotification('抽取失败：' + error.message, 'error');
            } finally {
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    }

    // 上传文档功能
    if (uploadForExtractionBtn) {
        uploadForExtractionBtn.addEventListener('click', function() {
            // 在extractBtn.addEventListener内部第一行添加
            console.log('抽取按钮被点击了！');
            
            // 在uploadForExtractionBtn.addEventListener内部已有
            console.log('上传按钮被点击了！');
            
            // 创建文件输入元素
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.multiple = true;
            fileInput.accept = '.pdf,.doc,.docx,.txt';
            
            fileInput.addEventListener('change', async function(e) {
                const files = e.target.files;
                if (files.length === 0) return;
                
                // 验证文件格式
                const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
                const invalidFiles = [];
                
                for (let file of files) {
                    const ext = '.' + file.name.split('.').pop().toLowerCase();
                    if (!allowedTypes.includes(ext)) {
                        invalidFiles.push(file.name);
                    }
                }
                
                if (invalidFiles.length > 0) {
                    showNotification(`不支持的文件格式: ${invalidFiles.join(', ')}。支持的格式: PDF, DOC, DOCX, TXT`, 'error');
                    return;
                }
                
                // 显示上传进度
                const originalText = uploadForExtractionBtn.innerHTML;
                uploadForExtractionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传并抽取中...';
                uploadForExtractionBtn.disabled = true;
                
                try {
                    // 创建FormData
                    const formData = new FormData();
                    for (let file of files) {
                        formData.append('files', file);
                    }
                    
                    // 发送请求到多文档三元组抽取API
                    const response = await fetch('/api/extract-triples-from-files', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    // 在上传文档处理部分（约第104行）
                    if (result.success) {
                    // 显示抽取结果 - 使用 result.data.triples
                    displayTriples(result.data.triples);
                    
                    // 显示文件处理结果
                    let fileInfo = `成功处理 ${result.data.totalFiles} 个文件：\n`;
                    result.data.fileResults.forEach(file => {
                        fileInfo += `• ${file.fileName}: ${file.tripleCount} 个三元组\n`;
                    });
                    
                    showNotification(
                        `文档上传成功！\n${fileInfo}\n总计抽取 ${result.data.uniqueTriples} 个唯一三元组`, 
                        'success'
                    );
                    
                    // 清空文本框
                    if (extractionText) {
                        extractionText.value = '';
                    }
                    
                    // 显示分析报告（可选）
                    if (result.data.analysisReport) {
                        console.log('文档分析报告:', result.data.analysisReport);
                    }
                } else {
                    showNotification(result.message || '文档处理失败', 'error');
                }
                
            } catch (error) {
                console.error('文档上传失败:', error);
                showNotification('文档上传失败：' + error.message, 'error');
            } finally {
                uploadForExtractionBtn.innerHTML = originalText;
                uploadForExtractionBtn.disabled = false;
            }
        });  // 闭合 fileInput.addEventListener
        
        // 触发文件选择
        fileInput.click();
    });  // 闭合 uploadForExtractionBtn.addEventListener
}

    // 保存三元组功能
    // 修改保存三元组的API调用
    if (saveTriplesBtn) {
        saveTriplesBtn.addEventListener('click', async function() {
            if (!currentTriples || currentTriples.length === 0) {
                showNotification('没有可保存的三元组', 'warning');
                return;
            }
            
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
            this.disabled = true;
            
            try {
                const response = await fetch('/api/add-triples', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ triples: currentTriples })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('三元组保存成功，已按类型分类到图谱中', 'success');
                    
                    // 自动刷新当前显示的图谱
                    const graphType = document.getElementById('graphType');
                    if (graphType) {
                        const event = new Event('change');
                        graphType.dispatchEvent(event);
                    }
                } else {
                    showNotification(result.message || '保存失败', 'error');
                }
            } catch (error) {
                console.error('保存失败:', error);
                showNotification('保存失败：' + error.message, 'error');
            } finally {
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    }

    // 导出三元组
    if (exportTriplesBtn) {
        exportTriplesBtn.addEventListener('click', function() {
            if (!currentTriples || currentTriples.length === 0) {
                showNotification('没有可导出的三元组', 'warning');
                return;
            }
            
            // 创建CSV内容
            const csvContent = 'data:text/csv;charset=utf-8,' + 
                '主体,关系,客体,置信度\n' +
                currentTriples.map(triple => 
                    `"${triple.subject}","${triple.predicate}","${triple.object}",${triple.confidence || 0}`
                ).join('\n');
            
            // 创建下载链接
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `三元组_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification('三元组导出成功', 'success');
        });
    }
});

// 全局变量
let currentTriples = [];

// 显示三元组函数
function displayTriples(triples) {
    currentTriples = triples;
    const container = document.getElementById('triplesContainer');
    const saveTriplesBtn = document.getElementById('saveTriples');
    const exportTriplesBtn = document.getElementById('exportTriples');
    
    if (!container || !triples || triples.length === 0) {
        if (container) {
            container.innerHTML = '<div class="alert alert-info">暂无三元组数据</div>';
        }
        // 禁用按钮
        if (saveTriplesBtn) saveTriplesBtn.disabled = true;
        if (exportTriplesBtn) exportTriplesBtn.disabled = true;
        return;
    }
    
    // 启用按钮
    if (saveTriplesBtn) saveTriplesBtn.disabled = false;
    if (exportTriplesBtn) exportTriplesBtn.disabled = false;
    
    // 统计信息
    const stats = {
        total: triples.length,
        subjects: new Set(triples.map(t => t.subject)).size,
        predicates: new Set(triples.map(t => t.predicate)).size,
        objects: new Set(triples.map(t => t.object)).size
    };
    
    // 按置信度排序
    const sortedTriples = triples.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    container.innerHTML = `
        <div class="triples-stats mb-3">
            <div class="row">
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-number">${stats.total}</div>
                        <div class="stat-label">总三元组</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-number">${stats.subjects}</div>
                        <div class="stat-label">唯一主体</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-number">${stats.predicates}</div>
                        <div class="stat-label">唯一关系</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-number">${stats.objects}</div>
                        <div class="stat-label">唯一客体</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="triples-list">
            ${sortedTriples.map((triple, index) => `
                <div class="triple-item" data-index="${index}">
                    <div class="triple-content">
                        <div class="triple-subject">
                            <span class="label">主体:</span>
                            <span class="value">${triple.subject}</span>
                        </div>
                        <div class="triple-predicate">
                            <span class="label">关系:</span>
                            <span class="value">${triple.predicate}</span>
                        </div>
                        <div class="triple-object">
                            <span class="label">客体:</span>
                            <span class="value">${triple.object}</span>
                        </div>
                        ${triple.confidence ? `
                            <div class="triple-confidence">
                                <span class="label">置信度:</span>
                                <span class="value confidence-${getConfidenceLevel(triple.confidence)}">
                                    ${(triple.confidence * 100).toFixed(1)}%
                                </span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// 辅助函数：获取置信度等级
function getConfidenceLevel(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
}