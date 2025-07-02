const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');

// 从文件中提取文本内容
async function extractTextFromFile(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        
        switch (ext) {
            case '.txt':
                return await fs.readFile(filePath, 'utf8');
            case '.json':
                const jsonContent = await fs.readFile(filePath, 'utf8');
                return JSON.stringify(JSON.parse(jsonContent), null, 2);
            case '.docx':
                // 使用 mammoth 提取 Word 文档文本
                const result = await mammoth.extractRawText({ path: filePath });
                return result.value;
            case '.doc':
                // 对于老版本的 .doc 文件，mammoth 也可以处理
                const docResult = await mammoth.extractRawText({ path: filePath });
                return docResult.value;
            default:
                // 对于其他文件类型，尝试读取为文本
                return await fs.readFile(filePath, 'utf8');
        }
    } catch (error) {
        console.error('文件读取失败:', error);
        throw new Error(`无法读取文件: ${filePath}`);
    }
}

module.exports = {
    extractTextFromFile
};