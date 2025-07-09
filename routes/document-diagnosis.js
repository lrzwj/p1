const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } = require('docx');
require('dotenv').config();

// 引入文档内容提取工具
const { extractTextFromFile } = require('../utils/fileUtils');
// 引入AnalysisService
const AnalysisService = require('../services/AnalysisService');

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, `${timestamp}-${originalName}`);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件格式'), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
});

// 文档诊断API - 使用统一的上传配置
router.post('/diagnose-documents', upload.array('documents', 20), async (req, res) => {
    try {
        const { standard, diagnosisDepth } = req.body;
        const files = req.files;
        
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请上传至少一个文档文件'
            });
        }
        
        // 分析上传的文档
        const documentAnalysis = await analyzeUploadedDocuments(files);
        
        // 根据标准和行业进行缺失诊断
        const diagnosisResult = await performDocumentDiagnosis({
            documentAnalysis,
            standard,
            diagnosisDepth,
            industry: req.body.industry || '通用',
            businessDescription: req.body.businessDescription || ''
        });
        
        res.json({
            success: true,
            data: {
                uploadedDocuments: documentAnalysis.documents,
                completeness: diagnosisResult.completeness,
                healthScore: diagnosisResult.healthScore,
                missingDocuments: diagnosisResult.missingDocuments,
                // 添加现有文档分析结果
                existingDocumentAnalysis: diagnosisResult.existingDocumentAnalysis || [],
                recommendations: diagnosisResult.recommendations
            },
            message: '文档诊断完成'
        });
        
    } catch (error) {
        console.error('文档诊断失败:', error);
        res.status(500).json({
            success: false,
            message: '文档诊断失败',
            error: error.message
        });
    }
});

