const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const AIService = require('./AIService');
const FrameworkService = require('./FrameworkService');

/**
 * 文档体系诊断服务
 * 提供基础诊断和AI增强诊断功能
 */
class DiagnosisService {
    constructor() {
        this.aiService = new AIService();
        this.frameworkService = new FrameworkService();
    }

    /**
     * 增强版文档体系诊断 - 集成Deepseek AI分析
     */
    async diagnoseDocumentSystemEnhanced(enterpriseId, industryType, referenceStandard, diagnosisDepth, uploadedFiles = []) {
        try {
            console.log('🚀 开始AI增强文档体系诊断...');
            console.log(`   📋 参数: 企业ID=${enterpriseId}, 行业=${industryType}, 标准=${referenceStandard}`);
            console.log(`   📁 上传文件数量: ${uploadedFiles.length}`);
            
            // 1. 提取文档内容
            const documentContents = await this.extractDocumentContents(uploadedFiles);
            console.log(`   ✅ 文档内容提取完成: ${documentContents.length} 个文档`);
            
            // 2. 构建AI分析提示词
            const analysisPrompt = this.buildDocumentAnalysisPrompt(documentContents, referenceStandard, industryType);
            console.log(`   📝 AI提示词构建完成`);
            
            // 3. 调用AI服务进行分析
            console.log(`   🤖 调用Deepseek AI进行文档体系分析...`);
            const aiAnalysis = await this.aiService.analyzeDocuments(documentContents, referenceStandard, industryType);
            console.log(`   ✅ AI分析完成`);
            
            // 4. 解析AI分析结果
            const parsedResult = this.parseAIAnalysisResult(aiAnalysis);
            console.log(`   📊 AI结果解析完成`);
            
            // 5. 构建最终诊断结果
            const finalResult = {
                success: true,
                analysisSource: 'deepseek_enhanced',
                timestamp: new Date().toISOString(),
                enterpriseId: enterpriseId,
                industryType: industryType,
                referenceStandard: referenceStandard,
                diagnosisDepth: diagnosisDepth,
                result: {
                    summary: {
                        completenessRate: `${parsedResult.systemCompleteness?.overallPercentage || 0}%`,
                        health: parsedResult.systemCompleteness?.overallPercentage || 0,
                        totalDocuments: documentContents.length,
                        missingDocuments: parsedResult.missingDocuments?.length || 0,
                        complianceRisk: parsedResult.complianceRisk || 'medium'
                    },
                    standardRequiredDocuments: parsedResult.standardRequiredDocuments || [],
                    currentDocuments: parsedResult.currentDocuments || [],
                    missingDocuments: parsedResult.missingDocuments || [],
                    implementationPlan: parsedResult.implementationPlan || [],
                    recommendations: parsedResult.recommendations || [],
                    systemCompleteness: parsedResult.systemCompleteness || {
                        overallPercentage: 0,
                        mandatoryDocuments: 0,
                        recommendedDocuments: 0
                    },
                    analysisDetails: {
                        aiModel: 'deepseek-chat',
                        analysisTime: new Date().toISOString(),
                        documentCount: documentContents.length,
                        industrySpecific: true
                    }
                }
            };
            
            console.log(`   🎉 AI增强诊断完成`);
            console.log(`   📈 完整度: ${finalResult.result.summary.completenessRate}`);
            console.log(`   📋 缺失文档: ${finalResult.result.summary.missingDocuments} 个`);
            
            return finalResult;
            
        } catch (error) {
            console.error('❌ AI增强诊断失败:', error);
            
            // 降级到基础诊断
            console.log('🔄 降级到基础诊断...');
            return await this.diagnoseDocumentSystem(enterpriseId, industryType, referenceStandard, diagnosisDepth, uploadedFiles);
        }
    }

