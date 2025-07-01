const express = require('express'); // 添加这行
const { setupServer } = require('./config/server');
const { knowledgeGraph } = require('./config/database');

// 引入路由模块
const knowledgeGraphRoutes = require('./routes/knowledge-graph');
const entitiesRoutes = require('./routes/entities');
const documentsRoutes = require('./routes/documents');
const documentGenerationRoutes = require('./routes/document-generation');
const neo4jRoutes = require('./routes/neo4j');
const uploadRoutes = require('./routes/upload');
const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 3000;

// 设置服务器中间件
setupServer(app);

// 注册路由
app.use('/api/knowledge-graph', knowledgeGraphRoutes);
app.use('/api/entities', entitiesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/document-generation', documentGenerationRoutes);
app.use('/api/neo4j', neo4jRoutes);
app.use('/api/upload', uploadRoutes); // 修改为具体路径
app.use('/api/data', dataRoutes);

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