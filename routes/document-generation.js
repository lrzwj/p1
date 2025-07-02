const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType } = require('docx');
const fs = require('fs');
const path = require('path');

// 业务描述分析API（修改版）
router.post('/analyze-business-description', async (req, res) => {
    try {
        const { description, industry, standard } = req.body;
        
        const AnalysisService = require('../services/AnalysisService');
        const analysisService = new AnalysisService();
        
        // 使用新的分层分析方法
        const layeredResult = await analysisService.analyzeBusinessDescriptionWithLayers(
            description, industry, standard
        );
        
        // 转换数据结构以适配前端显示
        const transformedData = {
            // 保留原始四层结构
            layeredData: layeredResult,
            // 提取前端显示需要的扁平数据
            departments: layeredResult.enterpriseLayer?.departments || [],
            products: layeredResult.enterpriseLayer?.products || [],
            processes: [
                ...(layeredResult.processLayer?.coreProcesses?.map(p => p.name) || []),
                ...(layeredResult.processLayer?.supportProcesses?.map(p => p.name) || [])
            ]
        };
        
        res.json({
            success: true,
            data: transformedData,
            message: '业务分析完成，四层知识图谱已构建'
        });
    } catch (error) {
        console.error('业务分析失败:', error);
        res.status(500).json({
            success: false,
            message: '业务分析失败',
            error: error.message
        });
    }
});

