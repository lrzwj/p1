const neo4j = require('neo4j-driver');

// 知识图谱Neo4j服务类
class Neo4jKnowledgeGraph {
    constructor(driver) {
        this.driver = driver;
    }

    // 测试数据库连接
    async testConnection() {
        const session = this.driver.session();
        try {
            const result = await session.run('RETURN "Hello Neo4j!" as message');
            console.log('Neo4j连接成功:', result.records[0].get('message'));
            return true;
        } catch (error) {
            console.error('Neo4j连接失败:', error);
            return false;
        } finally {
            await session.close();
        }
    }

    // 添加三元组到图数据库
    async addTriplesToGraph(triples) {
        const session = this.driver.session();
        let nodesAdded = 0;
        let edgesAdded = 0;
        
        try {
            for (const triple of triples) {
                // 使用正确的类型字段名
                const { subject, predicate, object, subjectType = 'Entity', objectType = 'Entity' } = triple;
                
                // 创建或更新节点和关系
                const query = `
                    MERGE (s:${subjectType} {name: $subject})
                    MERGE (o:${objectType} {name: $object})
                    MERGE (s)-[r:${predicate.replace(/[^a-zA-Z0-9_]/g, '_')}]->(o)
                    RETURN s, r, o
                `;
                
                const result = await session.run(query, {
                    subject: subject,
                    object: object
                });
                
                if (result.records.length > 0) {
                    edgesAdded++;
                }
            }
            
            return { nodesAdded, edgesAdded };
        } catch (error) {
            console.error('添加三元组到Neo4j失败:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    // 获取知识图谱数据 - 按层次结构组织
    async getKnowledgeGraph(layer = 'all') {
        const session = this.driver.session();
        try {
            let query;
            
            switch (layer) {
                case 'standard':
                    // 标准层：显示标准和条款
                    query = `
                        MATCH (n)
                        WHERE n:Standard OR n:Clause
                        OPTIONAL MATCH (n)-[r]->(m)
                        WHERE m:Standard OR m:Clause
                        RETURN n, r, m
                        LIMIT 100
                    `;
                    break;
                case 'enterprise':
                    // 企业层：显示企业和部门
                    query = `
                        MATCH (n)
                        WHERE n:Enterprise OR n:Department
                        OPTIONAL MATCH (n)-[r]->(m)
                        WHERE m:Enterprise OR m:Department OR m:DocumentFramework
                        RETURN n, r, m
                        LIMIT 100
                    `;
                    break;
                case 'process':
                    // 流程层：显示所有流程节点，包括孤立节点
                    query = `
                        MATCH (n)
                        WHERE n:Process OR n:Product OR n:Customer OR n:Supplier
                        OPTIONAL MATCH (n)-[r]-(m)
                        WHERE m:Process OR m:Product OR m:Customer OR m:Supplier OR m:Department OR m:Enterprise
                        RETURN n, r, m
                        UNION
                        MATCH (n)
                        WHERE n:Process
                        RETURN n, null as r, null as m
                        LIMIT 100
                    `;
                    break;
                case 'document':
                    // 文档层：显示文档框架、类别和具体文档
                    query = `
                        MATCH (n)
                        WHERE n:DocumentFramework OR n:DocumentCategory OR n:Document
                        OPTIONAL MATCH (n)-[r]->(m)
                        WHERE m:DocumentFramework OR m:DocumentCategory OR m:Document
                        RETURN n, r, m
                        LIMIT 100
                    `;
                    break;
                case 'complete':
                    // 完整视图：显示所有层次的关联关系
                    query = `
                        MATCH (n)-[r]->(m)
                        RETURN n, r, m
                        LIMIT 200
                    `;
                    break;
                default:
                    query = 'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100';
            }
            
            const result = await session.run(query);
            
            const nodes = new Map();
            const edges = [];
            
            result.records.forEach(record => {
                const sourceNode = record.get('n');
                const relationship = record.get('r');
                const targetNode = record.get('m');
                
                if (sourceNode) {
                    // 添加源节点
                    if (!nodes.has(sourceNode.identity.toString())) {
                        nodes.set(sourceNode.identity.toString(), {
                            id: sourceNode.identity.toString(),
                            label: sourceNode.properties.name || sourceNode.properties.industry || 'Unknown',
                            type: this.getNodeLayer(sourceNode.labels[0] || 'Entity')
                        });
                    }
                }
                
                if (targetNode) {
                    // 添加目标节点
                    if (!nodes.has(targetNode.identity.toString())) {
                        nodes.set(targetNode.identity.toString(), {
                            id: targetNode.identity.toString(),
                            label: targetNode.properties.name || targetNode.properties.industry || 'Unknown',
                            type: this.getNodeLayer(targetNode.labels[0] || 'Entity')
                        });
                    }
                }
                
                if (relationship && sourceNode && targetNode) {
                    // 添加边
                    edges.push({
                        source: sourceNode.identity.toString(),
                        target: targetNode.identity.toString(),
                        label: relationship.type,
                        type: relationship.type
                    });
                }
            });
            
            return {
                nodes: Array.from(nodes.values()),
                edges: edges
            };
        } catch (error) {
            console.error('获取知识图谱数据失败:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    // 新增：根据节点类型确定所属层次
    getNodeLayer(nodeType) {
        const layerMapping = {
            'Standard': 'standard',
            'Clause': 'standard',
            'Enterprise': 'enterprise', 
            'Department': 'enterprise',
            'Process': 'process',
            'Product': 'process',
            'Customer': 'process',
            'Supplier': 'process',
            'DocumentFramework': 'document',
            'DocumentCategory': 'document',
            'Document': 'document'
        };
        return layerMapping[nodeType] || 'unknown';
    }

    // 搜索实体
    async searchEntities(query, limit = 10) {
        const session = this.driver.session();
        try {
            const cypherQuery = `
                MATCH (n)
                WHERE toLower(n.name) CONTAINS toLower($query)
                RETURN n
                LIMIT $limit
            `;
            
            const result = await session.run(cypherQuery, { query, limit });
            
            return result.records.map(record => {
                const node = record.get('n');
                return {
                    id: node.identity.toString(),
                    name: node.properties.name,
                    type: node.labels[0] || 'Entity',
                    properties: node.properties
                };
            });
        } catch (error) {
            console.error('搜索实体失败:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    // 关闭连接
    async close() {
        await this.driver.close();
    }
}

module.exports = Neo4jKnowledgeGraph;