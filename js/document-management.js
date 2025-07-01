// 文档管理模块
// 在文件开头添加调试信息
console.log('document-management.js 已加载');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM内容已加载，开始初始化文件上传功能');
    
    // 文档管理相关元素
    const fileUpload = document.getElementById('fileUpload');
    const fileList = document.getElementById('fileList');
    const uploadArea = document.getElementById('uploadArea');
    
    console.log('元素检查结果:', {
        fileUpload: !!fileUpload,
        fileList: !!fileList,
        uploadArea: !!uploadArea
    });
    
    // 文件上传区域
    if (uploadArea && fileUpload) {
        console.log('开始绑定上传事件监听器');
        
        uploadArea.addEventListener('click', function() {
            console.log('上传区域被点击');
            fileUpload.click();
        });

        // 添加这个关键的事件监听器！
        fileUpload.addEventListener('change', function(e) {
            console.log('文件选择发生变化:', e.target.files);
            const files = e.target.files;
            if (files && files.length > 0) {
                handleFileUpload(files);
            }
        });

        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = '#4361ee';
            this.style.backgroundColor = 'rgba(67, 97, 238, 0.05)';
        });

        uploadArea.addEventListener('dragleave', function() {
            this.style.borderColor = '#e2e8f0';
            this.style.backgroundColor = '#f8fafc';
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = '#e2e8f0';
            this.style.backgroundColor = '#f8fafc';
            
            const files = e.dataTransfer.files;
            handleFileUpload(files);
        });
    } else {
        console.error('关键元素缺失:', {
            uploadArea: !!uploadArea,
            fileUpload: !!fileUpload
        });
    }
    
    // 文件上传处理函数优化
    function handleFileUpload(files) {
        console.log('开始处理文件:', files); // 添加调试日志
        
        if (!files || files.length === 0) {
            alert('请选择要上传的文件');
            return;
        }
        
        // 检查文件类型
        const allowedTypes = /\.(doc|docx|pdf|txt)$/i;
        for (let file of files) {
            console.log('检查文件:', file.name, file.type, file.size); // 添加调试日志
            
            if (!allowedTypes.test(file.name)) {
                alert(`文件 "${file.name}" 格式不支持，只支持 DOC, DOCX, PDF, TXT 格式`);
                return;
            }
            
            // 检查文件大小 (10MB)
            if (file.size > 10 * 1024 * 1024) {
                alert(`文件 "${file.name}" 大小超过10MB限制`);
                return;
            }
        }
        
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        
        console.log('准备上传文件，FormData:', formData); // 添加调试日志
        
        // 显示上传进度
        const uploadStatus = document.createElement('div');
        uploadStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在上传文件...';
        uploadStatus.className = 'upload-status';
        
        // 确保fileList存在
        if (!fileList) {
            console.error('找不到fileList元素');
            alert('页面元素错误，请刷新页面重试');
            return;
        }
        
        fileList.appendChild(uploadStatus);
        
        // 上传文件
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log('响应状态:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        // 修复handleFileUpload函数的成功处理部分
        .then(data => {
            uploadStatus.remove();
            console.log('上传响应:', data);
            
            if (data.success) {
                console.log('上传成功，文件列表:', data.files);
                
                // 修复：将 response.files 改为 data.files
                data.files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.dataset.name = file.name;
                    fileItem.dataset.filename = file.filename; // 保存完整的带时间戳的文件名
                    fileItem.dataset.originalname = file.originalName;
                    fileItem.dataset.size = file.size;
                    fileItem.dataset.path = file.path;
                    
                    fileItem.innerHTML = `
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">${(file.size / 1024).toFixed(2)} KB</span>
                        <span class="file-path" style="display:none;">${file.path}</span>
                        <button onclick="removeFile(this)" class="remove-btn">删除</button>
                    `;
                    
                    // 确保添加到正确的容器
                    const fileList = document.getElementById('fileList');
                    if (fileList) {
                        fileList.appendChild(fileItem);
                        console.log('文件项已添加到DOM:', file.name);
                    } else {
                        console.error('未找到 #fileList 容器');
                    }
                });
                
                // 显示成功消息
                // 删除这行：showNotification('文件上传成功！', 'success');
                
                // 清空文件选择器，允许重复选择同一文件
                if (fileUpload) {
                    fileUpload.value = '';
                }
                
            } else {
                alert('文件上传失败：' + (data.message || '未知错误'));
            }
        })
        .catch(error => {
            uploadStatus.remove();
            console.error('上传错误:', error);
            alert('文件上传失败：' + error.message);
        });
    }
    
    // 开始文档分析
    function startDocumentAnalysis(files) {
        // 调用文档分析API
        fetch('/api/documents/extract-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files: files })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('文档分析完成:', data);
                // 可以在这里触发三元组抽取
                if (data.text) {
                    extractTriples(data.text);
                }
            }
        })
        .catch(error => {
            console.error('文档分析失败:', error);
        });
    }
    
    // 抽取三元组
    function extractTriples(text) {
        fetch('/api/documents/extract-triples', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('三元组抽取完成:', data.triples);
                // 可以在这里显示抽取结果或自动保存到图谱
            }
        })
        .catch(error => {
            console.error('三元组抽取失败:', error);
        });
    }

    // 开始诊断 - 移除或注释掉这部分，避免冲突
    // if (startDiagnosis) {
    //     startDiagnosis.addEventListener('click', function() {
    //         // 诊断逻辑
    //     });
    // }

    // 下载缺失清单
    if (downloadMissingList) {
        downloadMissingList.addEventListener('click', function() {
            // 下载逻辑
        });
    }

    // 生成诊断报告
    if (generateReport) {
        generateReport.addEventListener('click', function() {
            // 报告生成逻辑
        });
    }

    // 新诊断
    if (newDiagnosis) {
        newDiagnosis.addEventListener('click', function() {
            // 重置诊断逻辑
        });
    }
});

// 添加删除文件功能
function removeFile(button) {
    const fileItem = button.closest('.file-item');
    if (fileItem) {
        fileItem.remove();
        console.log('文件已从列表中移除');
    }
}
