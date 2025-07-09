const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType } = require('docx');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// 在文件顶部添加智能Markdown解析函数
const marked = require('marked');
const { JSDOM } = require('jsdom');

// 替换parseMarkdownToDocxElements函数
function parseMarkdownToDocxElements(markdown) {
    if (!markdown) return [];
    
    try {
        // 配置marked选项
        marked.setOptions({
            breaks: true,
            gfm: true,
            sanitize: false
        });
        
        // 转换markdown为HTML
        const html = marked.parse(markdown);
        
        // 使用JSDOM解析HTML
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        const elements = [];
        
        // 遍历所有子节点
        const walker = document.createTreeWalker(
            document.body,
            dom.window.NodeFilter.SHOW_ELEMENT | dom.window.NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
                elements.push(...convertElementToDocx(node));
            }
        }
        
        return elements;
    } catch (error) {
        console.error('Markdown转DOCX错误:', error);
        // 降级到原有处理方式
        return parseMarkdownToDocxElementsLegacy(markdown);
    }
}

// 新增：将HTML元素转换为DOCX元素
function convertElementToDocx(element) {
    const elements = [];
    const tagName = element.tagName.toLowerCase();
    const textContent = element.textContent.trim();
    
    if (!textContent) return elements;
    
    switch (tagName) {
        case 'h1':
            elements.push(new Paragraph({
                children: [new TextRun({
                    text: textContent,
                    bold: true,
                    size: 36,
                    color: '1F4E79'
                })],
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 600, after: 400 },
                border: {
                    bottom: {
                        color: '1F4E79',
                        space: 1,
                        value: 'single',
                        size: 6
                    }
                }
            }));
            break;
            
        case 'h2':
            elements.push(new Paragraph({
                children: [new TextRun({
                    text: textContent,
                    bold: true,
                    size: 32,
                    color: '2F5496',
                    underline: { type: UnderlineType.SINGLE }
                })],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 500, after: 300 }
            }));
            break;
            
        case 'h3':
            elements.push(new Paragraph({
                children: [new TextRun({
                    text: textContent,
                    bold: true,
                    size: 28,
                    color: '5B9BD5'
                })],
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 400, after: 250 },
                indent: { left: 200 }
            }));
            break;
            
        case 'h4':
            elements.push(new Paragraph({
                children: [new TextRun({
                    text: textContent,
                    bold: true,
                    size: 26,
                    color: '70AD47'
                })],
                heading: HeadingLevel.HEADING_4,
                spacing: { before: 300, after: 200 },
                indent: { left: 400 }
            }));
            break;
            
        case 'p':
            elements.push(new Paragraph({
                children: [new TextRun({
                    text: textContent,
                    size: 24
                })],
                spacing: { after: 150 }
            }));
            break;
            
        case 'li':
            elements.push(new Paragraph({
                children: [
                    new TextRun({ text: '• ', size: 24 }),
                    new TextRun({ text: textContent, size: 24 })
                ],
                spacing: { after: 100 },
                indent: { left: 400 }
            }));
            break;
            
        case 'code':
            elements.push(new Paragraph({
                children: [new TextRun({
                    text: textContent,
                    font: 'Courier New',
                    size: 20,
                    color: 'D63384'
                })],
                spacing: { after: 100 }
            }));
            break;
            
        case 'pre':
            elements.push(new Paragraph({
                children: [new TextRun({
                    text: textContent,
                    font: 'Courier New',
                    size: 20
                })],
                spacing: { after: 200 },
                border: {
                    left: {
                        color: '667eea',
                        space: 1,
                        value: 'single',
                        size: 12
                    }
                },
                shading: {
                    fill: 'F8F9FA'
                }
            }));
            break;
            
        default:
            if (textContent) {
                elements.push(new Paragraph({
                    children: [new TextRun({
                        text: textContent,
                        size: 24
                    })],
                    spacing: { after: 150 }
                }));
            }
    }
    
    return elements;
}

