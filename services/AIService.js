//只服务于DiagnosisService
const axios = require('axios');

class AIService {
    constructor() {
        this.DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
        this.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    }

    /**
     * 调用Deepseek API获取增强的标准框架
     */
    async getEnhancedFramework(referenceStandard, localFramework, industryType = 'manufacturing') {
        try {
            console.log(`   📝 构建AI提示词 - 标准: ${referenceStandard}, 行业: ${this.getIndustryName(industryType)}`);
            
            const prompt = `作为质量管理专家，请基于${referenceStandard}标准，为${this.getIndustryName(industryType)}行业提供增强的文档体系框架建议。\n\n当前框架：${JSON.stringify(localFramework, null, 2)}\n\n请提供：\n1. 行业特定的文档要求\n2. 关键控制点建议\n3. 合规性检查要点`;
            
            console.log(`   🚀 发送API请求到Deepseek (模型: deepseek-chat)`);
            console.log(`   ⏱️  请求超时设置: 60秒`);
            
            const startTime = Date.now();
            const response = await axios.post(this.DEEPSEEK_API_URL, {
                model: 'deepseek-chat',
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                max_tokens: 2000,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });
            
            const responseTime = Date.now() - startTime;
            console.log(`   ✅ API响应成功 (耗时: ${responseTime}ms)`);
            console.log(`   📊 响应tokens: ${response.data.usage?.total_tokens || 'N/A'}`);
            
            const content = response.data.choices[0].message.content;
            console.log(`   📄 AI响应内容长度: ${content.length} 字符`);
            
            return this.parseFrameworkResponse(content);
        } catch (error) {
            console.error(`   ❌ Deepseek框架增强失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 使用Deepseek进行文档内容分析
     */
    async analyzeDocuments(uploadedFiles, referenceStandard, industryType) {
        try {
            console.log(`   📁 准备分析 ${uploadedFiles.length} 个文档`);
            
            if (!uploadedFiles || uploadedFiles.length === 0) {
                console.log(`   ⚠️  无上传文档，使用默认分析`);
                throw new Error('No documents to analyze');
            }
            
            const documentContents = await this.extractDocumentContents(uploadedFiles);
            console.log(`   ✓ 文档内容提取完成，总字符数: ${documentContents.reduce((sum, doc) => sum + doc.content.length, 0)}`);
            
            const analysisPrompt = this.buildDocumentAnalysisPrompt(documentContents, referenceStandard, industryType);
            console.log(`   📝 分析提示词构建完成 (长度: ${analysisPrompt.length} 字符)`);
            
            console.log(`   🚀 发送文档分析请求到Deepseek...`);
            const startTime = Date.now();
            
            const response = await axios.post(this.DEEPSEEK_API_URL, {
                model: 'deepseek-chat',
                messages: [{
                    role: 'user',
                    content: analysisPrompt
                }],
                max_tokens: 3000,
                temperature: 0.3
            }, {
                headers: {
                    'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 90000
            });
            
            const responseTime = Date.now() - startTime;
            console.log(`   ✅ 文档分析响应成功 (耗时: ${responseTime}ms)`);
            console.log(`   📊 分析tokens: ${response.data.usage?.total_tokens || 'N/A'}`);
            
            // 保存原始AI响应
            const rawAIResponse = response.data.choices[0].message.content;
            console.log('🤖 AI原始响应:', rawAIResponse);
            
            const parsedResult = this.parseDocumentAnalysis(rawAIResponse);
            
            // 在返回结果中包含原始响应
            return {
                ...parsedResult,
                rawAIResponse: rawAIResponse,  // 添加原始AI响应
                aiResponseMetadata: {
                    model: 'deepseek-chat',
                    tokens: response.data.usage?.total_tokens,
                    responseTime: responseTime
                }
            };
        } catch (error) {
            console.error(`   ❌ Deepseek文档分析失败:`, error.response?.data || error.message);
            throw error;
        }
    }

    getIndustryName(industryType) {
        const industryNames = {
            'manufacturing': '制造业',
            'service': '服务业', 
            'technology': '科技行业',
            'healthcare': '医疗健康',
            'food': '食品行业',
            'other': '其他行业'
        };
        return industryNames[industryType] || '制造业';
    }

    /**
     * 解析框架响应内容
     */
    parseFrameworkResponse(content) {
        try {
            // 清理内容，移除可能的注释和无效字符
            let cleanContent = content;
            
            // 移除单行注释
            cleanContent = cleanContent.replace(/\/\/.*$/gm, '');
            
            // 移除多行注释
            cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, '');
            
            // 移除多余的空白字符
            cleanContent = cleanContent.trim();
            
            // 尝试解析JSON格式的响应
            if (cleanContent.includes('{') && cleanContent.includes('}')) {
                // 提取JSON部分，更精确的匹配
                const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    let jsonStr = jsonMatch[0];
                    
                    // 进一步清理JSON字符串
                    jsonStr = jsonStr.replace(/\/\/.*$/gm, ''); // 移除行内注释
                    jsonStr = jsonStr.replace(/,\s*([}\]])/, '$1'); // 移除尾随逗号
                    
                    return JSON.parse(jsonStr);
                }
            }
            
            // 如果不是JSON格式，返回结构化的文本解析结果
            return {
                enhancedFramework: content,
                suggestions: this.extractSuggestions(content),
                industrySpecific: this.extractIndustrySpecific(content)
            };
        } catch (error) {
            console.error('解析框架响应失败:', error);
            console.error('原始内容:', content);
            
            // 返回安全的默认结构
            return {
                enhancedFramework: content,
                suggestions: [],
                industrySpecific: [],
                error: error.message
            };
        }
    }

    /**
     * 提取文档内容
     */
    async extractDocumentContents(uploadedFiles) {
        const fs = require('fs').promises;
        const path = require('path');
        const mammoth = require('mammoth'); // Word文档
        const pdfParse = require('pdf-parse'); // PDF文档
        const documentContents = [];
        
        console.log('📋 开始提取文档内容，接收到的文件信息:', JSON.stringify(uploadedFiles, null, 2));
        
        for (const file of uploadedFiles) {
            try {
                let actualFilename = file.filename || file.name;
                
                if (!actualFilename || !actualFilename.includes('-')) {
                    const uploadsDir = path.join(process.cwd(), 'uploads');
                    const files = await fs.readdir(uploadsDir);
                    const targetName = file.name || file.originalname || actualFilename;
                    
                    const matchedFile = files.find(f => 
                        f.includes('-') && f.substring(f.indexOf('-') + 1) === targetName
                    );
                    
                    if (matchedFile) {
                        actualFilename = matchedFile;
                        console.log(`   🔍 找到匹配文件: ${targetName} -> ${actualFilename}`);
                    } else {
                        console.log(`   ⚠️  未找到匹配文件: ${targetName}，可用文件:`, files);
                    }
                }
                
                const filePath = path.join(process.cwd(), 'uploads', actualFilename);
                console.log(`   🔍 尝试读取文件: ${filePath}`);
                
                let content = '';
                const fileExtension = path.extname(actualFilename).toLowerCase();
                
                // 根据文件类型选择合适的解析方法
                if (fileExtension === '.docx') {
                    // Word文档处理 (.docx)
                    const buffer = await fs.readFile(filePath);
                    const result = await mammoth.extractRawText({ buffer });
                    content = result.value;
                    console.log(`   📄 Word文档解析完成: ${content.length} 字符`);
                } else if (fileExtension === '.doc') {
                    // 旧版Word文档处理 (.doc) - 使用替代方案
                    try {
                        // 尝试使用textract（如果可用）
                        const textract = require('textract');
                        content = await new Promise((resolve, reject) => {
                            textract.fromFileWithPath(filePath, { preserveLineBreaks: true }, (error, text) => {
                                if (error) reject(error);
                                else resolve(text || '');
                            });
                        });
                        console.log(`   📄 .doc文档解析完成: ${content.length} 字符`);
                    } catch (textractError) {
                        console.warn(`   ⚠️  textract解析失败，尝试备用方案: ${textractError.message}`);
                        
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
                    error: error.message,
                    size: 0
                });
            }
        }
        
        return documentContents;
    }

    /**
     * 构建文档分析提示词
     */
    buildDocumentAnalysisPrompt(documentContents, referenceStandard, industryType) {
        const documentsText = documentContents.map(doc => 
            `文档: ${doc.filename}\n内容: ${doc.content.substring(0, 1000)}...`
        ).join('\n\n');
        
        return `作为质量管理专家，请分析以下${this.getIndustryName(industryType)}行业的文档，基于${referenceStandard}标准进行评估：\n\n${documentsText}\n\n请提供：\n1. 文档完整性分析\n2. 合规性评估\n3. 改进建议\n4. 风险识别`;
    }

    /**
     * 解析文档分析结果
     */
    parseDocumentAnalysis(content) {
        return {
            analysis: content,
            completeness: this.extractCompleteness(content),
            compliance: this.extractCompliance(content),
            suggestions: this.extractSuggestions(content),
            risks: this.extractRisks(content)
        };
    }

    /**
     * 提取建议内容
     */
    extractSuggestions(content) {
        const suggestions = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes('建议') || line.includes('改进') || line.includes('优化')) {
                suggestions.push(line);
            }
        }
        
        return suggestions;
    }

    /**
     * 提取行业特定内容
     */
    extractIndustrySpecific(content) {
        const specific = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes('行业') || line.includes('特定') || line.includes('专业')) {
                specific.push(line);
            }
        }
        
        return specific;
    }

    /**
     * 提取完整性信息
     */
    extractCompleteness(content) {
        const completenessMatch = content.match(/完整性[：:][\s\S]*?(?=\n\n|$)/);
        return completenessMatch ? completenessMatch[0] : '完整性分析未找到';
    }

    /**
     * 提取合规性信息
     */
    extractCompliance(content) {
        const complianceMatch = content.match(/合规性[：:][\s\S]*?(?=\n\n|$)/);
        return complianceMatch ? complianceMatch[0] : '合规性分析未找到';
    }

    /**
     * 提取风险信息
     */
    extractRisks(content) {
        const risks = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes('风险') || line.includes('问题') || line.includes('缺陷')) {
                risks.push(line);
            }
        }
        
        return risks;
    }

    // 其他AI相关的辅助方法...
}

module.exports = AIService;