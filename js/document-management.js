// 文档管理模块
document.addEventListener('DOMContentLoaded', function() {
    // 文档管理相关元素
    const fileUpload = document.getElementById('fileUpload');
    const fileList = document.getElementById('fileList');
    const uploadArea = document.getElementById('uploadArea');
    const startDiagnosis = document.getElementById('startDiagnosis');
    const diagnosisResults = document.getElementById('diagnosisResults');
    const downloadMissingList = document.getElementById('downloadMissingList');
    const generateReport = document.getElementById('generateReport');
    const newDiagnosis = document.getElementById('newDiagnosis');

    // 文件上传区域
    if (uploadArea && fileUpload) {
        uploadArea.addEventListener('click', function() {
            fileUpload.click();
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
    }

    // 文件上传处理
    // 文件上传处理
    function handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        
        // 显示上传进度
        const uploadStatus = document.createElement('div');
        uploadStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在上传文件...';
        fileList.appendChild(uploadStatus);
        
        // 上传文件
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            uploadStatus.remove();
            
            if (data.success) {
                // 显示上传成功的文件
                data.files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.innerHTML = `
                        <i class="fas fa-file-alt"></i>
                        <span>${file.name}</span>
                        <span class="file-size">${(file.size / 1024).toFixed(1)} KB</span>
                    `;
                    fileList.appendChild(fileItem);
                });
                
                // 自动开始文档分析
                startDocumentAnalysis(data.files);
            } else {
                alert('文件上传失败：' + data.message);
            }
        })
        .catch(error => {
            uploadStatus.remove();
            console.error('上传错误:', error);
            alert('文件上传失败');
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

    // 开始诊断
    if (startDiagnosis) {
        startDiagnosis.addEventListener('click', function() {
            // 诊断逻辑
        });
    }

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