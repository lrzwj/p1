const express = require('express');
const router = express.Router();
const { knowledgeGraphDB } = require('../utils/graphUtils'); // 需要创建这个工具模块

// 获取实体类型名称的工具函数
function getEntityTypeName(type) {
    const typeMap = {
        'standard': '标准',
        'document': '文档',
        'process': '流程',
        'integrated': '综合'
    };
    return typeMap[type] || type;
}

// 实体列表API
router.get('/entities', (req, res) => {
    // 转换为前端需要的格式
    const entities = knowledgeGraphDB.nodes.map((node, index) => {
        // 计算该实体的属性数和关系数
        const relations = knowledgeGraphDB.edges.filter(edge => 
            edge.source === node.id || edge.target === node.id
        ).length;
        
        return {
            id: index + 1,
            name: node.label,
            type: getEntityTypeName(node.type),
            properties: Math.floor(Math.random() * 5) + 1, // 模拟属性数量
            relations
        };
    });
    
    setTimeout(() => {
        res.json({ success: true, data: entities });
    }, 300); // 保留少量延迟以模拟网络请求
});

// 关系列表API
router.get('/relations', (req, res) => {
    // 转换为前端需要的格式
    const relations = knowledgeGraphDB.edges.map((edge, index) => {
        const sourceNode = knowledgeGraphDB.nodes.find(node => node.id === edge.source);
        const targetNode = knowledgeGraphDB.nodes.find(node => node.id === edge.target);
        
        return {
            id: index + 1,
            source: sourceNode ? sourceNode.label : 'Unknown',
            relation: edge.label,
            target: targetNode ? targetNode.label : 'Unknown',
            confidence: edge.confidence || 0.8
        };
    });
    
    setTimeout(() => {
        res.json({ success: true, data: relations });
    }, 300); // 保留少量延迟以模拟网络请求
});

module.exports = router;