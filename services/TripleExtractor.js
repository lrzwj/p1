const axios = require('axios');
const http = require('http');
const https = require('https');
require('dotenv').config();

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// 从文本中抽取实体和关系
async function extractEntitiesAndRelations(text) {
    const maxRetries = 5; // 增加重试次数
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`DeepSeek API调用尝试 ${attempt}/${maxRetries}`);
            console.log('发送到DeepSeek的请求:', { text: text.substring(0, 100) + '...' });

            // 创建axios实例，配置更详细的选项
            const axiosConfig = {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Node.js/TripleExtractor',
                    'Connection': 'keep-alive'
                },
                timeout: 120000, // 增加到2分钟
                // 添加更多网络配置
                maxRedirects: 5,
                maxContentLength: 50 * 1024 * 1024, // 50MB
                maxBodyLength: 50 * 1024 * 1024,
                // 添加重连配置
                httpAgent: new (require('http').Agent)({
                    keepAlive: true,
                    keepAliveMsecs: 30000,
                    maxSockets: 50,
                    maxFreeSockets: 10,
                    timeout: 120000,
                    freeSocketTimeout: 30000
                }),
                httpsAgent: new (require('https').Agent)({
                    keepAlive: true,
                    keepAliveMsecs: 30000,
                    maxSockets: 50,
                    maxFreeSockets: 10,
                    timeout: 120000,
                    freeSocketTimeout: 30000,
                    rejectUnauthorized: true
                })
            };

            const response = await axios.post(DEEPSEEK_API_URL, {
                // 第54行附近
                model: 'deepseek-chat',  // 从 'deepseek-chat' 改为 'deepseek-reasoner'
                messages: [
                    {
                        role: 'user',
                        content: `请从以下文本中抽取实体和关系，并以JSON格式返回。要求：
1. 识别文本中的关键实体（人物、组织、概念、流程等）
2. 识别实体之间的关系
3. 返回格式为JSON，包含triples数组
4. 每个三元组包含subject（主语）、predicate（谓语/关系）、object（宾语）

文本内容：
${text}

请返回以下格式的JSON：
{
  "triples": [
    {
      "subject": "主语",
      "predicate": "关系",
      "object": "宾语",
      "confidence": 0.9,
      "subject_type": "实体类型",
      "object_type": "实体类型"
    }
  ]
}`
                    }
                ],
                temperature: 0.1,
                max_tokens: 2000
            }, axiosConfig);
            
            // 如果成功，跳出重试循环
            console.log('DeepSeek API响应状态:', response.status);
        
            if (!response.data || !response.data.choices || !response.data.choices[0]) {
                throw new Error('DeepSeek API返回格式异常');
            }

            const content = response.data.choices[0].message.content;
            console.log('DeepSeek原始响应:', content);
            
            // 清理和解析JSON
            const cleanedContent = cleanJsonResponse(content);
            console.log('清理后的内容:', cleanedContent);
            
            const result = JSON.parse(cleanedContent);
            
            // 验证结果结构
            if (!result || !Array.isArray(result.triples)) {
                throw new Error(`API返回格式不正确: ${JSON.stringify(result)}`);
            }
            
            // 验证三元组格式
            const validTriples = result.triples.filter(triple => 
                triple.subject && triple.predicate && triple.object
            );
            
            console.log(`成功解析 ${validTriples.length} 个有效三元组`);
            
            return {
                success: true,
                triples: validTriples,
                message: `成功抽取 ${validTriples.length} 个三元组`
            };
            
        } catch (error) {
            lastError = error;
            console.error(`DeepSeek API调用失败 (尝试 ${attempt}/${maxRetries}):`);
            console.error('错误类型:', error.constructor.name);
            console.error('错误代码:', error.code);
            console.error('错误消息:', error.message);
            
            if (error.response) {
                console.error('响应状态:', error.response.status);
                console.error('响应头:', error.response.headers);
            }
            
            if (attempt < maxRetries) {
                // 指数退避策略：2秒、4秒、8秒、16秒
                const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
                console.log(`等待 ${delay}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // 所有重试都失败了
    console.error('所有重试尝试都失败，最后错误:', lastError.message);
    throw lastError;
}

// 清理JSON响应
// 改进清理JSON响应函数
function cleanJsonResponse(content) {
    if (!content || typeof content !== 'string') {
        throw new Error('无效的响应内容');
    }
    
    // 移除markdown代码块标记
    let cleaned = content.replace(/```json\s*|```\s*/g, '');
    
    // 移除可能的前后空白和换行
    cleaned = cleaned.trim();
    
    // 移除可能的解释性文字，只保留JSON部分
    const lines = cleaned.split('\n');
    let jsonLines = [];
    let inJson = false;
    let braceCount = 0;
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 检测JSON开始
        if (trimmedLine.startsWith('{') || inJson) {
            inJson = true;
            jsonLines.push(line);
            
            // 计算大括号数量
            for (const char of trimmedLine) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            
            // 如果大括号平衡，JSON结束
            if (braceCount === 0 && trimmedLine.includes('}')) {
                break;
            }
        }
    }
    
    if (jsonLines.length === 0) {
        // 如果没有找到完整的JSON结构，尝试简单提取
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        } else {
            throw new Error('在响应中找不到有效的JSON结构');
        }
    } else {
        cleaned = jsonLines.join('\n');
    }
    
    // 最终验证
    if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) {
        throw new Error('JSON格式不完整');
    }
    
    return cleaned;
}

// 本地抽取方法（降级方案）
function localExtraction(text) {
    // 简单的本地抽取逻辑
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
    const triples = [];
    
    sentences.forEach((sentence, index) => {
        if (sentence.length > 10) {
            triples.push({
                subject: `实体${index + 1}`,
                predicate: "相关于",
                object: sentence.substring(0, 20) + "...",
                confidence: 0.5,
                subject_type: "document",
                object_type: "document"
            });
        }
    });
    
    return triples.slice(0, 5); // 最多返回5个
}

// 添加连接测试函数
async function testDeepSeekConnection() {
    try {
        const response = await axios.get('https://api.deepseek.com', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Node.js/TripleExtractor'
            }
        });
        console.log('DeepSeek API连接测试成功');
        return true;
    } catch (error) {
        console.error('DeepSeek API连接测试失败:', error.message);
        return false;
    }
}

module.exports = {
    extractEntitiesAndRelations
};