// 保留原有函数作为降级方案
function parseMarkdownToDocxElementsLegacy(markdown) {
    // ... 原有的parseMarkdownToDocxElements实现
}

// 修改：处理行内格式（更彻底的清理）
function processInlineFormatting(text) {
    const elements = [];
    
    // 先彻底清理所有Markdown符号
    const cleanText = cleanAllMarkdownSymbols(text);
    
    if (cleanText) {
        elements.push(new TextRun({ text: cleanText, size: 24 }));
    }
    
    return elements;
}

// Markdown转换函数
function markdownToPlainText(markdown) {
    if (!markdown) return '';
    
    let text = markdown
        // 移除标题符号
        .replace(/^#{1,6}\s+/gm, '')
        // 移除粗体和斜体符号
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        // 移除代码块
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        // 移除列表符号
        .replace(/^[*+-]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        // 移除链接格式
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // 移除其他Markdown符号
        .replace(/[_~`]/g, '')
        // 清理多余的空行
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    
    return text;
}

// 业务描述分析API（修改版）
router.post('/analyze-business-description', async (req, res) => {
    try {
        const { description, industry, industryCategory, standard } = req.body;
        
        const AnalysisService = require('../services/AnalysisService');
        const analysisService = new AnalysisService();
        
        // 使用新的分层分析方法
        const layeredResult = await analysisService.analyzeBusinessDescriptionWithLayers(
            description, industry, industryCategory, standard
        );
        
        // 转换数据结构以适配前端显示
        const transformedData = {
            // 保留原始五层结构
            layeredData: layeredResult,
            // 提取前端显示需要的扁平数据
            departments: layeredResult.enterpriseLayer?.departments || [],
            products: layeredResult.enterpriseLayer?.products || [],
            processes: [
                ...(layeredResult.processLayer?.coreProcesses?.map(p => p.name) || []),
                ...(layeredResult.processLayer?.supportProcesses?.map(p => p.name) || [])
            ],
            // 新增：返回企业信息供框架生成使用
            enterpriseInfo: layeredResult.enterpriseInfo
        };
        
        res.json({
            success: true,
            data: transformedData,
            message: '业务分析完成，五层知识图谱已构建'
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
            standard = '',
            businessDescription = '', // 新增：业务描述参数
            enterpriseInfo = null
        } = req.body;
        
        // 确保数组类型
        const safeDepartments = Array.isArray(departments) ? departments : [];
        const safeProducts = Array.isArray(products) ? products : [];
        const safeProcesses = Array.isArray(processes) ? processes : [];
        
        // 新增：从知识图谱查询相关知识
        const AnalysisService = require('../services/AnalysisService');
        const analysisService = new AnalysisService();
        
        // 使用新的模糊匹配方法
        let knowledgeData;
        if (businessDescription && businessDescription.trim()) {
            // 如果有业务描述，使用模糊匹配
            knowledgeData = await analysisService.queryKnowledgeGraphFuzzy(industry, standard, businessDescription);
            // 转换数据格式以兼容现有代码
            knowledgeData = {
                standards: knowledgeData.matchedStandards || [],
                industryEnterprises: knowledgeData.matchedEnterprises || [],
                commonDocumentCategories: knowledgeData.documentFrameworks || []
            };
        } else {
            // 否则使用原有方法
            knowledgeData = await analysisService.queryRelevantKnowledge(industry, standard);
        }
        
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
- 行业最佳实践：${JSON.stringify(knowledgeData.industryEnterprises)}
- 推荐文档类型：${JSON.stringify(knowledgeData.commonDocumentCategories)}
- 相似企业框架：${JSON.stringify(similarFrameworks)}

**分析要求：**
1. 深入分析企业的部门结构、产品特点和核心流程
2. 结合行业特色和标准要求，识别关键领域
3. 为每个领域设计3-5个核心文档
4. 文档名称必须体现企业的具体业务特点
5. 确保文档体系覆盖企业运营的关键环节

**返回格式：**
{
  "framework": {
    "categories": [
      {
        "name": "[根据企业部门和业务特点命名的文档体系]",
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
- 必须要符合标准要求
- 根据企业的实际部门、产品、流程来定制内容
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
        
        // 修改：将生成的框架保存到知识图谱，使用现有企业节点
        if (framework && framework.framework && framework.framework.categories && Array.isArray(framework.framework.categories)) {
            console.log('保存框架到知识图谱，分类数量:', framework.framework.categories.length);
            
            // 使用现有企业信息
            await analysisService.saveFrameworkToKnowledgeGraph({
                industry,
                departments: safeDepartments,
                framework: framework.framework,
                timestamp: new Date()
            }, enterpriseInfo); // 传递企业信息
        } else {
            console.warn('框架数据结构不完整，跳过保存到知识图谱');
        }
        
        res.json({
            success: true,
            data: framework,
            // 在文档生成中，正确处理了数据结构转换
knowledgeUsed: {
    standardsCount: knowledgeData.standards.length,
    industryEnterprisesCount: knowledgeData.industryEnterprises.length,
    commonDocumentCategoriesCount: knowledgeData.commonDocumentCategories.length,
    similarFrameworksCount: similarFrameworks.length,
    usedFuzzyMatching: !!businessDescription
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

// 保存文档为DOCX格式
router.post('/save-document-docx', async (req, res) => {
    try {
        const { content, documentName, metadata } = req.body;
        
        if (!content) {
            return res.status(400).json({
                success: false,
                message: '文档内容不能为空'
            });
        }

        // 解析Markdown内容为DOCX元素
        const contentElements = parseMarkdownToDocxElements(content);

        // 创建Word文档
        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: 1440,    // 1英寸 = 1440 twips
                            right: 1440,
                            bottom: 1440,
                            left: 1440
                        }
                    }
                },
                children: [
                    // 文档标题
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: documentName || '生成的文档',
                                bold: true,
                                size: 36,
                                color: '2F5496'
                            }),
                        ],
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.CENTER,
                        spacing: {
                            before: 0,
                            after: 600,
                        },
                        border: {
                            bottom: {
                                color: '2F5496',
                                space: 1,
                                value: 'single',
                                size: 6
                            }
                        }
                    }),
                    
                    // 元数据信息
                    ...(metadata ? [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `生成时间：${new Date(metadata.generatedAt).toLocaleString('zh-CN')}`,
                                    italics: true,
                                    size: 20,
                                    color: '666666'
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 200 },
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `优先级：${metadata.priority || '未指定'}`,
                                    italics: true,
                                    size: 20,
                                    color: '666666'
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 400 },
                        }),
                    ] : []),
                    
                    // 文档内容 - 使用解析后的格式化元素
                    ...contentElements,
                ],
            }],
            styles: {
                paragraphStyles: [
                    {
                        id: 'Code',
                        name: 'Code',
                        basedOn: 'Normal',
                        next: 'Normal',
                        run: {
                            font: 'Courier New',
                            size: 20
                        },
                        paragraph: {
                            spacing: { line: 240 }
                        }
                    },
                    {
                        id: 'Heading1',
                        name: 'Heading 1',
                        basedOn: 'Normal',
                        next: 'Normal',
                        run: {
                            bold: true,
                            size: 36,
                            color: '1F4E79'
                        },
                        paragraph: {
                            spacing: { before: 600, after: 400 }
                        }
                    },
                    {
                        id: 'Heading2',
                        name: 'Heading 2',
                        basedOn: 'Normal',
                        next: 'Normal',
                        run: {
                            bold: true,
                            size: 32,
                            color: '2F5496'
                        },
                        paragraph: {
                            spacing: { before: 500, after: 300 }
                        }
                    },
                    {
                        id: 'Heading3',
                        name: 'Heading 3',
                        basedOn: 'Normal',
                        next: 'Normal',
                        run: {
                            bold: true,
                            size: 28,
                            color: '5B9BD5'
                        },
                        paragraph: {
                            spacing: { before: 400, after: 250 }
                        }
                    }
                ]
            }
        });

        // 生成文档缓冲区
        const buffer = await Packer.toBuffer(doc);
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\''+ encodeURIComponent(`${documentName || '生成的文档'}.docx`));
        res.setHeader('Content-Length', buffer.length);
        
        // 发送文件
        res.send(buffer);
        
    } catch (error) {
        console.error('DOCX保存失败:', error);
        res.status(500).json({
            success: false,
            message: 'DOCX保存失败',
            error: error.message
        });
    }
});

// 保存文档为PDF格式
router.post('/save-document-pdf', async (req, res) => {
    let browser = null;
    try {
        const { content, documentName, metadata } = req.body;
        
        if (!content) {
            return res.status(400).json({
                success: false,
                message: '文档内容不能为空'
            });
        }

        console.log('开始生成PDF，文档名称:', documentName);
        
        // 安全的文件名处理
        const safeName = (documentName || '生成的文档').replace(/[<>:"/\\|?*]/g, '_');

        // 简化的markdown转HTML函数
        function markdownToHtml(markdown) {
            if (!markdown) return '';
            
            let html = markdown
                // 标题
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                // 粗体和斜体
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                // 代码
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                // 列表
                .replace(/^[*-] (.*$)/gim, '<li>$1</li>')
                // 段落和换行
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>');
            
            // 包装段落
            if (html && !html.startsWith('<')) {
                html = '<p>' + html + '</p>';
            }
            
            // 包装列表项
            html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
            
            return html;
        }

        // 生成完整的HTML文档
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${safeName}</title>
    <style>
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: "Microsoft YaHei", "SimHei", Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 10px;
            border-bottom: 2px solid #333;
        }
        .metadata {
            font-size: 12px;
            color: #666;
            text-align: center;
            margin-bottom: 20px;
        }
        .content {
            font-size: 14px;
            line-height: 1.8;
        }
        h1 { font-size: 20px; margin: 20px 0 10px 0; }
        h2 { font-size: 18px; margin: 18px 0 9px 0; }
        h3 { font-size: 16px; margin: 16px 0 8px 0; }
        p { margin: 10px 0; }
        ul { margin: 10px 0; padding-left: 20px; }
        li { margin: 5px 0; }
        code {
            background: #f5f5f5;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: "Courier New", monospace;
        }
        pre {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            margin: 15px 0;
        }
        pre code {
            background: none;
            padding: 0;
        }
    </style>
</head>
<body>
    <div class="title">${safeName}</div>
    ${metadata ? `<div class="metadata">生成时间：${new Date().toLocaleString('zh-CN')}</div>` : ''}
    <div class="content">${markdownToHtml(content)}</div>
</body>
</html>`;

        console.log('HTML内容生成完成');

        // 启动Puppeteer
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        
        // 设置页面内容
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        console.log('开始生成PDF...');
        
        // 生成PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: {
                top: '2cm',
                right: '2cm',
                bottom: '2cm',
                left: '2cm'
            }
        });
        
        await browser.close();
        browser = null;
        
        console.log(`PDF生成成功，文件大小: ${pdfBuffer.length} bytes`);
        
        // 检查PDF是否有效
        if (!pdfBuffer || pdfBuffer.length < 100) {
            throw new Error('生成的PDF文件无效或过小');
        }
        
        // 设置响应头
        const filename = `${safeName}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Cache-Control', 'no-cache');
        
        // 发送PDF文件
        res.status(200);
        res.end(pdfBuffer, 'binary');
        
        console.log('PDF文件发送完成');
        
    } catch (error) {
        console.error('PDF生成错误:', error);
        
        // 确保浏览器被关闭
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('关闭浏览器失败:', closeError);
            }
        }
        
        // 如果响应还没有发送，发送错误响应
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'PDF生成失败: ' + error.message
            });
        }
    }
});
module.exports = router;