    /**
     * 基础文档体系诊断
     */
    async diagnoseDocumentSystem(enterpriseId, industryType, referenceStandard, diagnosisDepth, uploadedFiles = []) {
        try {
            console.log('开始基础文档体系诊断...');
            
            // 1. 获取标准框架
            const standardFramework = this.frameworkService.getStandardFramework(referenceStandard, industryType);
            
            // 2. 提取文档内容
            const documentContents = await this.extractDocumentContents(uploadedFiles);
            
            // 3. 分析文档覆盖情况
            const coverageAnalysis = this.analyzeDocumentCoverage(documentContents, standardFramework);
            
            // 4. 识别缺失文档
            const missingDocuments = this.identifyMissingDocuments(standardFramework, documentContents);
            
            // 5. 计算完整度
            const completenessRate = this.calculateCompleteness(standardFramework, documentContents);
            
            // 6. 生成建议
            const recommendations = this.generateRecommendations(missingDocuments, completenessRate);
            
            const result = {
                success: true,
                analysisSource: 'local_basic',
                timestamp: new Date().toISOString(),
                enterpriseId: enterpriseId,
                industryType: industryType,
                referenceStandard: referenceStandard,
                diagnosisDepth: diagnosisDepth,
                result: {
                    summary: {
                        completenessRate: `${completenessRate}%`,
                        health: completenessRate,
                        totalDocuments: documentContents.length,
                        missingDocuments: missingDocuments.length
                    },
                    documentAnalysis: coverageAnalysis,
                    missingDocuments: missingDocuments,
                    recommendations: recommendations,
                    framework: {
                        standard: referenceStandard,
                        categories: standardFramework.categories || this.getIndustrySpecificCategories(referenceStandard, industryType)
                    }
                }
            };
            
            console.log('基础诊断完成');
            return result;
            
        } catch (error) {
            console.error('基础诊断失败:', error);
            throw error;
        }
    }

    /**
     * 基础文档体系诊断方法
     */
    async diagnoseBasic(enterpriseId, referenceStandard, diagnosisDepth, uploadedFiles = []) {
        try {
            console.log('开始基础文档体系诊断...');
            
            // 获取标准框架
            const framework = this.getStandardFramework(referenceStandard);
            
            // 提取文档内容
            const documentContents = await this.extractDocumentContents(uploadedFiles);
            
            // 分析文档覆盖情况
            const analysis = this.analyzeDocumentCoverage(documentContents, framework);
            
            // 识别缺失项
            const missingItems = this.identifyMissingItems(framework, documentContents);
            
            // 计算完整度
            const completeness = this.calculateCompleteness(framework, documentContents);
            
            return {
                success: true,
                result: {
                    summary: {
                        completenessRate: `${completeness}%`,
                        totalCategories: framework.categories.length,
                        coveredCategories: analysis.coveredCategories
                    },
                    analysis: analysis,
                    missingItems: missingItems,
                    framework: {
                        standard: referenceStandard,
                        categories: this.getIndustrySpecificCategories(referenceStandard, industryType)
                    },
                    recommendations: this.generateRecommendations(missingItems, completeness)
                }
            };
        } catch (error) {
            console.error('基础诊断失败:', error);
            throw error;
        }
    }

