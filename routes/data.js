const express = require('express');
const router = express.Router();
const { knowledgeGraph } = require('../config/database');

// 导入示例数据到Neo4j
router.post('/import-sample-data', async (req, res) => {
    try {
        console.log('开始导入示例数据到Neo4j...');
        
        // 更完整的示例数据定义
        const sampleData = {
            standard: {
                nodes: [
                    { id: 'iso9001', label: 'ISO 9001:2015', type: 'Standard' },
                    { id: 'iso14001', label: 'ISO 14001:2015', type: 'Standard' },
                    { id: 'iso45001', label: 'ISO 45001:2018', type: 'Standard' },
                    { id: 'iso27001', label: 'ISO 27001:2013', type: 'Standard' },
                    { id: 'clause1', label: '4.1 组织环境', type: 'Clause' },
                    { id: 'clause2', label: '4.2 相关方需求', type: 'Clause' },
                    { id: 'clause3', label: '8.5 生产和服务提供', type: 'Clause' },
                    { id: 'clause4', label: '9.1 监视和测量', type: 'Clause' },
                    { id: 'clause5', label: '10.1 持续改进', type: 'Clause' }
                ],
                edges: [
                    { source: 'iso9001', target: 'clause1', label: '包含' },
                    { source: 'iso9001', target: 'clause2', label: '包含' },
                    { source: 'iso9001', target: 'clause3', label: '包含' },
                    { source: 'iso14001', target: 'clause1', label: '包含' },
                    { source: 'iso45001', target: 'clause4', label: '包含' },
                    { source: 'iso27001', target: 'clause5', label: '包含' },
                    { source: 'clause1', target: 'clause2', label: '关联' },
                    { source: 'clause3', target: 'clause4', label: '前置' },
                    { source: 'clause4', target: 'clause5', label: '前置' }
                ]
            },
            document: {
                nodes: [
                    { id: 'manual', label: '质量手册', type: 'Document' },
                    { id: 'procedure1', label: '文件控制程序', type: 'Document' },
                    { id: 'procedure2', label: '记录控制程序', type: 'Document' },
                    { id: 'procedure3', label: '内审程序', type: 'Document' },
                    { id: 'instruction1', label: '生产作业指导书', type: 'Document' },
                    { id: 'instruction2', label: '检验作业指导书', type: 'Document' },
                    { id: 'form1', label: '质量记录表', type: 'Document' },
                    { id: 'form2', label: '检验记录表', type: 'Document' },
                    { id: 'form3', label: '培训记录表', type: 'Document' }
                ],
                edges: [
                    { source: 'manual', target: 'procedure1', label: '引用' },
                    { source: 'manual', target: 'procedure2', label: '引用' },
                    { source: 'manual', target: 'procedure3', label: '引用' },
                    { source: 'procedure1', target: 'instruction1', label: '细化' },
                    { source: 'procedure2', target: 'instruction2', label: '细化' },
                    { source: 'instruction1', target: 'form1', label: '生成' },
                    { source: 'instruction2', target: 'form2', label: '生成' },
                    { source: 'procedure3', target: 'form3', label: '生成' }
                ]
            },
            process: {
                nodes: [
                    { id: 'design', label: '设计开发流程', type: 'Process' },
                    { id: 'procurement', label: '采购流程', type: 'Process' },
                    { id: 'production', label: '生产流程', type: 'Process' },
                    { id: 'inspection', label: '检验流程', type: 'Process' },
                    { id: 'delivery', label: '交付流程', type: 'Process' },
                    { id: 'service', label: '售后服务流程', type: 'Process' },
                    { id: 'dept_rd', label: '研发部', type: 'Department' },
                    { id: 'dept_prod', label: '生产部', type: 'Department' },
                    { id: 'dept_qc', label: '质量部', type: 'Department' },
                    { id: 'dept_sales', label: '销售部', type: 'Department' }
                ],
                edges: [
                    { source: 'design', target: 'procurement', label: '前置' },
                    { source: 'procurement', target: 'production', label: '前置' },
                    { source: 'production', target: 'inspection', label: '前置' },
                    { source: 'inspection', target: 'delivery', label: '前置' },
                    { source: 'delivery', target: 'service', label: '前置' },
                    { source: 'dept_rd', target: 'design', label: '负责' },
                    { source: 'dept_prod', target: 'production', label: '负责' },
                    { source: 'dept_qc', target: 'inspection', label: '负责' },
                    { source: 'dept_sales', target: 'delivery', label: '负责' }
                ]
            },
            integrated: {
                nodes: [
                    { id: 'iso9001_int', label: 'ISO 9001:2015', type: 'Standard' },
                    { id: 'manual_int', label: '质量手册', type: 'Document' },
                    { id: 'design_int', label: '设计开发', type: 'Process' },
                    { id: 'production_int', label: '生产制造', type: 'Process' },
                    { id: 'quality_dept_int', label: '质量部', type: 'Department' },
                    { id: 'product_a', label: '产品A', type: 'Product' },
                    { id: 'product_b', label: '产品B', type: 'Product' },
                    { id: 'customer_a', label: '客户A', type: 'Customer' },
                    { id: 'supplier_a', label: '供应商A', type: 'Supplier' }
                ],
                edges: [
                    { source: 'iso9001_int', target: 'manual_int', label: '要求' },
                    { source: 'manual_int', target: 'design_int', label: '规范' },
                    { source: 'design_int', target: 'production_int', label: '输出到' },
                    { source: 'quality_dept_int', target: 'manual_int', label: '维护' },
                    { source: 'production_int', target: 'product_a', label: '生产' },
                    { source: 'production_int', target: 'product_b', label: '生产' },
                    { source: 'product_a', target: 'customer_a', label: '交付给' },
                    { source: 'supplier_a', target: 'production_int', label: '供应给' }
                ]
            }
        };
        
        let totalTriples = [];
        let totalNodes = 0;
        let totalEdges = 0;
        let importDetails = {};
        
        // 处理所有类型的数据
        for (const [dataType, data] of Object.entries(sampleData)) {
            console.log(`处理 ${dataType} 数据...`);
            
            let typeTriples = [];
            
            // 将边转换为三元组格式
            data.edges.forEach(edge => {
                const sourceNode = data.nodes.find(node => node.id === edge.source);
                const targetNode = data.nodes.find(node => node.id === edge.target);
                
                if (sourceNode && targetNode) {
                    const triple = {
                        subject: sourceNode.label,
                        predicate: edge.label,
                        object: targetNode.label,
                        confidence: 0.9,
                        subjectType: sourceNode.type,
                        objectType: targetNode.type,
                        dataType: dataType  // 添加数据类型标识
                    };
                    typeTriples.push(triple);
                    totalTriples.push(triple);
                }
            });
            
            importDetails[dataType] = {
                nodes: data.nodes.length,
                edges: data.edges.length,
                triples: typeTriples.length
            };
            
            totalNodes += data.nodes.length;
            totalEdges += data.edges.length;
        }
        
        console.log(`准备导入 ${totalTriples.length} 个三元组，涵盖 ${Object.keys(sampleData).length} 种图谱类型...`);
        
        if (totalTriples.length === 0) {
            return res.json({
                success: false,
                message: '没有示例数据可导入'
            });
        }
        
        // 将三元组添加到Neo4j数据库
        const result = await knowledgeGraph.addTriplesToGraph(totalTriples);
        console.log('Neo4j导入结果:', result);
        
        res.json({ 
            success: true, 
            message: `成功导入所有类型的示例数据：${result.edgesAdded} 条关系，涉及 ${totalNodes} 个节点`,
            details: {
                totalTriples: totalTriples.length,
                nodesAdded: result.nodesAdded,
                edgesAdded: result.edgesAdded,
                dataTypes: Object.keys(sampleData),
                importDetails: importDetails
            }
        });
    } catch (error) {
        console.error('导入示例数据到Neo4j失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '导入示例数据失败',
            error: error.message 
        });
    }
});

module.exports = router;