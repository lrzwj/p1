// 实体管理模块
document.addEventListener('DOMContentLoaded', function() {
    // 实体管理相关元素
    const entitiesTable = document.getElementById('entitiesTable');
    const addEntityBtn = document.getElementById('addEntity');
    const relationsTable = document.getElementById('relationsTable');
    const addRelationBtn = document.getElementById('addRelation');

    // 实体数据
    const entitiesData = [
        { id: 1, name: 'ISO 9001:2015', type: '标准', description: '质量管理体系标准' },
        { id: 2, name: '质量手册', type: '文档', description: '企业质量管理体系文档' },
        { id: 3, name: '设计流程', type: '流程', description: '产品设计开发流程' }
    ];

    // 关系数据
    const relationsData = [
        { id: 1, source: 'ISO 9001:2015', relation: '要求', target: '质量手册' },
        { id: 2, source: '质量手册', relation: '包含', target: '设计流程' }
    ];

    // 渲染实体表格
    function renderEntitiesTable() {
        if (!entitiesTable) return;
        
        const tbody = entitiesTable.querySelector('tbody');
        if (!tbody) return;
        
        tbody.innerHTML = entitiesData.map(entity => `
            <tr>
                <td>${entity.id}</td>
                <td>${entity.name}</td>
                <td><span class="badge badge-${getTypeClass(entity.type)}">${entity.type}</span></td>
                <td>${entity.description}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-entity" data-id="${entity.id}">
                        <i class="bx bx-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-entity" data-id="${entity.id}">
                        <i class="bx bx-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // 渲染关系表格
    function renderRelationsTable() {
        if (!relationsTable) return;
        
        const tbody = relationsTable.querySelector('tbody');
        if (!tbody) return;
        
        tbody.innerHTML = relationsData.map(relation => `
            <tr>
                <td>${relation.id}</td>
                <td>${relation.source}</td>
                <td><span class="badge badge-info">${relation.relation}</span></td>
                <td>${relation.target}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-relation" data-id="${relation.id}">
                        <i class="bx bx-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-relation" data-id="${relation.id}">
                        <i class="bx bx-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // 获取类型样式类
    function getTypeClass(type) {
        const typeMap = {
            '标准': 'primary',
            '文档': 'success',
            '流程': 'warning',
            '实体': 'info'
        };
        return typeMap[type] || 'secondary';
    }

    // 添加实体
    if (addEntityBtn) {
        addEntityBtn.addEventListener('click', function() {
            // 添加实体逻辑
        });
    }

    // 添加关系
    if (addRelationBtn) {
        addRelationBtn.addEventListener('click', function() {
            // 添加关系逻辑
        });
    }

    // 初始化表格
    renderEntitiesTable();
    renderRelationsTable();
});