    /**
     * 获取行业特定的类别要求
     */
    getIndustrySpecificCategories(referenceStandard, industryType) {
        const baseCategories = {
            'ISO 9001:2015': [
                { 
                    name: '组织环境', 
                    required: true, 
                    documents: ['组织架构图', '相关方需求分析', '组织环境分析'],
                    description: '确定组织的宗旨、战略方向以及内外部环境'
                },
                { 
                    name: '领导作用', 
                    required: true, 
                    documents: ['质量方针', '质量目标', '职责权限矩阵'],
                    description: '最高管理者的领导作用和承诺'
                },
                { 
                    name: '策划', 
                    required: true, 
                    documents: ['风险和机遇评估', '质量目标策划', '变更控制程序'],
                    description: '应对风险和机遇的措施以及质量目标的策划'
                },
                { 
                    name: '支持', 
                    required: true, 
                    documents: ['资源管理程序', '能力管理程序', '意识培训记录', '沟通程序', '文件控制程序'],
                    description: '为质量管理体系提供必要的支持'
                },
                { 
                    name: '运行', 
                    required: true, 
                    documents: ['运行控制程序', '产品和服务要求', '设计开发控制', '外部供方控制', '生产控制程序'],
                    description: '策划、实施和控制满足要求所需的过程'
                },
                { 
                    name: '绩效评价', 
                    required: true, 
                    documents: ['监视和测量程序', '顾客满意度调查', '内部审核程序', '管理评审程序'],
                    description: '监视、测量、分析和评价质量管理体系的绩效'
                },
                { 
                    name: '改进', 
                    required: true, 
                    documents: ['不合格控制程序', '纠正措施程序', '持续改进程序'],
                    description: '持续改进质量管理体系的适宜性、充分性和有效性'
                }
            ],
            'ISO 14001:2015': [
                { name: '组织环境', required: true, documents: ['环境因素识别', '法律法规清单'] },
                { name: '领导作用', required: true, documents: ['环境方针', '环境目标'] },
                { name: '策划', required: true, documents: ['环境风险评估', '环境目标策划'] },
                { name: '支持', required: true, documents: ['环境资源管理', '环境意识培训'] },
                { name: '运行', required: true, documents: ['环境运行控制', '应急准备程序'] },
                { name: '绩效评价', required: true, documents: ['环境监测程序', '环境内审程序'] },
                { name: '改进', required: true, documents: ['环境不符合控制', '环境持续改进'] }
            ]
        };

        // 行业特定文档
        const industrySpecific = {
            'manufacturing': {
                documents: ['生产工艺控制程序', '设备维护保养程序', '产品检验规程', '不合格品控制程序'],
                category: '运行'
            },
            'service': {
                documents: ['服务交付程序', '客户投诉处理程序', '服务质量监控程序'],
                category: '运行'
            },
            'technology': {
                documents: ['软件开发流程', '技术文档管理程序', '版本控制程序', '代码审查程序'],
                category: '运行'
            },
            'healthcare': {
                documents: ['医疗质量控制程序', '患者安全管理程序', '医疗设备管理程序'],
                category: '运行'
            },
            'food': {
                documents: ['HACCP计划', '食品安全控制程序', '供应商审核程序', '产品召回程序'],
                category: '运行'
            },
            'construction': {
                documents: ['施工质量控制程序', '安全管理程序', '材料检验程序'],
                category: '运行'
            },
            'education': {
                documents: ['教学质量管理程序', '学生服务程序', '教师培训程序'],
                category: '运行'
            }
        };

        let categories = JSON.parse(JSON.stringify(baseCategories[referenceStandard] || baseCategories['ISO 9001:2015']));
        
        // 添加行业特定文档
        if (industrySpecific[industryType]) {
            const targetCategory = categories.find(cat => cat.name === industrySpecific[industryType].category);
            if (targetCategory) {
                targetCategory.documents.push(...industrySpecific[industryType].documents);
            }
        }

        return categories;
    }

    /**
     * 提取文档内容
     */
    async extractDocumentContents(uploadedFiles) {
        const documentContents = [];
        
        console.log(`📁 开始提取 ${uploadedFiles.length} 个文档的内容...`);
        
        for (const file of uploadedFiles) {
            try {
                // 构建文件路径
                const filePath = path.join(process.cwd(), 'uploads', file.filename || file.name);
                const fileExtension = path.extname(file.filename || file.name).toLowerCase();
                
                console.log(`   📄 处理文档: ${file.name || file.filename} (${fileExtension})`);
                
                let content = '';
                let actualFilename = file.filename || file.name;
                
                if (fileExtension === '.docx') {
                    // Word文档处理
                    const buffer = await fs.readFile(filePath);
                    const result = await mammoth.extractRawText({ buffer });
                    content = result.value;
                    console.log(`   📄 Word文档解析完成: ${content.length} 字符`);
                } else if (fileExtension === '.doc') {
                    // .doc格式处理（有限支持）
                    try {
                        const buffer = await fs.readFile(filePath);
                        const result = await mammoth.extractRawText({ buffer });
                        content = result.value;
                        console.log(`   📄 .doc文档解析完成: ${content.length} 字符`);
                    } catch (docError) {
                        console.warn(`   ⚠️  .doc格式解析失败，建议转换为.docx格式: ${docError.message}`);
                        // 备用方案：提示用户转换格式
                        content = `无法解析.doc格式文件。建议：\n1. 将文件另存为.docx格式后重新上传\n2. 或将内容复制到.txt文件中上传\n\n文件路径: ${filePath}`;
                    }
                } else if (fileExtension === '.pdf') {
                    // PDF文档处理
                    const buffer = await fs.readFile(filePath);
                    const data = await pdfParse(buffer);
                    content = data.text;
                    console.log(`   📄 PDF文档解析完成: ${content.length} 字符`);
                } else if (['.txt', '.md', '.json', '.xml', '.csv'].includes(fileExtension)) {
                    // 纯文本文件
                    content = await fs.readFile(filePath, 'utf8');
                    console.log(`   📄 文本文件读取完成: ${content.length} 字符`);
                } else {
                    // 不支持的格式
                    content = `不支持的文件格式: ${fileExtension}。支持的格式：.docx, .pdf, .txt, .md, .json, .xml, .csv`;
                    console.warn(`   ⚠️  不支持的文件格式: ${fileExtension}`);
                }
                
                // 验证内容是否有效（放宽条件）
                if (!content) {
                    content = '文档内容为空';
                }
                
                documentContents.push({
                    filename: file.name || file.filename,
                    actualFilename: actualFilename,
                    content: content,
                    size: content.length,
                    type: fileExtension
                });
                
                console.log(`   ✓ 提取文档: ${file.name || file.filename} (${content.length} 字符)`);
            } catch (error) {
                console.error(`   ❌ 提取文档失败: ${file.name || file.filename}`, error.message);
                console.error(`   📁 尝试的路径: ${path.join(process.cwd(), 'uploads', file.filename || file.name)}`);
                
                documentContents.push({
                    filename: file.name || file.filename,
                    content: `文档解析失败: ${error.message}。建议将.doc文件转换为.docx格式后重新上传。`,
                    size: 0,
                    type: 'error'
                });
            }
        }
        
        console.log(`✅ 文档内容提取完成，共处理 ${documentContents.length} 个文档`);
        return documentContents;
    }

