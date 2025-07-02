const express = require('express');
const router = express.Router();
const { knowledgeGraph, driver } = require('../config/database');

// 获取知识图谱数据
router.get('/graph-data/:type', async (req, res) => {
    try {
        const { type } = req.params;
        console.log('请求图谱类型:', type);
        const graphData = await knowledgeGraph.getKnowledgeGraph(type);
        res.json({
            success: true,
            data: graphData,
            stats: {
                nodeCount: graphData.nodes.length,
                edgeCount: graphData.edges.length
            }
        });
    } catch (error) {
        console.error('获取知识图谱失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取图谱数据失败: ' + error.message 
        });
    }
});

// 添加三元组到知识图谱
router.post('/add-triples', async (req, res) => {
    try {
        const { triples } = req.body;
        const result = await knowledgeGraph.addTriplesToGraph(triples);
        res.json({ success: true, result });
    } catch (error) {
        console.error('添加三元组失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 搜索实体
router.get('/search/entities', async (req, res) => {
    try {
        const { term } = req.query;
        
        if (!term || term.trim() === '') {
            return res.status(400).json({
                success: false,
                message: '请提供搜索词'
            });
        }
        
        const entities = await knowledgeGraph.searchEntities(term);
        
        // 如果找到实体，获取它们的关系
        if (entities.length > 0) {
            const session = driver.session();
            try {
                // 构建查询，获取这些实体之间的关系
                const entityIds = entities.map(e => e.id);
                const query = `
                    MATCH (n)-[r]-(m)
                    WHERE id(n) IN $entityIds OR id(m) IN $entityIds
                    RETURN n, r, m
                `;
                
                const result = await session.run(query, { entityIds });
                
                const nodes = new Map();
                const edges = [];
                
                result.records.forEach(record => {
                    const startNode = record.get('n');
                    const relationship = record.get('r');
                    const endNode = record.get('m');
                    
                    // 添加节点
                    if (!nodes.has(startNode.identity.toString())) {
                        nodes.set(startNode.identity.toString(), {
                            id: startNode.identity.toString(),
                            label: startNode.properties.name,
                            type: startNode.labels[0].toLowerCase(),
                            properties: startNode.properties
                        });
                    }
                    
                    if (!nodes.has(endNode.identity.toString())) {
                        nodes.set(endNode.identity.toString(), {
                            id: endNode.identity.toString(),
                            label: endNode.properties.name,
                            type: endNode.labels[0].toLowerCase(),
                            properties: endNode.properties
                        });
                    }
                    
                    // 添加边
                    edges.push({
                        source: startNode.identity.toString(),
                        target: endNode.identity.toString(),
                        label: relationship.properties.type || relationship.type,
                        confidence: relationship.properties.confidence || 0.8,
                        properties: relationship.properties
                    });
                });
                
                res.json({
                    success: true,
                    nodes: Array.from(nodes.values()),
                    edges: edges
                });
            } finally {
                await session.close();
            }
        } else {
            res.json({
                success: true,
                nodes: [],
                edges: []
            });
        }
    } catch (error) {
        console.error('搜索实体失败:', error);
        res.status(500).json({
            success: false,
            message: '搜索实体失败',
            error: error.message
        });
    }
});

module.exports = router;