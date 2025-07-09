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
    // 在renderGraph函数中添加节点和边的点击事件
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
            
            // 添加节点右键菜单
            cy.on('cxttap', 'node', function(evt) {
                const node = evt.target;
                showNodeContextMenu(evt, node);
            });
            
            // 添加边右键菜单
            cy.on('cxttap', 'edge', function(evt) {
                const edge = evt.target;
                showEdgeContextMenu(evt, edge);
            });
            
            // 添加双击编辑功能
            cy.on('dblclick', 'node', function(evt) {
                const node = evt.target;
                editNode(node);
            });
            
            cy.on('dblclick', 'edge', function(evt) {
                const edge = evt.target;
                editRelationship(edge);
            });
            
            // 添加空白区域右键菜单（创建新节点）
            cy.on('cxttap', function(evt) {
                if (evt.target === cy) {
                    showCreateNodeMenu(evt);
                }
            });
            
            // 存储cy实例供其他函数使用
            window.cyInstance = cy;
            
            console.log('知识图谱渲染成功');
        } catch (error) {
            console.error('知识图谱渲染失败:', error);
            knowledgeGraph.innerHTML = '<div class="error-message">图谱渲染失败，请检查数据格式</div>';
        }
    }

    // 显示节点右键菜单
    function showNodeContextMenu(evt, node) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="menu-item" onclick="editNode('${node.id()}')">编辑节点</div>
            <div class="menu-item" onclick="deleteNode('${node.id()}')">删除节点</div>
            <div class="menu-item" onclick="viewNodeDetails('${node.id()}')">查看详情</div>
            <div class="menu-item" onclick="createRelationshipFrom('${node.id()}')">创建关系</div>
        `;
        
        menu.style.position = 'absolute';
        menu.style.left = evt.originalEvent.clientX + 'px';
        menu.style.top = evt.originalEvent.clientY + 'px';
        
        document.body.appendChild(menu);
        
        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                if (menu.parentNode) {
                    menu.parentNode.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
            });
        }, 100);
    }

    // 显示边右键菜单
    function showEdgeContextMenu(evt, edge) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="menu-item" onclick="editRelationship('${edge.id()}')">编辑关系</div>
            <div class="menu-item" onclick="deleteRelationship('${edge.id()}')">删除关系</div>
        `;
        
        menu.style.position = 'absolute';
        menu.style.left = evt.originalEvent.clientX + 'px';
        menu.style.top = evt.originalEvent.clientY + 'px';
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                if (menu.parentNode) {
                    menu.parentNode.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
            });
        }, 100);
    }

    // 显示创建节点菜单
    function showCreateNodeMenu(evt) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="menu-item" onclick="createNode()">创建新节点</div>
        `;
        
        menu.style.position = 'absolute';
        menu.style.left = evt.originalEvent.clientX + 'px';
        menu.style.top = evt.originalEvent.clientY + 'px';
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                if (menu.parentNode) {
                    menu.parentNode.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
            });
        }, 100);
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

    // 创建节点
    window.createNode = async function() {
        const modal = createModal('创建节点', `
            <form id="createNodeForm">
                <div class="form-group">
                    <label>节点名称:</label>
                    <input type="text" id="nodeName" required>
                </div>
                <div class="form-group">
                    <label>节点类型:</label>
                    <select id="nodeType" required>
                        <option value="Standard">标准</option>
                        <option value="Enterprise">企业</option>
                        <option value="Department">部门</option>
                        <option value="Process">流程</option>
                        <option value="Product">产品</option>
                        <option value="Document">文档</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>描述:</label>
                    <textarea id="nodeDescription"></textarea>
                </div>
                <div class="form-actions">
                    <button type="submit">创建</button>
                    <button type="button" onclick="closeModal()">取消</button>
                </div>
            </form>
        `);
        
        document.getElementById('createNodeForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const nodeData = {
                label: document.getElementById('nodeType').value,
                name: document.getElementById('nodeName').value,
                properties: {
                    description: document.getElementById('nodeDescription').value
                }
            };
            
            try {
                const response = await fetch('/api/knowledge-graph/nodes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nodeData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('节点创建成功', 'success');
                    closeModal();
                    refreshGraph();
                } else {
                    showNotification('创建失败: ' + result.message, 'error');
                }
            } catch (error) {
                showNotification('创建失败: ' + error.message, 'error');
            }
        });
    };

    // 编辑节点
    window.editNode = async function(nodeId) {
        try {
            // 获取节点详情
            const response = await fetch(`/api/knowledge-graph/nodes/${nodeId}`);
            const result = await response.json();
            
            if (!result.success) {
                showNotification('获取节点信息失败', 'error');
                return;
            }
            
            const node = result.data;
            
            const modal = createModal('编辑节点', `
                <form id="editNodeForm">
                    <div class="form-group">
                        <label>节点名称:</label>
                        <input type="text" id="editNodeName" value="${node.label}" required>
                    </div>
                    <div class="form-group">
                        <label>描述:</label>
                        <textarea id="editNodeDescription">${node.properties.description || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit">保存</button>
                        <button type="button" onclick="closeModal()">取消</button>
                    </div>
                </form>
            `);
            
            document.getElementById('editNodeForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const updateData = {
                    name: document.getElementById('editNodeName').value,
                    properties: {
                        description: document.getElementById('editNodeDescription').value
                    }
                };
                
                try {
                    const updateResponse = await fetch(`/api/knowledge-graph/nodes/${nodeId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    });
                    
                    const updateResult = await updateResponse.json();
                    
                    if (updateResult.success) {
                        showNotification('节点更新成功', 'success');
                        closeModal();
                        refreshGraph();
                    } else {
                        showNotification('更新失败: ' + updateResult.message, 'error');
                    }
                } catch (error) {
                    showNotification('更新失败: ' + error.message, 'error');
                }
            });
        } catch (error) {
            showNotification('获取节点信息失败: ' + error.message, 'error');
        }
    };

    // 删除节点
    window.deleteNode = async function(nodeId) {
        if (!confirm('确定要删除这个节点吗？这将同时删除所有相关的关系。')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/knowledge-graph/nodes/${nodeId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('节点删除成功', 'success');
                refreshGraph();
            } else {
                showNotification('删除失败: ' + result.message, 'error');
            }
        } catch (error) {
            showNotification('删除失败: ' + error.message, 'error');
        }
    };

    // 查看节点详情
    window.viewNodeDetails = async function(nodeId) {
        try {
            const response = await fetch(`/api/knowledge-graph/nodes/${nodeId}`);
            const result = await response.json();
            
            if (!result.success) {
                showNotification('获取节点详情失败', 'error');
                return;
            }
            
            const node = result.data;
            
            const connectionsHtml = node.connections.map(conn => 
                `<li>${conn.connectedNodeName} (${conn.relationshipType})</li>`
            ).join('');
            
            createModal('节点详情', `
                <div class="node-details">
                    <h3>${node.label}</h3>
                    <p><strong>类型:</strong> ${node.type}</p>
                    <p><strong>描述:</strong> ${node.properties.description || '无'}</p>
                    <h4>连接关系:</h4>
                    <ul>${connectionsHtml || '<li>无连接关系</li>'}</ul>
                    <div class="form-actions">
                        <button onclick="closeModal()">关闭</button>
                    </div>
                </div>
            `);
        } catch (error) {
            showNotification('获取节点详情失败: ' + error.message, 'error');
        }
    };

    // 创建关系
    window.createRelationshipFrom = function(sourceNodeId) {
        // 获取所有节点作为目标选项
        const nodes = window.cyInstance.nodes().map(node => ({
            id: node.id(),
            label: node.data('label')
        })).filter(node => node.id !== sourceNodeId);
        
        const targetOptions = nodes.map(node => 
            `<option value="${node.id}">${node.label}</option>`
        ).join('');
        
        const modal = createModal('创建关系', `
            <form id="createRelationshipForm">
                <div class="form-group">
                    <label>目标节点:</label>
                    <select id="targetNode" required>
                        <option value="">请选择目标节点</option>
                        ${targetOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>关系类型:</label>
                    <input type="text" id="relationshipType" placeholder="如：包含、依赖、关联" required>
                </div>
                <div class="form-group">
                    <label>描述:</label>
                    <textarea id="relationshipDescription"></textarea>
                </div>
                <div class="form-actions">
                    <button type="submit">创建</button>
                    <button type="button" onclick="closeModal()">取消</button>
                </div>
            </form>
        `);
        
        document.getElementById('createRelationshipForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const relationshipData = {
                sourceId: sourceNodeId,
                targetId: document.getElementById('targetNode').value,
                type: document.getElementById('relationshipType').value,
                properties: {
                    description: document.getElementById('relationshipDescription').value
                }
            };
            
            try {
                const response = await fetch('/api/knowledge-graph/relationships', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(relationshipData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('关系创建成功', 'success');
                    closeModal();
                    refreshGraph();
                } else {
                    showNotification('创建失败: ' + result.message, 'error');
                }
            } catch (error) {
                showNotification('创建失败: ' + error.message, 'error');
            }
        });
    };

    // 刷新图谱
    function refreshGraph() {
        if (refreshGraphBtn) {
            refreshGraphBtn.click();
        }
    }

    // 创建模态框
    function createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
    }

    // 关闭模态框
    window.closeModal = function() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    };