    /**
     * 分析文档覆盖情况
     */
    analyzeDocumentCoverage(documentContents, framework) {
        const analysis = {
            coveredCategories: 0,
            documentMatches: [],
            categoryAnalysis: []
        };
        
        const categories = framework.categories || [];
        
        categories.forEach(category => {
            const categoryMatch = {
                name: category.name,
                required: category.required,
                expectedDocuments: category.documents,
                foundDocuments: [],
                coverageRate: 0
            };
            
            // 检查每个期望的文档是否有匹配
            category.documents.forEach(expectedDoc => {
                const matchingDocs = documentContents.filter(doc => 
                    this.isDocumentMatch(doc.filename, expectedDoc)
                );
                
                if (matchingDocs.length > 0) {
                    categoryMatch.foundDocuments.push({
                        expected: expectedDoc,
                        actual: matchingDocs[0].filename,
                        confidence: this.calculateMatchConfidence(matchingDocs[0].filename, expectedDoc)
                    });
                }
            });
            
            // 计算覆盖率
            categoryMatch.coverageRate = Math.round(
                (categoryMatch.foundDocuments.length / category.documents.length) * 100
            );
            
            if (categoryMatch.coverageRate > 0) {
                analysis.coveredCategories++;
            }
            
            analysis.categoryAnalysis.push(categoryMatch);
        });
        
        return analysis;
    }

    /**
     * 识别缺失文档
     */
    identifyMissingDocuments(framework, documentContents) {
        const missingDocuments = [];
        const categories = framework.categories || [];
        
        categories.forEach(category => {
            category.documents.forEach(expectedDoc => {
                const hasMatch = documentContents.some(doc => 
                    this.isDocumentMatch(doc.filename, expectedDoc)
                );
                
                if (!hasMatch) {
                    missingDocuments.push({
                        name: expectedDoc,
                        category: category.name,
                        required: category.required,
                        priority: category.required ? 'high' : 'medium',
                        description: `${category.name}类别下的必要文档`
                    });
                }
            });
        });
        
        return missingDocuments;
    }

    /**
     * 计算完整度
     */
    calculateCompleteness(framework, documentContents) {
        const categories = framework.categories || [];
        let totalExpected = 0;
        let totalFound = 0;
        
        categories.forEach(category => {
            totalExpected += category.documents.length;
            
            category.documents.forEach(expectedDoc => {
                const hasMatch = documentContents.some(doc => 
                    this.isDocumentMatch(doc.filename, expectedDoc)
                );
                
                if (hasMatch) {
                    totalFound++;
                }
            });
        });
        
        return totalExpected > 0 ? Math.round((totalFound / totalExpected) * 100) : 0;
    }

