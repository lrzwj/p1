const express = require('express'); // 添加这行！
const router = express.Router();
const { upload } = require('../config/server');
const { extractTextFromFile } = require('../utils/fileUtils');
const { extractEntitiesAndRelations } = require('../services/TripleExtractor');

// 去重和合并三元组
function deduplicateAndMergeTriples(triples) {
    const uniqueTriples = [];
    const seen = new Set();
    
    for (const triple of triples) {
        const key = `${triple.subject}-${triple.predicate}-${triple.object}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueTriples.push(triple);
        }
    }
    
    return uniqueTriples;
}

// 生成文档分析报告
function generateDocumentAnalysisReport(fileResults, uniqueTriples) {
    const entityTypes = {};
    const relationTypes = {};
    
    // 统计实体类型
    uniqueTriples.forEach(triple => {
        entityTypes[triple.subject_type] = (entityTypes[triple.subject_type] || 0) + 1;
        entityTypes[triple.object_type] = (entityTypes[triple.object_type] || 0) + 1;
        relationTypes[triple.predicate] = (relationTypes[triple.predicate] || 0) + 1;
    });
    
    return {
        totalDocuments: fileResults.length,
        totalTriples: uniqueTriples.length,
        entityTypeDistribution: entityTypes,
        relationTypeDistribution: relationTypes,
        averageConfidence: uniqueTriples.length > 0 ? 
            uniqueTriples.reduce((sum, t) => sum + t.confidence, 0) / uniqueTriples.length : 0,
        documentSummary: fileResults.map(file => ({
            fileName: file.fileName,
            tripleCount: file.tripleCount
        }))
    };
}

// 添加缺失的文本三元组抽取API
router.post('/extract-triples', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || text.trim() === '') {
            return res.status(400).json({
                success: false,
                message: '请提供要抽取的文本内容'
            });
        }
        
        // 使用TripleExtractor服务抽取三元组
        const result = await extractEntitiesAndRelations(text);
        
        if (result.success) {
            res.json({
                success: true,
                message: `成功抽取 ${result.triples.length} 个三元组`,
                triples: result.triples
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.message || '三元组抽取失败'
            });
        }
        
    } catch (error) {
        console.error('文本三元组抽取失败:', error);
        res.status(500).json({
            success: false,
            message: '三元组抽取失败',
            error: error.message
        });
    }
});

// 多文档三元组抽取API
router.post('/extract-triples-from-files', upload.array('files'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: '请上传至少一个文档文件' 
        });
    }
    
    try {
        // 存储所有文档的三元组结果
        const allTriples = [];
        const fileResults = [];
        let processedFiles = 0;
        const totalFiles = req.files.length;
        
        // 处理每个文件
        for (const file of req.files) {
            try {
                // 读取文件内容
                const fileContent = await extractTextFromFile(file.path);
                
                // 使用DeepSeek进行三元组抽取
                const extractionResult = await extractEntitiesAndRelations(fileContent);
                
                // 添加文件信息到结果中
                fileResults.push({
                    fileName: file.originalname,
                    triples: extractionResult.triples || [],
                    tripleCount: (extractionResult.triples || []).length,
                    fileContent: fileContent.substring(0, 200) + (fileContent.length > 200 ? '...' : '')
                });
                
                // 合并三元组结果
                if (extractionResult.triples) {
                    allTriples.push(...extractionResult.triples);
                }
                
                processedFiles++;
                console.log(`已处理文件 ${processedFiles}/${totalFiles}: ${file.originalname}`);
            } catch (fileError) {
                console.error(`处理文件 ${file.originalname} 失败:`, fileError);
                // 继续处理其他文件
                fileResults.push({
                    fileName: file.originalname,
                    triples: [],
                    tripleCount: 0,
                    error: fileError.message
                });
                processedFiles++;
            }
        }
        
        // 去重和合并三元组
        const uniqueTriples = deduplicateAndMergeTriples(allTriples);
        
        // 生成分析报告
        const analysisReport = generateDocumentAnalysisReport(fileResults, uniqueTriples);
        
        res.json({
            success: true,
            message: `成功处理 ${totalFiles} 个文档`,
            data: {
                totalFiles: totalFiles,
                totalTriples: allTriples.length,
                uniqueTriples: uniqueTriples.length,
                fileResults: fileResults,
                analysisReport: analysisReport,
                triples: uniqueTriples
            }
        });
        
    } catch (error) {
        console.error('多文档三元组抽取失败:', error);
        res.status(500).json({
            success: false,
            message: '文档处理失败',
            error: error.message
        });
    }
});

module.exports = router;