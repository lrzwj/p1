document.addEventListener('DOMContentLoaded', function() {
    // 文档体系智能生成相关元素
    const businessDescription = document.getElementById('businessDescription');
    const industryType = document.getElementById('industryType');
    const referenceStandardGen = document.getElementById('referenceStandardGen');
    const startAnalysis = document.getElementById('startAnalysis');
    const generateFramework = document.getElementById('generateFramework');
    const analysisStatus = document.getElementById('analysisStatus');
    const departments = document.getElementById('departments');
    const products = document.getElementById('products');
    const processes = document.getElementById('processes');
    const frameworkPreview = document.getElementById('frameworkPreview');
    const documentTree = document.getElementById('documentTree');
    const downloadFramework = document.getElementById('downloadFramework');
    const editFramework = document.getElementById('editFramework');

    let currentAnalysisResult = null;
    let currentFramework = null;

    // 开始智能分析
    if (startAnalysis) {
        startAnalysis.addEventListener('click', async function() {
            const description = businessDescription.value.trim();
            if (!description) {
                alert('请输入企业业务描述');
                return;
            }

            const originalText = this.innerHTML;
            this.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> 分析中...';
            this.disabled = true;
            analysisStatus.textContent = '正在分析...';

            try {
                const response = await fetch('/api/analyze-business-description', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        description: description,
                        industry: industryType.value,
                        standard: referenceStandardGen.value
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    currentAnalysisResult = result.data;
                    displayAnalysisResults(result.data);
                    generateFramework.disabled = false;
                    analysisStatus.textContent = '分析完成';
                    
                    if (typeof showNotification === 'function') {
                        showNotification('业务分析完成', 'success');
                    }
                } else {
                    throw new Error(result.message || '分析失败');
                }
            } catch (error) {
                console.error('分析失败:', error);
                analysisStatus.textContent = '分析失败';
                if (typeof showNotification === 'function') {
                    showNotification('分析失败: ' + error.message, 'error');
                } else {
                    alert('分析失败: ' + error.message);
                }
            } finally {
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    }

    // 生成文档体系框架
    if (generateFramework) {
        generateFramework.addEventListener('click', async function() {
            if (!currentAnalysisResult) {
                alert('请先进行业务分析');
                return;
            }

            const originalText = this.innerHTML;
            this.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> 生成中...';
            this.disabled = true;

            try {
                const response = await fetch('/api/generate-document-framework', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        departments: currentAnalysisResult.departments || [],
                        products: currentAnalysisResult.products || [],
                        processes: currentAnalysisResult.processes || [],
                        industry: industryType.value,
                        standard: referenceStandardGen.value
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    currentFramework = result.data.framework;
                    displayFrameworkPreview(result.data.framework);
                    
                    if (typeof showNotification === 'function') {
                        showNotification('文档体系框架生成完成', 'success');
                    }
                } else {
                    throw new Error(result.message || '生成失败');
                }
            } catch (error) {
                console.error('生成失败:', error);
                if (typeof showNotification === 'function') {
                    showNotification('生成失败: ' + error.message, 'error');
                } else {
                    alert('生成失败: ' + error.message);
                }
            } finally {
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    }

    // 下载框架
    if (downloadFramework) {
        downloadFramework.addEventListener('click', function() {
            if (!currentFramework) {
                alert('请先生成文档体系框架');
                return;
            }
            
            downloadFrameworkAsWord(currentFramework);
        });
    }

    // 编辑框架
    if (editFramework) {
        editFramework.addEventListener('click', function() {
            if (!currentFramework) {
                alert('请先生成文档体系框架');
                return;
            }
            
            alert('编辑功能开发中...');
        });
    }

    // 显示分析结果
    function displayAnalysisResults(data) {
        if (departments) departments.textContent = data.departments ? data.departments.join(', ') : '-';
        if (products) products.textContent = data.products ? data.products.join(', ') : '-';
        if (processes) processes.textContent = data.processes ? data.processes.join(', ') : '-';
    }

    // 显示框架预览
    function displayFrameworkPreview(framework) {
        if (!frameworkPreview || !documentTree) return;
        
        frameworkPreview.style.display = 'block';
        documentTree.innerHTML = '';
        
        if (framework && framework.categories) {
            framework.categories.forEach(category => {
                const categoryLi = document.createElement('li');
                categoryLi.innerHTML = `<strong>${category.name}</strong>`;
                
                if (category.documents && category.documents.length > 0) {
                    const docUl = document.createElement('ul');
                    category.documents.forEach(doc => {
                        const docLi = document.createElement('li');
                        docLi.textContent = doc.name;
                        if (doc.description) {
                            docLi.title = doc.description;
                        }
                        docUl.appendChild(docLi);
                    });
                    categoryLi.appendChild(docUl);
                }
                
                documentTree.appendChild(categoryLi);
            });
        }
    }

    // 下载框架为Word文档
    function downloadFrameworkAsWord(framework) {
        try {
            if (!framework || !framework.categories) {
                throw new Error('无效的框架数据');
            }

            // 调用后端API生成DOCX
            fetch('/api/download-framework-docx', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ framework })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('下载失败');
                }
                return response.blob();
            })
            .then(blob => {
                // 创建下载链接
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '企业文档体系框架.docx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                if (typeof showNotification === 'function') {
                    showNotification('框架下载完成', 'success');
                }
            })
            .catch(error => {
                console.error('下载失败:', error);
                if (typeof showNotification === 'function') {
                    showNotification('下载失败: ' + error.message, 'error');
                } else {
                    alert('下载失败: ' + error.message);
                }
            });
            
        } catch (error) {
            console.error('下载失败:', error);
            if (typeof showNotification === 'function') {
                showNotification('下载失败: ' + error.message, 'error');
            } else {
                alert('下载失败: ' + error.message);
            }
        }
    }

});