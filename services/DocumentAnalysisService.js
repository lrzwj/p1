//只服务于DiagnosisService
class DocumentAnalysisService {
    /**
     * 分析上传的文档
     */
    async analyzeUploadedDocuments(uploadedFiles, referenceStandard, industryType) {
        const analysisResults = [];
        
        for (const file of uploadedFiles) {
            try {
                const content = await this.extractDocumentContent(file);
                const analysis = {
                    fileName: file.name || file.originalname,
                    fileType: this.getFileType(file.name || file.originalname),
                    content: content,
                    uploadTime: new Date().toISOString(),
                    analysis: this.getFallbackAnalysis(file.name || file.originalname)
                };
                analysisResults.push(analysis);
            } catch (error) {
                console.error(`文档分析失败: ${file.name}`, error);
            }
        }
        
        return analysisResults;
    }

    /**
     * 提取文档内容
     */
    async extractDocumentContent(file) {
        return `文档：${file.name || file.originalname}\n类型：${this.getFileType(file.name || file.originalname)}\n上传时间：${new Date().toISOString()}`;
    }

    /**
     * 获取文件类型
     */
    getFileType(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const typeMap = {
            'pdf': 'PDF文档',
            'doc': 'Word文档',
            'docx': 'Word文档',
            'xls': 'Excel表格',
            'xlsx': 'Excel表格',
            'ppt': 'PowerPoint演示',
            'pptx': 'PowerPoint演示'
        };
        return typeMap[extension] || '未知类型';
    }

    /**
     * 获取备用分析结果
     */
    getFallbackAnalysis(fileName) {
        return {
            documentType: '未识别',
            category: '其他',
            completenessScore: 50,
            complianceScore: 50,
            qualityGrade: 'C',
            missingElements: ['需要进一步分析'],
            improvements: ['建议人工审核']
        };
    }
}

module.exports = DocumentAnalysisService;