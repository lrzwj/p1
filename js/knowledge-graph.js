// 知识图谱管理模块
document.addEventListener('DOMContentLoaded', function() {
    // 知识图谱相关元素
    const knowledgeGraph = document.getElementById('knowledgeGraph');
    const graphType = document.getElementById('graphType');
    const refreshGraphBtn = document.getElementById('refreshGraph');
    const entitySearch = document.getElementById('entitySearch');
    const syncToNeo4jBtn = document.getElementById('syncToNeo4j');

    // 完整的知识图谱数据
    // 更新图谱数据结构 - 改为层次结构
    const graphData = {
        standard: {
            name: '标准层视图',
            description: '显示ISO标准和相关条款',
            nodes: [
                { id: 'iso9001', label: 'ISO 9001:2015', type: 'standard' },
                { id: 'iso14001', label: 'ISO 14001:2015', type: 'standard' },
                { id: 'clause1', label: '4.1 组织环境', type: 'standard' },
                { id: 'clause2', label: '4.2 相关方需求', type: 'standard' }
            ],
            edges: [
                { source: 'iso9001', target: 'clause1', label: '包含' },
                { source: 'iso9001', target: 'clause2', label: '包含' }
            ]
        },
        enterprise: {
            name: '企业层视图',
            description: '显示企业和部门结构',
            nodes: [
                { id: 'company1', label: '制造企业', type: 'enterprise' },
                { id: 'dept1', label: '质量部', type: 'enterprise' },
                { id: 'dept2', label: '生产部', type: 'enterprise' },
                { id: 'dept3', label: '研发部', type: 'enterprise' }
            ],
            edges: [
                { source: 'company1', target: 'dept1', label: '包含' },
                { source: 'company1', target: 'dept2', label: '包含' },
                { source: 'company1', target: 'dept3', label: '包含' }
            ]
        },
        process: {
            name: '流程层视图', 
            description: '显示业务流程和相关实体',
            nodes: [
                { id: 'design', label: '设计开发', type: 'process' },
                { id: 'production', label: '生产制造', type: 'process' },
                { id: 'product_a', label: '产品A', type: 'process' },
                { id: 'customer_a', label: '客户A', type: 'process' }
            ],
            edges: [
                { source: 'design', target: 'production', label: '输出到' },
                { source: 'production', target: 'product_a', label: '生产' },
                { source: 'product_a', target: 'customer_a', label: '交付给' }
            ]
        },
        document: {
            name: '文档层视图',
            description: '显示文档体系结构',
            nodes: [
                { id: 'framework1', label: '质量管理体系框架', type: 'document' },
                { id: 'category1', label: '管理文件', type: 'document' },
                { id: 'category2', label: '操作文件', type: 'document' },
                { id: 'doc1', label: '质量手册', type: 'document' },
                { id: 'doc2', label: '程序文件', type: 'document' }
            ],
            edges: [
                { source: 'framework1', target: 'category1', label: '包含' },
                { source: 'framework1', target: 'category2', label: '包含' },
                { source: 'category1', target: 'doc1', label: '包括' },
                { source: 'category2', target: 'doc2', label: '包括' }
            ]
        },
        complete: {
            name: '完整视图',
            description: '显示所有层次的关联关系',
            nodes: [],
            edges: []
        }
    };

    // 更新图谱类型名称映射
    function getGraphTypeName(type) {
        const typeNames = {
            'standard': '标准层视图',
            'enterprise': '企业层视图',
            'process': '流程层视图', 
            'document': '文档层视图',
            'complete': '完整视图'
        };
        return typeNames[type] || '未知视图';
    }
    // 渲染知识图谱
    function renderGraph(data) {
        if (!knowledgeGraph) {
            console.error('知识图谱容器未找到');
            return;
        }
        
        // 清空现有内容
        knowledgeGraph.innerHTML = '';
        
        try {
            // 使用 Cytoscape 渲染图谱
            const cy = cytoscape({
                container: knowledgeGraph,
                elements: [
                    // 节点
                    ...data.nodes.map(node => ({
                        data: {
                            id: node.id,
                            label: node.label,
                            type: node.type
                        }
                    })),
                    // 边
                    ...data.edges.map(edge => ({
                        data: {
                            id: `${edge.source}-${edge.target}`,
                            source: edge.source,
                            target: edge.target,
                            label: edge.label
                        }
                    }))
                ],
                // 在renderGraph函数中，修改节点样式配置
                style: [
                    {
                        selector: 'node',
                        style: {
                            'background-color': function(ele) {
                                const type = ele.data('type');
                                switch(type) {
                                    case 'standard': return '#3498db';
                                    case 'document': return '#2ecc71';
                                    case 'process': return '#e74c3c';
                                    case 'department': return '#f39c12';
                                    case 'product': return '#9b59b6';
                                    default: return '#95a5a6';
                                }
                            },
                            'label': 'data(label)',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'color': '#fff',
                            'font-size': '11px',
                            'font-weight': 'bold',
                            // 动态调整节点大小
                            'width': function(ele) {
                                const label = ele.data('label');
                                const minWidth = 80;
                                const maxWidth = 200;
                                const charWidth = 8; // 每个字符大约8px宽度
                                const calculatedWidth = Math.max(minWidth, Math.min(maxWidth, label.length * charWidth + 20));
                                return calculatedWidth + 'px';
                            },
                            'height': function(ele) {
                                const label = ele.data('label');
                                const minHeight = 40;
                                const maxHeight = 80;
                                // 根据文本长度计算是否需要多行显示
                                const estimatedLines = Math.ceil(label.length / 10); // 假设每行10个字符
                                const calculatedHeight = Math.max(minHeight, Math.min(maxHeight, estimatedLines * 20 + 10));
                                return calculatedHeight + 'px';
                            },
                            // 文本换行设置
                            'text-wrap': 'wrap',
                            'text-max-width': function(ele) {
                                const label = ele.data('label');
                                const minWidth = 70;
                                const maxWidth = 180;
                                const charWidth = 8;
                                return Math.max(minWidth, Math.min(maxWidth, label.length * charWidth)) + 'px';
                            },
                            // 节点形状
                            'shape': 'round-rectangle',
                            // 边框样式
                            'border-width': 2,
                            'border-color': '#fff',
                            'border-opacity': 0.8
                        }
                    }, // <- 删除这里的多余逗号
                    {
                        selector: 'edge',
                        style: {
                            'width': 2,
                            'line-color': '#ccc',
                            'target-arrow-color': '#ccc',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            'label': 'data(label)',
                            'font-size': '10px',
                            'text-rotation': 'autorotate'
                        }
                    }
                ],
                layout: {
                    name: 'cose',
                    animate: true,
                    animationDuration: 1000
                }
            });
            
            console.log('知识图谱渲染成功');
        } catch (error) {
            console.error('知识图谱渲染失败:', error);
            knowledgeGraph.innerHTML = '<div class="error-message">图谱渲染失败，请检查数据格式</div>';
        }
    }

    // 刷新图谱
    // 修改图谱类型切换事件监听器
    if (graphType) {
        graphType.addEventListener('change', async function() {
            const selectedType = this.value;
            console.log('切换图谱类型:', selectedType);
            
            try {
                // 从服务器获取对应类型的图谱数据
                const response = await fetch(`/api/graph-data/${selectedType}`);
                const result = await response.json();
                
                if (result.success) {
                    renderGraph(result.data);
                    if (typeof showNotification === 'function') {
                        showNotification(`已切换到${getGraphTypeName(selectedType)}`, 'success');
                    }
                } else {
                    // 如果获取失败，使用静态数据作为后备
                    const fallbackData = graphData[selectedType] || graphData.integrated;
                    renderGraph(fallbackData);
                    if (typeof showNotification === 'function') {
                        showNotification('使用示例数据显示图谱', 'warning');
                    }
                }
            } catch (error) {
                console.error('获取图谱数据失败:', error);
                // 使用静态数据作为后备
                const fallbackData = graphData[selectedType] || graphData.integrated;
                renderGraph(fallbackData);
                if (typeof showNotification === 'function') {
                    showNotification('网络错误，使用示例数据', 'error');
                }
            }
        });
    }
    
    // 获取图谱类型中文名称
    // 获取图谱类型中文名称
    function getGraphTypeName(type) {
        const typeNames = {
            'complete': '完整视图',
            'standard': '标准层视图',
            'enterprise': '企业层视图', 
            'process': '流程层视图',
            'document': '文档层视图',
            // 保留旧的兼容性
            'integrated': '综合知识图谱'
        };
        return typeNames[type] || '未知图谱';
    }
    
    // 修改刷新按钮逻辑
    if (refreshGraphBtn) {
        refreshGraphBtn.addEventListener('click', async function() {
            console.log('刷新图谱按钮被点击');
            const selectedType = graphType ? graphType.value : 'integrated';
            
            try {
                const response = await fetch(`/api/graph-data/${selectedType}`);
                const result = await response.json();
                
                if (result.success) {
                    renderGraph(result.data);
                    if (typeof showNotification === 'function') {
                        showNotification('图谱数据已刷新', 'success');
                    }
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('刷新图谱失败:', error);
                if (typeof showNotification === 'function') {
                    showNotification('刷新失败: ' + error.message, 'error');
                }
            }
        });
    }

    // 实体搜索
    if (entitySearch) {
        entitySearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            console.log('搜索实体:', searchTerm);
            // 这里可以添加搜索逻辑
        });
    }

    // 同步到Neo4j
    if (syncToNeo4jBtn) {
        syncToNeo4jBtn.addEventListener('click', async function() {
            console.log('同步到Neo4j按钮被点击');
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 同步中...';
            this.disabled = true;
            
            try {
                const response = await fetch('/api/sync-graph-to-neo4j', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    if (typeof showNotification === 'function') {
                        showNotification(result.message, 'success');
                    } else {
                        alert(result.message);
                    }
                } else {
                    if (typeof showNotification === 'function') {
                        showNotification(result.message || '同步失败', 'error');
                    } else {
                        alert(result.message || '同步失败');
                    }
                }
            } catch (error) {
                console.error('同步失败:', error);
                if (typeof showNotification === 'function') {
                    showNotification('同步失败：' + error.message, 'error');
                } else {
                    alert('同步失败：' + error.message);
                }
            } finally {
                this.innerHTML = originalText;
                this.disabled = false;
            }
        });
    }

    // 导入示例数据到Neo4j
    const importSampleDataBtn = document.getElementById('importSampleDataBtn');
    if (importSampleDataBtn) {
        importSampleDataBtn.addEventListener('click', async function() {
            if (confirm('确定要导入示例数据到Neo4j数据库吗？这将添加新的节点和关系。')) {
                console.log('导入示例数据按钮被点击');
                const originalText = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导入中...';
                this.disabled = true;
                
                try {
                    const response = await fetch('/api/import-sample-data', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        if (typeof showNotification === 'function') {
                            showNotification(result.message, 'success');
                        } else {
                            alert(result.message);
                        }
                        console.log('导入详情:', result.details);
                        
                        // 刷新知识图谱显示
                        const selectedType = graphType ? graphType.value : 'integrated';
                        const data = graphData[selectedType] || graphData.integrated;
                        renderGraph(data);
                    } else {
                        if (typeof showNotification === 'function') {
                            showNotification(result.message || '导入示例数据失败', 'error');
                        } else {
                            alert(result.message || '导入示例数据失败');
                        }
                    }
                } catch (error) {
                    console.error('导入示例数据失败:', error);
                    if (typeof showNotification === 'function') {
                        showNotification('导入示例数据失败：' + error.message, 'error');
                    } else {
                        alert('导入示例数据失败：' + error.message);
                    }
                } finally {
                    this.innerHTML = originalText;
                    this.disabled = false;
                }
            }
        });
    }

    // 初始化时渲染默认图谱
    const initialData = graphData.integrated;
    renderGraph(initialData);
    
    console.log('知识图谱模块初始化完成');
});

// 在renderGraph函数的cy初始化后添加
cy.on('mouseover', 'node', function(evt) {
    const node = evt.target;
    const label = node.data('label');
    
    // 创建工具提示
    const tooltip = document.createElement('div');
    tooltip.className = 'graph-tooltip';
    tooltip.textContent = label;
    tooltip.style.left = evt.renderedPosition.x + 'px';
    tooltip.style.top = evt.renderedPosition.y + 'px';
    
    knowledgeGraph.appendChild(tooltip);
    
    // 鼠标离开时移除工具提示
    node.on('mouseout', function() {
        if (tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
    });
});