// 生成诊断报告API
router.post('/generate-diagnosis-report', async (req, res) => {
    try {
        const { diagnosisData } = req.body;
        
        if (!diagnosisData) {
            return res.status(400).json({
                success: false,
                message: '缺少诊断数据'
            });
        }
        
        // 生成Word格式的诊断报告
        const reportBuffer = await generateDiagnosisReport(diagnosisData);
        
        // 设置响应头
        const timestamp = Date.now();
        const filename = `文档体系缺失分析报告_${timestamp}.docx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Content-Length', reportBuffer.length);
        
        // 保存到downloads目录
        const downloadsDir = 'downloads';
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(downloadsDir, filename), reportBuffer);
        
        res.send(reportBuffer);
        
    } catch (error) {
        console.error('报告生成失败:', error);
        res.status(500).json({
            success: false,
            message: '报告生成失败',
            error: error.message
        });
    }
});

// 分析上传的文档（AI驱动版本）
async function analyzeUploadedDocuments(files) {
    const documents = [];
    
    for (const file of files) {
        try {
            const docInfo = {
                name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
                type: getDocumentType(file.originalname),
                size: file.size,
                path: file.path,
                uploadTime: new Date()
            };
            
            // 提取文档内容
            const content = await extractTextFromFile(file.path);
            docInfo.content = content;
            docInfo.contentPreview = content.substring(0, 1000) + (content.length > 1000 ? '...' : '');
            
            // 使用AI分析文档内容和结构
            if (content.trim().length > 50) {
                try {
                    const aiAnalysis = await analyzeDocumentWithAI(content, docInfo.name);
                    docInfo.aiAnalysis = aiAnalysis;
                } catch (aiError) {
                    console.warn(`AI分析失败 ${docInfo.name}:`, aiError.message);
                    docInfo.aiAnalysis = {
                        documentType: 'unknown',
                        mainSections: [],
                        keyTopics: [],
                        completeness: 'unknown',
                        suggestions: []
                    };
                }
            }
            
            documents.push(docInfo);
        } catch (error) {
            console.error(`分析文档 ${file.originalname} 失败:`, error);
        }
    }
    
    return {
        documents,
        totalCount: documents.length,
        analysisTime: new Date()
    };
}

// AI驱动的文档内容分析
async function analyzeDocumentWithAI(content, fileName) {
    const prompt = `
请分析以下文档内容，并以JSON格式返回分析结果：

文档名称：${fileName}
文档内容：
${content.substring(0, 3000)}${content.length > 3000 ? '\n...（内容已截断）' : ''}

请分析并返回以下信息：
1. 文档类型分类（如：管理制度、操作规程、工作流程、质量标准、安全规范等）
2. 主要章节结构
3. 关键主题和内容要点
4. 文档完整性评估
5. 改进建议

返回格式（严格JSON）：
{
  "documentType": "文档类型",
  "category": "具体分类",
  "mainSections": ["章节1", "章节2", "章节3"],
  "keyTopics": ["主题1", "主题2", "主题3"],
  "completeness": {
    "score": 数字(0-100),
    "level": "完整/基本完整/不完整",
    "missingElements": ["缺失要素1", "缺失要素2"]
  },
  "contentQuality": {
    "clarity": "清晰/一般/模糊",
    "structure": "良好/一般/混乱",
    "coverage": "全面/基本/不足"
  },
  "suggestions": ["建议1", "建议2", "建议3"]
}
`;
    
    try {
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const content = response.data.choices[0].message.content;
        const cleanedContent = content.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanedContent);
        
    } catch (error) {
        console.error('AI文档分析失败:', error);
        throw error;
    }
}

// 执行文档诊断（AI驱动版本）
async function performDocumentDiagnosis({ documentAnalysis, standard, diagnosisDepth, industry, businessDescription }) {
    // 创建AnalysisService实例
    const analysisService = new AnalysisService();
    
    // 从知识图谱获取相关知识（作为参考）
    let relevantKnowledge;
    if (businessDescription && businessDescription.trim()) {
        // 使用模糊匹配方法
        const fuzzyResult = await analysisService.queryKnowledgeGraphFuzzy(industry, standard, businessDescription);
        // 转换格式以兼容现有代码
        relevantKnowledge = {
            standards: fuzzyResult.matchedStandards || [],
            practices: fuzzyResult.matchedEnterprises || [], // 将企业信息作为实践参考
            documentTypes: fuzzyResult.documentFrameworks || []
        };
    } else {
        // 使用原有方法，需要转换数据结构
        const originalResult = await analysisService.queryRelevantKnowledge(industry, standard);
        relevantKnowledge = {
            standards: originalResult.standards || [],
            practices: originalResult.industryEnterprises || [], // 映射企业信息为实践
            documentTypes: originalResult.commonDocumentCategories || [] // 映射文档分类为文档类型
        };
    }
    
    const documentKnowledge = await analysisService.queryDocumentKnowledge(industry, standard, {});
    const documentRelations = await analysisService.queryDocumentRelations(standard);
    
    // 修复统计信息
    const knowledgeStats = {
        standardsCount: (relevantKnowledge.standards || []).length,
        practicesCount: (relevantKnowledge.practices || []).length,
        documentTypesCount: (relevantKnowledge.documentTypes || []).length,
        existingDocsCount: (documentKnowledge.existingDocs || []).length,
        relationsCount: (documentRelations || []).length
    };
    
    // 构建AI分析的文档信息
    const aiAnalyzedDocuments = documentAnalysis.documents.map(doc => {
        return {
            name: doc.name,
            type: doc.type,
            aiAnalysis: doc.aiAnalysis || {},
            contentPreview: doc.contentPreview || ''
        };
    });
    
    // 构建知识图谱数据
    const knowledgeGraphData = {
        relevantKnowledge,
        documentKnowledge,
        documentRelations,
        statistics: knowledgeStats
    };
    
    // 在performDocumentDiagnosis函数中修改prompt构建逻辑
    // 根据诊断深度构建不同的分析要求
    let depthSpecificRequirements = '';
    let depthSpecificJsonFormat = '';
    
    switch(diagnosisDepth) {
        case 'basic':
            depthSpecificRequirements = `
    **基础诊断模式 - 重点关注：**
    - 仅进行文档完整度计算和基本缺失识别
    - 简化的文档质量评估（仅给出总体评分）
    - 列出最关键的缺失文档（优先级为"高"的文档）
    - 提供3-5条核心改进建议
    `;
            depthSpecificJsonFormat = `
      "existingDocumentAnalysis": [
        {
          "documentName": "文档名称",
          "currentQuality": {
            "score": 数字,
            "summary": "简要质量评估"
          }
        }
      ],
      "missingDocuments": [仅返回优先级为"高"的缺失文档],
      "recommendations": [最多5条核心建议]
    `;
            break;
            
        case 'standard':
            depthSpecificRequirements = `
    **标准诊断模式 - 重点关注：**
    - 完整的文档完整度计算和缺失识别
    - 详细的文档质量分析（包含优缺点分析）
    - 识别文档间的基本关联性问题
    - 列出所有缺失文档并按优先级排序
    - 提供分类的改进建议（立即、短期、长期）
    `;
            depthSpecificJsonFormat = `
      "existingDocumentAnalysis": [
        {
          "documentName": "文档名称",
          "currentQuality": {
            "score": 数字,
            "strengths": ["优点1", "优点2"],
            "weaknesses": ["不足1", "不足2"]
          },
          "improvementSuggestions": ["改进建议1", "改进建议2"]
        }
      ],
      "missingDocuments": [完整的缺失文档列表],
      "recommendations": [分类的详细建议]
    `;
            break;
            
        case 'deep':
            depthSpecificRequirements = `
    **深度诊断模式 - 重点关注：**
    - 完整的文档完整度计算和缺失识别
    - 深度的文档质量分析（包含缺失内容要素分析）
    - 深入分析文档间的逻辑关系和一致性
    - 结合知识图谱进行行业最佳实践对比
    - 提供详细的文档改进路径和实施建议
    - 分析文档体系的系统性风险和改进优先级
    `;
            depthSpecificJsonFormat = `
      "existingDocumentAnalysis": [
        {
          "documentName": "文档名称",
          "currentQuality": {
            "score": 数字,
            "strengths": ["优点1", "优点2"],
            "weaknesses": ["不足1", "不足2"]
          },
          "missingContent": [
            {
              "element": "缺失要素",
              "description": "详细描述",
              "priority": "高/中/低",
              "impact": "影响说明"
            }
          ],
          "improvementSuggestions": ["改进建议1", "改进建议2"],
          "relationshipAnalysis": "与其他文档的关联性分析"
        }
      ],
      "systemicRisks": [
        {
          "risk": "系统性风险描述",
          "impact": "影响评估",
          "mitigation": "缓解措施"
        }
      ],
      "industryComparison": {
        "benchmarkScore": 数字,
        "gapAnalysis": "与行业最佳实践的差距分析",
        "bestPractices": ["行业最佳实践建议"]
      }
    `;
            break;
            
        default:
            depthSpecificRequirements = depthSpecificRequirements; // 使用标准模式
            depthSpecificJsonFormat = depthSpecificJsonFormat;
    }
    
    const prompt = `
    你是一位拥有15年质量管理体系咨询经验的高级专家，精通ISO 9001、ISO 14001、ISO 45001等国际标准，擅长为不同行业企业设计和优化文档内容与体系。请基于以下信息进行文档体系诊断：
    
    **重要提醒：请严格按照${standard}标准的要求进行评估！**
    
    已上传文档的AI分析结果：
    ${JSON.stringify(aiAnalyzedDocuments, null, 2)}
    
    诊断参数：
    - 参照标准：${standard}
    - 诊断深度：${diagnosisDepth}
    - 行业类型：${industry}
    - 业务描述：${businessDescription}
    - 上传文档数量：${aiAnalyzedDocuments.length}
    
    ${diagnosisDepth === 'deep' ? `知识图谱参考信息：\n${JSON.stringify(knowledgeGraphData, null, 2)}` : ''}
    
    ${depthSpecificRequirements}
    
    **通用评估要求：**
    1. **文档体系完整性评估**
       - 根据${standard}标准确定必需文档总数
       - **完整度 = (${aiAnalyzedDocuments.length} / 必需文档总数) × 100%**
       - 严格按照公式计算，不考虑文档质量因素
    
    2. **现有文档质量分析**
       - 根据诊断深度进行相应级别的质量分析
    
    3. **缺失文档识别**
       - 识别缺失文档并按重要性排序
    
    4. **健康度评估**
       - 基于文档质量、内容完整性等因素评估
    
    请严格按照以下JSON格式返回诊断结果：
    {
      "completeness": {
        "percentage": 数字,
        "level": "优秀/良好/一般/较差",
        "description": "完整度描述",
        "calculation": "计算过程：${aiAnalyzedDocuments.length}/必需文档总数×100%",
        "requiredDocumentsCount": 数字,
        "uploadedDocumentsCount": ${aiAnalyzedDocuments.length},
        "requiredDocuments": ["标准要求的必需文档清单"],
        "uploadedDocuments": ["已上传的文档名称"]
      },
      "healthScore": {
        "score": 数字(0-100),
        "factors": [
          {
            "name": "评估因子",
            "score": 数字,
            "description": "因子描述"
          }
        ]
      },
      "existingDocumentAnalysis": [
        {
          "documentName": "文档名称",
          "currentQuality": {
            "score": 数字,
            "strengths": ["优点1", "优点2"],
            "weaknesses": ["不足1", "不足2"]
          },
          "missingContent": [
            {
              "element": "缺失要素",
              "description": "详细描述",
              "priority": "高/中/低",
              "impact": "影响说明"
            }
          ],
          "improvementSuggestions": ["改进建议1", "改进建议2"]
        }
      ],
      "missingDocuments": [
        {
          "category": "文档分类",
          "name": "缺失文档名称",
          "priority": "高/中/低",
          "reason": "缺失原因",
          "impact": "影响描述",
          "description": "文档内容说明"
        }
      ],
      "recommendations": [
        {
          "type": "immediate/short_term/long_term",
          "title": "建议标题",
          "actions": ["具体行动"]
        }
      ]
    }
    `;
    
    try {
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const content = response.data.choices[0].message.content;
        console.log('AI返回的原始内容:', content);
        const result = JSON.parse(content.replace(/```json|```/g, '').trim());
        
        // 修复知识图谱使用统计
        if (!result.knowledgeGraphUsage) {
            const totalReferencedItems = knowledgeStats.standardsCount + knowledgeStats.practicesCount + knowledgeStats.documentTypesCount + knowledgeStats.existingDocsCount;
            result.knowledgeGraphUsage = {
                usedForAnalysis: totalReferencedItems > 0,
                referencedItems: totalReferencedItems,
                confidence: totalReferencedItems > 10 ? '高' : (totalReferencedItems > 5 ? '中' : '低')
            };
        }
        
        return result;
    } catch (error) {
        console.error('AI诊断失败:', error);
        // 返回基于简单公式的默认诊断结果
        const uploadedCount = aiAnalyzedDocuments.length;
        const estimatedRequiredCount = 20; // ISO9001大约需要20个必需文档
        const percentage = Math.round((uploadedCount / estimatedRequiredCount) * 100);
        
        return {
            completeness: {
                percentage: percentage,
                level: percentage >= 80 ? "优秀" : percentage >= 60 ? "良好" : percentage >= 40 ? "一般" : "较差",
                description: `基于简单公式计算：${uploadedCount}/${estimatedRequiredCount} = ${percentage}%`,
                calculation: `${uploadedCount}/${estimatedRequiredCount}×100% = ${percentage}%`,
                requiredDocumentsCount: estimatedRequiredCount,
                uploadedDocumentsCount: uploadedCount,
                requiredDocuments: ["质量手册", "程序文件", "作业指导书", "记录表单"],
                uploadedDocuments: aiAnalyzedDocuments.map(doc => doc.fileName || '未知文档')
            },
            healthScore: {
                score: Math.min(70, uploadedCount * 10),
                factors: [
                    {
                        name: "文档数量",
                        score: Math.min(80, uploadedCount * 15),
                        description: `已上传${uploadedCount}个文档`
                    }
                ]
            },
            missingDocuments: [
                {
                    category: "核心文档",
                    name: "质量手册",
                    priority: "高",
                    reason: "质量管理体系的核心文档",
                    impact: "无法建立完整的质量管理体系",
                    description: "描述组织质量管理体系的核心文档"
                }
            ],
            recommendations: [
                {
                    type: "immediate",
                    title: "补充缺失文档",
                    actions: [`还需要补充${estimatedRequiredCount - uploadedCount}个文档`]
                }
            ],
            knowledgeGraphUsage: {
                usedForAnalysis: false,
                referencedItems: 0,
                confidence: "低"
            }
        };
    }
}

// 生成诊断报告
async function generateDiagnosisReport(diagnosisData) {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // 报告标题
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "企业文档体系缺失诊断报告",
                            bold: true,
                            size: 32
                        })
                    ],
                    heading: HeadingLevel.TITLE,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                }),
                
                // 生成时间
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `生成时间：${new Date().toLocaleString('zh-CN')}`,
                            italics: true,
                            size: 20
                        })
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 600 }
                }),
                
                // 诊断概要
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "一、诊断概要",
                            bold: true,
                            size: 24
                        })
                    ],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 }
                }),
                
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `文档体系完整度：${diagnosisData.completeness?.percentage || 0}% (${diagnosisData.completeness?.level || '未知'})`,
                            size: 22
                        })
                    ],
                    spacing: { after: 100 }
                }),
                
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `文档健康度评分：${diagnosisData.healthScore?.score || 0}分`,
                            size: 22
                        })
                    ],
                    spacing: { after: 200 }
                }),
                
                // 缺失文档列表
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "二、缺失文档清单",
                            bold: true,
                            size: 24
                        })
                    ],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 }
                }),
                
                // 缺失文档表格
                ...(diagnosisData.missingDocuments || []).map((doc, index) => 
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${index + 1}. ${doc.name} (${doc.category})`,
                                size: 20,
                                bold: true
                            })
                        ],
                        spacing: { after: 100 }
                    })
                ),
                
                // 改进建议
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "三、改进建议",
                            bold: true,
                            size: 24
                        })
                    ],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 }
                }),
                
                ...(diagnosisData.recommendations || []).flatMap(rec => [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: rec.title,
                                bold: true,
                                size: 22
                            })
                        ],
                        spacing: { after: 100 }
                    }),
                    ...(rec.actions || []).map(action => 
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `• ${action}`,
                                    size: 20
                                })
                            ],
                            indent: { left: 400 },
                            spacing: { after: 50 }
                        })
                    )
                ])
            ]
        }]
    });
    
    return await Packer.toBuffer(doc);
}

