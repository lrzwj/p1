const express = require('express');
const router = express.Router();
const { upload } = require('../config/server');

// 文件上传API
router.post('/upload', upload.array('files'), (req, res) => {
    try {
        const files = req.files.map(file => ({
            name: file.originalname,
            size: file.size,
            path: file.path
        }));
        res.json({ success: true, files });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 文档诊断API
router.post('/diagnose', (req, res) => {
    const { referenceStandard, diagnosisDepth, files } = req.body;
    
    // 模拟诊断过程
    setTimeout(() => {
        // 生成随机诊断结果
        const completeness = Math.floor(Math.random() * 40) + 60; // 60-100%
        const health = Math.floor(Math.random() * 30) + 70; // 70-100%
        
        // 模拟缺失文档
        const missingDocuments = [
            '质量目标管理程序',
            '供应商评估管理规范',
            '产品可追溯性管理办法',
            '不合格品控制程序'
        ];
        
        // 模拟内容问题
        const contentIssues = [
            '质量手册缺少对"组织环境"的描述',
            '管理评审程序未包含"风险与机遇"的评估',
            '内审程序未明确规定审核频次'
        ];
        
        res.json({
            success: true,
            result: {
                completeness,
                health,
                missingDocuments,
                contentIssues
            }
        });
    }, 2000); // 模拟2秒的处理时间
});

module.exports = router;