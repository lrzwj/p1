const neo4j = require('neo4j-driver');
const Neo4jKnowledgeGraph = require('../models/Neo4jKnowledgeGraph');
require('dotenv').config();

// Neo4j本地数据库配置
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j://127.0.0.1:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '12345678';

// 创建Neo4j驱动实例
const driver = neo4j.driver(
    NEO4J_URI, 
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
);

// 创建知识图谱实例
const knowledgeGraph = new Neo4jKnowledgeGraph(driver);

// 测试数据库连接
async function connectDatabase() {
    try {
        const isConnected = await knowledgeGraph.testConnection();
        if (isConnected) {
            console.log('数据库连接成功');
        } else {
            console.error('数据库连接失败');
        }
        return isConnected;
    } catch (error) {
        console.error('数据库连接错误:', error);
        return false;
    }
}

module.exports = {
    knowledgeGraph,
    driver,
    connectDatabase
};