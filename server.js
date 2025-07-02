const express = require('express');
const { setupServer } = require('./config/server');
const { knowledgeGraph } = require('./config/database');

// 引入路由模块
const knowledgeGraphRoutes = require('./routes/knowledge-graph');
const entitiesRoutes = require('./routes/entities');
const documentsRoutes = require('./routes/documents');
const documentGenerationRoutes = require('./routes/document-generation');
const documentDiagnosisRoutes = require('./routes/document-diagnosis');
const neo4jRoutes = require('./routes/neo4j');
const uploadRoutes = require('./routes/upload');
const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 3000;

// 设置服务器中间件
setupServer(app);

// 注册路由
app.use('/api', knowledgeGraphRoutes);
app.use('/api', entitiesRoutes);
app.use('/api', documentsRoutes);
app.use('/api', documentGenerationRoutes);
app.use('/api', documentDiagnosisRoutes);
app.use('/api/neo4j', neo4jRoutes);
app.use('/api', uploadRoutes);
app.use('/api', dataRoutes);

// 启动服务器
app.listen(PORT, async () => {
    console.log(`服务器运行在端口 ${PORT}`);
    
    // 测试数据库连接
    try {
        await knowledgeGraph.testConnection();
        console.log('Neo4j数据库连接成功');
    } catch (error) {
        console.error('Neo4j数据库连接失败:', error);
    }
});

module.exports = app;
