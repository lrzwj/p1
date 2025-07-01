const express = require('express'); // 添加这行
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs'); // 添加文件系统模块

// 确保uploads目录存在
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // 处理中文文件名
        let originalname = file.originalname;
        
        try {
            // 使用Buffer转换处理编码问题
            originalname = Buffer.from(originalname, 'latin1').toString('utf8');
        } catch (e) {
            try {
                originalname = decodeURIComponent(escape(originalname));
            } catch (e2) {
                // 如果都失败，使用时间戳作为文件名
                const ext = path.extname(file.originalname);
                originalname = `document_${Date.now()}${ext}`;
            }
        }
        
        cb(null, Date.now() + '-' + originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB限制
    },
    fileFilter: function (req, file, cb) {
        console.log('检查文件类型:', file.originalname); // 添加日志
        
        // 允许的文件类型
        const allowedTypes = /\.(doc|docx|pdf|txt)$/i;
        if (allowedTypes.test(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error('只支持 DOC, DOCX, PDF, TXT 文件格式'));
        }
    }
});

// 设置中间件
function setupServer(app) {
    app.use(cors());
    app.use(bodyParser.json({ limit: '50mb' })); // 增加限制
    app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
    
    // 静态文件服务
    app.use(express.static(path.join(__dirname, '../')));
    
    // 错误处理中间件
    app.use((error, req, res, next) => {
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: '文件大小超过10MB限制'
                });
            }
        }
        
        console.error('服务器错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    });
}

module.exports = {
    setupServer,
    upload
};