    /**
     * 生成建议
     */
    generateRecommendations(missingDocuments, completenessRate) {
        const recommendations = [];
        
        if (completenessRate < 50) {
            recommendations.push('文档体系完整性较低，建议优先建立核心管理文档');
            recommendations.push('建议制定文档建设计划，分阶段完善文档体系');
        } else if (completenessRate < 80) {
            recommendations.push('文档体系基本完整，建议补充缺失的关键文档');
        } else {
            recommendations.push('文档体系较为完整，建议定期审核和更新现有文档');
        }
        
        // 基于缺失文档的优先级建议
        const highPriorityMissing = missingDocuments.filter(doc => doc.priority === 'high');
        if (highPriorityMissing.length > 0) {
            recommendations.push('建议优先完善缺失的必要文档类别');
        }
        
        if (completenessRate < 30) {
            recommendations.push('当前文档体系完整性较低，建议系统性梳理和补充');
        }
        
        recommendations.push('定期进行文档体系审核，持续改进文档质量');
        
        return recommendations;
    }

    /**
     * 检查文档是否匹配
     */
    isDocumentMatch(filename, expectedDoc) {
        const normalizedFilename = filename.toLowerCase().replace(/[\s\-_]/g, '');
        const normalizedExpected = expectedDoc.toLowerCase().replace(/[\s\-_]/g, '');
        
        // 精确匹配
        if (normalizedFilename.includes(normalizedExpected)) {
            return true;
        }
        
        // 关键词匹配
        const keywords = normalizedExpected.split(/[\s\-_]+/);
        const matchCount = keywords.filter(keyword => 
            normalizedFilename.includes(keyword)
        ).length;
        
        return matchCount >= Math.ceil(keywords.length * 0.6); // 60%关键词匹配
    }

    /**
     * 计算匹配置信度
     */
    calculateMatchConfidence(filename, expectedDoc) {
        const normalizedFilename = filename.toLowerCase();
        const normalizedExpected = expectedDoc.toLowerCase();
        
        if (normalizedFilename.includes(normalizedExpected)) {
            return 0.9;
        }
        
        const keywords = normalizedExpected.split(/[\s\-_]+/);
        const matchCount = keywords.filter(keyword => 
            normalizedFilename.includes(keyword)
        ).length;
        
        return matchCount / keywords.length;
    }

    /**
     * 获取标准框架
     */
    getStandardFramework(referenceStandard) {
        return this.frameworkService.getStandardFramework(referenceStandard);
    }

    /**
     * 识别缺失项（兼容旧接口）
     */
    identifyMissingItems(framework, documentContents) {
        return this.identifyMissingDocuments(framework, documentContents);
    }

