const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

// 简化的文档内容提取（只负责提取文本）
async function extractTextFromFile(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        
        switch (ext) {
            case '.txt':
                return await fs.readFile(filePath, 'utf8');
            case '.docx':
                const result = await mammoth.extractRawText({ path: filePath });
                return result.value;
            case '.doc':
                const docResult = await mammoth.extractRawText({ path: filePath });
                return docResult.value;
            case '.pdf':
                const pdfBuffer = await fs.readFile(filePath);
                const pdfData = await pdfParse(pdfBuffer);
                return pdfData.text;
            default:
                try {
                    return await fs.readFile(filePath, 'utf8');
                } catch {
                    return '';
                }
        }
    } catch (error) {
        console.error('文件读取失败:', error);
        return '';
    }
}

module.exports = {
    extractTextFromFile
};