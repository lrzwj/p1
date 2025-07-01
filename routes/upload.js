const express = require('express'); // 添加这行
const multer = require('multer');
const path = require('path');
const DiagnosisService = require('../services/DiagnosisService');

const router = express.Router();
const diagnosisService = new DiagnosisService();
const { upload } = require('../config/server');

// 文件上传API - 修改路由路径
router.post('/', upload.array('files'), (req, res) => {
    try {
        console.log('收到文件上传请求:', req.files); // 添加日志
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: '没有收到文件' 
            });
        }
        
        const files = req.files.map(file => {
            // 从保存的文件名中提取处理后的原始文件名
            let displayName = file.filename;
            // 移除时间戳前缀（格式：时间戳-文件名）
            const dashIndex = displayName.indexOf('-');
            if (dashIndex > 0) {
                displayName = displayName.substring(dashIndex + 1);
            }
            
            return {
                name: displayName, // 使用处理后的文件名
                originalName: file.originalname, // 保留原始文件名用于调试
                size: file.size,
                path: file.path,
                filename: file.filename // 完整的保存文件名
            };
        });
        
        console.log('处理的文件:', files); // 添加日志
        res.json({ success: true, files });
    } catch (error) {
        console.error('文件上传错误:', error); // 添加日志
        res.status(500).json({ success: false, message: error.message });
    }
});

// 文档诊断API - 使用新的诊断服务
router.post('/diagnose', async (req, res) => {
    try {
        const { referenceStandard, diagnosisDepth, enterpriseId } = req.body;
        
        // 获取已上传的文件信息
        const uploadedFiles = req.files || [];
        
        // 调用诊断服务
        const diagnosisResult = await diagnosisService.diagnoseDocumentSystem(
            enterpriseId || 'default_enterprise',
            referenceStandard,
            diagnosisDepth,
            uploadedFiles
        );
        
        res.json(diagnosisResult);
    } catch (error) {
        console.error('诊断API错误:', error);
        res.status(500).json({
            success: false,
            error: '诊断服务暂时不可用，请稍后重试'
        });
    }
});

// 增强版诊断API
router.post('/diagnose-enhanced', async (req, res) => {
    try {
        const { 
            enterpriseId = 'default', 
            industryType = 'manufacturing',  // 新增：行业类型参数
            referenceStandard = 'ISO 9001:2015', 
            diagnosisDepth = '基础分析',
            useAIEnhancement = false,
            uploadedFiles = [] // 从请求体中获取文件信息
        } = req.body;
        
        // 使用已存在的diagnosisService实例，而不是创建新的
        let result;
        if (useAIEnhancement) {
            // 使用Deepseek增强诊断
            result = await diagnosisService.diagnoseDocumentSystemEnhanced(
                enterpriseId, 
                industryType,  // 新增：传递行业类型
                referenceStandard, 
                diagnosisDepth, 
                uploadedFiles // 传递正确的文件信息
            );
        } else {
            // 使用基础诊断
            result = await diagnosisService.diagnoseDocumentSystem(
                enterpriseId, 
                industryType,  // 新增：传递行业类型
                referenceStandard, 
                diagnosisDepth, 
                uploadedFiles // 传递正确的文件信息
            );
        }
        
        res.json(result);
    } catch (error) {
        console.error('诊断失败:', error);
        res.status(500).json({
            success: false,
            error: '诊断服务暂时不可用，请稍后重试'
        });
    }
});

// 导出缺失文档清单API
router.get('/export-missing-list', async (req, res) => {
    try {
        const { enterpriseId, referenceStandard, diagnosisDepth } = req.query;
        
        // 重新执行诊断获取缺失文档
        const diagnosisResult = await diagnosisService.diagnoseDocumentSystem(
            enterpriseId || 'default_enterprise',
            referenceStandard,
            diagnosisDepth
        );
        
        if (diagnosisResult.success) {
            const csvContent = diagnosisService.exportMissingDocumentsList(
                diagnosisResult.result.missingDocuments
            );
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="missing-documents.csv"');
            res.send('\uFEFF' + csvContent); // 添加BOM以支持中文
        } else {
            res.status(500).json({ error: '导出失败' });
        }
    } catch (error) {
        console.error('导出清单错误:', error);
        res.status(500).json({ error: '导出服务暂时不可用' });
    }
});

module.exports = router;