// 文档框架生成API
router.post('/generate-document-framework', async (req, res) => {
    try {
        const { 
            departments = [], 
            products = [], 
            processes = [], 
            industry = '', 
            standard = '' 
        } = req.body;
        
        // 确保数组类型
        const safeDepartments = Array.isArray(departments) ? departments : [];
        const safeProducts = Array.isArray(products) ? products : [];
        const safeProcesses = Array.isArray(processes) ? processes : [];
        
        // 新增：从知识图谱查询相关知识
        const AnalysisService = require('../services/AnalysisService');
        const analysisService = new AnalysisService();
        
        const knowledgeData = await analysisService.queryRelevantKnowledge(industry, standard);
        const similarFrameworks = await analysisService.querySimilarFrameworks(industry, {
            departments: safeDepartments,
            products: safeProducts,
            processes: safeProcesses
        });
        
        // 增强的prompt，包含知识图谱信息
        const prompt = `
你是一位专业的企业文档体系设计专家。请基于以下具体信息和知识图谱数据，为该企业量身定制文档体系框架：

企业信息：
- 部门：${safeDepartments.join(', ') || '未指定'}
- 产品/服务：${safeProducts.join(', ') || '未指定'}
- 核心流程：${safeProcesses.join(', ') || '未指定'}
- 所属行业：${industry || '未指定'}
- 遵循标准：${standard || '未指定'}

知识图谱提供的参考信息：
- 标准要求：${JSON.stringify(knowledgeData.standards)}
- 行业最佳实践：${JSON.stringify(knowledgeData.practices)}
- 推荐文档类型：${JSON.stringify(knowledgeData.documentTypes)}
- 相似企业框架：${JSON.stringify(similarFrameworks)}

**分析要求：**
1. 深入分析企业的部门结构、产品特点和核心流程
2. 结合行业特色和标准要求，识别关键管理领域
3. 为每个管理领域设计3-5个核心文档
4. 文档名称必须体现企业的具体业务特点
5. 确保文档体系覆盖企业运营的关键环节

**返回格式：**
{
  "framework": {
    "categories": [
      {
        "name": "[根据企业部门和业务特点命名的管理体系]",
        "description": "[针对该企业具体情况的体系说明]",
        "documents": [
          {
            "name": "[结合企业产品/服务特点的具体文档名称]",
            "description": "[明确的业务价值和应用场景]"
          }
        ]
      }
    ]
  }
}

**重要提醒：**
- 必须根据企业的实际部门、产品、流程来定制内容
- 避免使用通用化的文档名称
- 每个文档都要有明确的业务针对性
- 严格按照JSON格式返回，不要添加其他内容
`;

        const response = await axios.post(DEEPSEEK_API_URL, {
            // 第145行附近
            model: 'deepseek-chat',  // 从 'deepseek-chat' 改为 'deepseek-reasoner'
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const content = response.data.choices[0].message.content;
        const framework = JSON.parse(content.replace(/```json|```/g, '').trim());
        
        // 新增：将生成的框架保存到知识图谱
        if (framework && framework.framework && framework.framework.categories && Array.isArray(framework.framework.categories)) {
            console.log('保存框架到知识图谱，分类数量:', framework.framework.categories.length);
            await analysisService.saveFrameworkToKnowledgeGraph({
                industry,
                departments: safeDepartments,
                framework: framework.framework,
                timestamp: new Date()
            });
        } else {
            console.warn('框架数据结构不完整，跳过保存到知识图谱:', {
                hasFramework: !!framework,
                hasFrameworkProperty: !!(framework && framework.framework),
                hasCategories: !!(framework && framework.framework && framework.framework.categories),
                categoriesIsArray: !!(framework && framework.framework && framework.framework.categories && Array.isArray(framework.framework.categories))
            });
        }
        
        res.json({
            success: true,
            data: framework,
            knowledgeUsed: {
                standardsCount: knowledgeData.standards.length,
                practicesCount: knowledgeData.practices.length,
                similarFrameworksCount: similarFrameworks.length
            }
        });
    } catch (error) {
        console.error('框架生成失败:', error);
        res.status(500).json({
            success: false,
            message: '框架生成失败',
            error: error.message
        });
    }
});

// 新增：下载DOCX格式的文档框架
router.post('/download-framework-docx', async (req, res) => {
    try {
        const { framework } = req.body;
        
        if (!framework || !framework.categories) {
            return res.status(400).json({
                success: false,
                message: '无效的框架数据'
            });
        }

        // 创建文档
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    // 标题
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "企业文档体系框架",
                                bold: true,
                                size: 32,
                            }),
                        ],
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.CENTER,
                        spacing: {
                            after: 400,
                        },
                    }),
                    
                    // 生成时间
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `生成时间：${new Date().toLocaleString('zh-CN')}`,
                                italics: true,
                                size: 20,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: {
                            after: 600,
                        },
                    }),
                    
                    // 遍历分类
                    ...framework.categories.flatMap(category => {
                        const categoryParagraphs = [
                            // 分类标题
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: category.name,
                                        bold: true,
                                        size: 28,
                                        underline: {
                                            type: UnderlineType.SINGLE,
                                        },
                                    }),
                                ],
                                heading: HeadingLevel.HEADING_1,
                                spacing: {
                                    before: 400,
                                    after: 200,
                                },
                            }),
                        ];
                        
                        // 分类描述
                        if (category.description) {
                            categoryParagraphs.push(
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: category.description,
                                            italics: true,
                                            size: 22,
                                        }),
                                    ],
                                    spacing: {
                                        after: 200,
                                    },
                                })
                            );
                        }
                        
                        // 文档列表
                        if (category.documents && category.documents.length > 0) {
                            category.documents.forEach((doc, index) => {
                                categoryParagraphs.push(
                                    new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: `${index + 1}. ${doc.name}`,
                                                bold: true,
                                                size: 24,
                                            }),
                                        ],
                                        spacing: {
                                            before: 100,
                                            after: 50,
                                        },
                                        indent: {
                                            left: 400,
                                        },
                                    })
                                );
                                
                                if (doc.description) {
                                    categoryParagraphs.push(
                                        new Paragraph({
                                            children: [
                                                new TextRun({
                                                    text: doc.description,
                                                    size: 20,
                                                }),
                                            ],
                                            spacing: {
                                                after: 100,
                                            },
                                            indent: {
                                                left: 600,
                                            },
                                        })
                                    );
                                }
                            });
                        }
                        
                        return categoryParagraphs;
                    }),
                ],
            }],
        });

        // 生成文档缓冲区
        const buffer = await Packer.toBuffer(doc);
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\''+ encodeURIComponent('企业文档体系框架.docx'));
        res.setHeader('Content-Length', buffer.length);
        
        // 发送文件
        res.send(buffer);
        
    } catch (error) {
        console.error('DOCX生成失败:', error);
        res.status(500).json({
            success: false,
            message: 'DOCX生成失败',
            error: error.message
        });
    }
});
module.exports = router;