    /**
     * 构建文档分析提示词 - 重点关注文档体系完整性
     */
    buildDocumentAnalysisPrompt(documentContents, referenceStandard, industryType) {
        const industryName = this.getIndustryName(industryType);
        
        let prompt = `作为专业的${referenceStandard}标准文档体系分析专家，请基于${referenceStandard}标准要求，分析${industryName}行业应建立的完整文档体系，并识别当前缺失的文档。\n\n`;
        
        // 添加当前已有文档信息
        prompt += `=== 当前已有文档清单 ===\n`;
        if (documentContents && documentContents.length > 0) {
            documentContents.forEach((doc, index) => {
                prompt += `${index + 1}. ${doc.filename} (${doc.type || '未知类型'})\n`;
            });
        } else {
            prompt += `暂无已上传文档\n`;
        }
        
        prompt += `\n=== 分析要求 ===\n`;
        prompt += `请基于${referenceStandard}标准对${industryName}行业的文档体系要求，进行以下分析：\n\n`;
        prompt += `1. 列出${referenceStandard}标准要求${industryName}行业必须建立的完整文档体系清单\n`;
        prompt += `2. 对比当前已有文档，识别缺失的关键文档\n`;
        prompt += `3. 按重要性和紧急程度对缺失文档进行分类\n`;
        prompt += `4. 评估当前文档体系的完整度百分比\n`;
        prompt += `5. 提供文档体系建设的优先级建议\n\n`;
        
        prompt += `=== 重点关注 ===\n`;
        prompt += `- 重点分析${referenceStandard}标准条款要求的文档\n`;
        prompt += `- 考虑${industryName}行业的特殊监管要求\n`;
        prompt += `- 识别影响合规性的关键缺失文档\n`;
        prompt += `- 提供文档体系建设的实施路径\n\n`;
        
        prompt += `请以JSON格式返回分析结果：\n`;
        prompt += `{\n`;
        prompt += `  "standardRequiredDocuments": [\n`;
        prompt += `    {\n`;
        prompt += `      "documentName": "文档名称",\n`;
        prompt += `      "category": "文档分类",\n`;
        prompt += `      "standardClause": "对应标准条款",\n`;
        prompt += `      "importance": "high|medium|low",\n`;
        prompt += `      "description": "文档用途说明"\n`;
        prompt += `    }\n`;
        prompt += `  ],\n`;
        prompt += `  "currentDocuments": [\n`;
        prompt += `    {\n`;
        prompt += `      "fileName": "已有文档名",\n`;
        prompt += `      "matchedCategory": "匹配的标准文档分类",\n`;
        prompt += `      "coverageLevel": "完全覆盖|部分覆盖|不匹配"\n`;
        prompt += `    }\n`;
        prompt += `  ],\n`;
        prompt += `  "missingDocuments": [\n`;
        prompt += `    {\n`;
        prompt += `      "documentName": "缺失文档名称",\n`;
        prompt += `      "category": "文档分类",\n`;
        prompt += `      "standardClause": "对应标准条款",\n`;
        prompt += `      "priority": "high|medium|low",\n`;
        prompt += `      "urgency": "urgent|normal|low",\n`;
        prompt += `      "reason": "缺失原因分析",\n`;
        prompt += `      "impact": "缺失影响说明"\n`;
        prompt += `    }\n`;
        prompt += `  ],\n`;
        prompt += `  "systemCompleteness": {\n`;
        prompt += `    "overallPercentage": 65,\n`;
        prompt += `    "mandatoryDocuments": 45,\n`;
        prompt += `    "recommendedDocuments": 80\n`;
        prompt += `  },\n`;
        prompt += `  "implementationPlan": [\n`;
        prompt += `    {\n`;
        prompt += `      "phase": "第一阶段",\n`;
        prompt += `      "documents": ["优先建立的文档列表"],\n`;
        prompt += `      "timeframe": "建议时间框架",\n`;
        prompt += `      "resources": "所需资源"\n`;
        prompt += `    }\n`;
        prompt += `  ],\n`;
        prompt += `  "recommendations": ["文档体系建设总体建议"],\n`;
        prompt += `  "complianceRisk": "high|medium|low"\n`;
        prompt += `}`;
        
        return prompt;
    }

    /**
     * 解析AI分析结果
     */
    parseAIAnalysisResult(aiResponse) {
        try {
            // 如果aiResponse是字符串，尝试解析JSON
            let parsedResult;
            if (typeof aiResponse === 'string') {
                // 提取JSON部分
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsedResult = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('无法从AI响应中提取JSON');
                }
            } else {
                parsedResult = aiResponse;
            }
            
            // 验证和标准化结果结构
            return {
                standardRequiredDocuments: parsedResult.standardRequiredDocuments || [],
                currentDocuments: parsedResult.currentDocuments || [],
                missingDocuments: parsedResult.missingDocuments || [],
                systemCompleteness: parsedResult.systemCompleteness || {
                    overallPercentage: 0,
                    mandatoryDocuments: 0,
                    recommendedDocuments: 0
                },
                implementationPlan: parsedResult.implementationPlan || [],
                recommendations: parsedResult.recommendations || [],
                complianceRisk: parsedResult.complianceRisk || 'medium'
            };
        } catch (error) {
            console.error('解析AI分析结果失败:', error);
            // 返回默认结构
            return {
                standardRequiredDocuments: [],
                currentDocuments: [],
                missingDocuments: [],
                systemCompleteness: {
                    overallPercentage: 0,
                    mandatoryDocuments: 0,
                    recommendedDocuments: 0
                },
                implementationPlan: [],
                recommendations: ['AI分析结果解析失败，建议使用基础诊断功能'],
                complianceRisk: 'high'
            };
        }
    }

    /**
     * 获取行业名称
     */
    getIndustryName(industryType) {
        const industryNames = {
            'manufacturing': '制造业',
            'service': '服务业',
            'technology': '科技行业',
            'healthcare': '医疗健康',
            'food': '食品行业',
            'construction': '建筑行业',
            'education': '教育行业',
            'finance': '金融行业',
            'retail': '零售行业',
            'logistics': '物流行业'
        };
        
        return industryNames[industryType] || '制造业';
    }
}

module.exports = DiagnosisService;