// 获取文档类型
function getDocumentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const typeMap = {
        '.pdf': 'PDF文档',
        '.doc': 'Word文档',
        '.docx': 'Word文档',
        '.xls': 'Excel表格',
        '.xlsx': 'Excel表格',
        '.ppt': 'PowerPoint演示',
        '.pptx': 'PowerPoint演示',
        '.txt': '文本文档'
    };
    return typeMap[ext] || '未知类型';
}

module.exports = router;

// 新增：文档AI修改API
router.post('/document-ai-modify', async (req, res) => {
    try {
        const { documentData, userRequest, conversationHistory } = req.body;
        
        if (!documentData || !userRequest) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        
        // 设置SSE响应头
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        
        // 构建AI修改prompt
        const prompt = buildDocumentModificationPrompt(documentData, userRequest, conversationHistory);
        
        // 调用DeepSeek API进行流式响应
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [{
                role: "user",
                content: prompt
            }],
            temperature: 0.7,
            max_tokens: 2000,
            stream: true
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            responseType: 'stream'
        });
        
        // 处理流式响应
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        res.write('data: [DONE]\n\n');
                        res.end();
                        return;
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices && parsed.choices[0].delta.content) {
                            res.write(`data: ${JSON.stringify({ content: parsed.choices[0].delta.content })}\n\n`);
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        });
        
        response.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
        });
        
        response.data.on('error', (error) => {
            console.error('Stream error:', error);
            res.write(`data: ${JSON.stringify({ error: '处理过程中出现错误' })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        console.error('文档AI修改失败:', error);
        res.status(500).json({ error: '文档修改服务暂时不可用' });
    }
});

// 构建文档修改prompt的辅助函数
function buildDocumentModificationPrompt(documentData, userRequest, conversationHistory) {
    const { documentName, originalContent, analysisResult } = documentData;
    
    let prompt = `你是一位拥有15年质量管理体系咨询经验的高级专家，精通ISO 9001、ISO 14001、ISO 45001等国际标准，擅长为不同行业企业设计和优化文档内容和体系。请根据用户的需求，对以下文档进行智能修改和改进。

文档名称：${documentName}

原文档内容：
${originalContent}

文档分析结果：
${JSON.stringify(analysisResult, null, 2)}

用户修改需求：${userRequest}

`;
    
    // 添加对话历史
    if (conversationHistory && conversationHistory.length > 0) {
        prompt += `\n对话历史：\n`;
        conversationHistory.forEach(msg => {
            prompt += `${msg.role === 'user' ? '用户' : 'AI'}：${msg.content}\n`;
        });
    }
    
    prompt += `\n请根据以上信息，提供专业的文档修改建议。请注意：
1. 保持文档的专业性和规范性
2. 根据质量管理体系要求进行改进
3. 提供具体、可操作的修改建议
4. 如果需要，可以提供修改后的文档片段
5. 解释修改的理由和预期效果

请以友好、专业的语气回复，就像在与用户进行一对一的咨询对话。`;
    
    return prompt;
}

// 新增：分析文档内容API
router.post('/analyze-document-content', async (req, res) => {
    try {
        const { documentName, originalContent, analysisResult } = req.body;
        
        const prompt = `请分析以下文档内容，提供结构化的分析结果：

文档名称：${documentName}
文档内容：
${originalContent}

请从以下角度分析：
1. 文档结构和章节组织
2. 关键内容要点
3. 发现的问题和不足

请以JSON格式返回：
{
  "structure": ["结构要点1", "结构要点2"],
  "keyPoints": ["关键点1", "关键点2"],
  "issues": ["问题1", "问题2"]
}`;
        
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const content = response.data.choices[0].message.content;
        const result = JSON.parse(content.replace(/```json|```/g, '').trim());
        
        res.json(result);
    } catch (error) {
        console.error('文档内容分析失败:', error);
        res.status(500).json({ error: '文档内容分析失败' });
    }
});

// 新增：自动改进文档API
router.post('/auto-improve-document', async (req, res) => {
    try {
        const { documentData } = req.body;
        
        // 构建自动改进的prompt
        const prompt = buildAutoImprovementPrompt(documentData);
        
        // 设置SSE响应头
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            stream: true
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream'
        });
        
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data !== '[DONE]') {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && parsed.choices[0].delta.content) {
                                res.write(`data: ${JSON.stringify({ content: parsed.choices[0].delta.content })}\n\n`);
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        });
        
        response.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
        });
        
    } catch (error) {
        console.error('自动改进失败:', error);
        res.status(500).json({ error: '自动改进失败' });
    }
});

// 构建自动改进的prompt
function buildAutoImprovementPrompt(documentData) {
    const { documentName, originalContent, improvementSuggestions, missingContent, weaknesses } = documentData;
    
    return `你是一位拥有15年质量管理体系咨询经验的高级专家，精通ISO 9001、ISO 14001、ISO 45001等国际标准，擅长为不同行业企业设计和优化文档内容及体系。请根据诊断结果，对以下文档进行全面改进：

文档名称：${documentName}

原文档内容：
${originalContent}

诊断发现的问题：
${weaknesses ? weaknesses.map(w => `- ${w}`).join('\n') : '无'}

缺失的内容要素：
${missingContent ? missingContent.map(m => `- ${m.element}: ${m.description}`).join('\n') : '无'}

改进建议：
${improvementSuggestions ? improvementSuggestions.map(s => `- ${s}`).join('\n') : '无'}

请基于以上诊断结果，生成一个改进后的文档版本。要求：
1. 保持原文档的核心内容和结构
2. 补充缺失的内容要素
3. 改进发现的问题
4. 应用所有改进建议
5. 确保文档的专业性和完整性

请直接输出改进后的完整文档内容：`;
}

// 新增：智能生成缺失文档API
router.post('/generate-missing-document', async (req, res) => {
    try {
        const { documentName, description, reason, impact, priority, diagnosisContext } = req.body;
        
        // 构建生成提示词
        const prompt = buildMissingDocumentGenerationPrompt({
            documentName,
            description,
            reason,
            impact,
            priority,
            diagnosisContext
        });
        
        // 正确实例化AnalysisService并调用AI生成文档内容
        const analysisService = new AnalysisService();
        const generatedContent = await analysisService.callDeepSeekAPI(prompt);
        
        // 解析生成结果
        let result;
        try {
            // 尝试解析JSON
            const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                // 如果没有找到JSON，创建默认结构
                result = {
                    content: generatedContent,
                    structure: {
                        sections: ["概述", "目的", "适用范围", "职责", "程序", "记录"],
                        keyPoints: ["关键要求", "操作要点"]
                    },
                    suggestions: ["建议定期审查", "建议培训相关人员"]
                };
            }
        } catch (parseError) {
            console.warn('JSON解析失败，使用默认结构:', parseError);
            result = {
                content: generatedContent,
                structure: {
                    sections: ["概述", "目的", "适用范围", "职责", "程序", "记录"],
                    keyPoints: ["关键要求", "操作要点"]
                },
                suggestions: ["建议定期审查", "建议培训相关人员"]
            };
        }
        
        res.json({
            success: true,
            data: {
                content: result.content,
                structure: result.structure,
                suggestions: result.suggestions
            }
        });
    } catch (error) {
        console.error('缺失文档生成失败:', error);
        res.status(500).json({
            success: false,
            message: '文档生成失败: ' + error.message
        });
    }
});

// 新增：流式生成缺失文档API
router.post('/generate-missing-document-stream', async (req, res) => {
    try {
        // 提取所有参数，包括生成设置
        const { 
            documentName, 
            description, 
            reason, 
            impact, 
            priority, 
            diagnosisContext,
            generationMode,
            contentStyle,
            includeExamples
        } = req.body;
        
        // 构建增强的生成提示词，包含生成设置
        const prompt = buildEnhancedMissingDocumentPrompt({
            documentName,
            description,
            reason,
            impact,
            priority,
            diagnosisContext,
            generationMode,
            contentStyle,
            includeExamples
        });
        
        // 设置SSE响应头
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        
        // 调用DeepSeek API进行流式生成
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            stream: true
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream'
        });
        
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data !== '[DONE]') {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && parsed.choices[0].delta.content) {
                                res.write(`data: ${JSON.stringify({ content: parsed.choices[0].delta.content })}\n\n`);
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        });
        
        response.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
        });
        
        response.data.on('error', (error) => {
            console.error('流式生成错误:', error);
            res.write(`data: ${JSON.stringify({ error: '生成过程中出现错误' })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        console.error('流式文档生成失败:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: '文档生成失败: ' + error.message
        }));
    }
});

