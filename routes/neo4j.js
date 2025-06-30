const express = require('express');
const router = express.Router();
const { knowledgeGraph, driver } = require('../config/database');

// 测试Neo4j写入
router.get('/test-write', async (req, res) => {
    try {
        const session = driver.session();
        
        // 尝试创建一个测试节点
        const result = await session.run(
            'CREATE (n:Test {name: $name, created: datetime()}) RETURN n',
            { name: 'Test Node ' + Date.now() }
        );
        
        const createdNode = result.records[0].get('n');
        
        await session.close();
        
        res.json({
            success: true,
            message: '成功创建测试节点',
            node: {
                id: createdNode.identity.toString(),
                properties: createdNode.properties
            }
        });
    } catch (error) {
        console.error('测试Neo4j写入失败:', error);
        res.status(500).json({
            success: false,
            message: '测试Neo4j写入失败',
            error: error.message
        });
    }
});

// 测试Neo4j连接
router.get('/test-connection', async (req, res) => {
    try {
        const connected = await knowledgeGraph.testConnection();
        if (connected) {
            res.json({
                success: true,
                message: 'Neo4j连接成功'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Neo4j连接失败'
            });
        }
    } catch (error) {
        console.error('测试Neo4j连接失败:', error);
        res.status(500).json({
            success: false,
            message: '测试Neo4j连接失败',
            error: error.message
        });
    }
});

module.exports = router;