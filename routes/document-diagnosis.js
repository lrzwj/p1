const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } = require('docx');
require('dotenv').config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

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

// 文档诊断API
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
            diagnosisDepth
        });
        
        res.json({
            success: true,
            data: {
                uploadedDocuments: documentAnalysis.documents,
                completeness: diagnosisResult.completeness,
                healthScore: diagnosisResult.healthScore,
                missingDocuments: diagnosisResult.missingDocuments,
                contentIssues: diagnosisResult.contentIssues,
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

// 分析上传的文档
async function analyzeUploadedDocuments(files) {
    const documents = [];
    
    for (const file of files) {
        try {
            // 提取文档基本信息
            const docInfo = {
                name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
                type: getDocumentType(file.originalname),
                size: file.size,
                path: file.path,
                uploadTime: new Date()
            };
            
            // 这里可以添加文档内容分析逻辑
            // 例如：提取文档内容、识别文档结构等
            
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

// 执行文档诊断
async function performDocumentDiagnosis({ documentAnalysis, standard, diagnosisDepth }) {
    const prompt = `
你是一位专业的企业文档体系诊断专家。请基于以下信息进行文档体系缺失诊断：

已上传文档信息：
${documentAnalysis.documents.map(doc => `- ${doc.name} (${doc.type})`).join('\n')}

参照标准：${standard}
诊断深度：${diagnosisDepth}

请分析该企业的文档体系现状，识别缺失的关键文档，并提供改进建议。

**返回格式（严格JSON）：**
{
  "completeness": {
    "percentage": 75,
    "level": "良好",
    "description": "文档体系基本完整，但仍有改进空间"
  },
  "healthScore": {
    "score": 82,
    "factors": [
      {
        "name": "文档覆盖度",
        "score": 80,
        "description": "主要业务流程已有文档覆盖"
      }
    ]
  },
  "missingDocuments": [
    {
      "category": "质量管理",
      "name": "质量手册",
      "priority": "高",
      "reason": "ISO 9001标准要求的核心文档",
      "impact": "影响质量管理体系的有效运行"
    }
  ],
  "contentIssues": [
    {
      "document": "现有文档名称",
      "issue": "问题描述",
      "severity": "严重程度",
      "suggestion": "改进建议"
    }
  ],
  "recommendations": [
    {
      "type": "immediate",
      "title": "立即行动建议",
      "actions": ["具体行动项"]
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
        const result = JSON.parse(content.replace(/```json|```/g, '').trim());
        
        return result;
    } catch (error) {
        console.error('AI诊断失败:', error);
        // 返回默认诊断结果
        return {
            completeness: {
                percentage: 60,
                level: "待改进",
                description: "文档体系需要进一步完善"
            },
            healthScore: {
                score: 65,
                factors: [
                    {
                        name: "文档数量",
                        score: 70,
                        description: "已有基础文档"
                    }
                ]
            },
            missingDocuments: [
                {
                    category: "基础管理",
                    name: "组织架构图",
                    priority: "中",
                    reason: "明确组织结构和职责分工",
                    impact: "影响管理效率"
                }
            ],
            contentIssues: [],
            recommendations: [
                {
                    type: "immediate",
                    title: "建议完善基础文档",
                    actions: ["补充缺失的管理制度文档"]
                }
            ]
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