// 构建增强的缺失文档生成提示词
function buildEnhancedMissingDocumentPrompt(data) {
    const { 
        documentName, 
        description, 
        reason, 
        impact, 
        priority, 
        diagnosisContext,
        generationMode = 'standard',
        contentStyle = 'formal',
        includeExamples = true
    } = data;
    
    // 根据生成模式调整详细程度
    let detailLevel = '';
    switch(generationMode) {
        case 'detailed':
            detailLevel = '请生成详细完整的文档，包含所有必要的细节和说明。';
            break;
        case 'concise':
            detailLevel = '请生成简洁明了的文档，突出核心要点。';
            break;
        default:
            detailLevel = '请生成标准格式的文档，内容适中。';
    }
    
    // 根据内容风格调整语言风格
    let styleGuide = '';
    switch(contentStyle) {
        case 'practical':
            styleGuide = '语言要实用易懂，注重可操作性。';
            break;
        case 'comprehensive':
            styleGuide = '内容要全面深入，覆盖各个方面。';
            break;
        default:
            styleGuide = '使用正式的商务语言，严谨准确。';
    }
    
    // 是否包含示例
    const exampleRequirement = includeExamples ? 
        '请在适当位置包含具体的示例和案例说明。' : 
        '重点关注规范和要求，无需包含具体示例。';
    
    return `你是一个专业的质量管理文档生成专家。请根据以下信息生成一个完整的${documentName}文档。

**文档基本信息：**
- 文档名称：${documentName}
- 文档描述：${description}
- 缺失原因：${reason}
- 影响评估：${impact}
- 优先级：${priority}

**企业上下文：**
- 参照标准：${diagnosisContext.standard}
- 行业类型：${diagnosisContext.industry}
- 现有文档：${diagnosisContext.existingDocuments.join(', ')}

**生成要求：**
1. 文档内容要符合${diagnosisContext.standard}标准要求
2. 结构清晰，层次分明
3. 内容实用，可操作性强
4. 与现有文档体系保持一致性
5. 包含必要的表格、流程图说明
6. 请以markdown格式输出，便于阅读和编辑
7. ${detailLevel}
8. ${styleGuide}
9. ${exampleRequirement}

请直接生成完整的文档内容，包括：
- 文档标题和版本信息
- 目的和适用范围
- 职责分工
- 具体程序和操作步骤
- 相关表格和记录要求
- 附录和参考文件

开始生成文档内容：`;
}

// 构建缺失文档生成提示词
function buildMissingDocumentGenerationPrompt(data) {
    const { documentName, description, reason, impact, priority, diagnosisContext } = data;
    
    return `你是一个专业的质量管理文档生成专家。请根据以下信息生成一个完整的${documentName}文档。

**文档基本信息：**
- 文档名称：${documentName}
- 文档描述：${description}
- 缺失原因：${reason}
- 影响评估：${impact}
- 优先级：${priority}

**企业上下文：**
- 参照标准：${diagnosisContext.standard}
- 行业类型：${diagnosisContext.industry}
- 现有文档：${diagnosisContext.existingDocuments.join(', ')}

**生成要求：**
1. 文档内容要符合${diagnosisContext.standard}标准要求
2. 结构清晰，层次分明
3. 内容实用，可操作性强
4. 与现有文档体系保持一致性
5. 包含必要的表格、流程图说明

请以JSON格式返回生成结果：
{
  "content": "完整的文档内容（markdown格式）",
  "structure": {
    "sections": ["章节列表"],
    "keyPoints": ["关键要点"]
  },
  "suggestions": ["使用建议"]
}`;
}