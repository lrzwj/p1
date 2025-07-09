const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const iconv = require('iconv-lite'); // 需要安装这个包

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // 彻底解决中文文件名编码问题
        let originalname = file.originalname;
        
        // 方法1：使用iconv-lite处理编码
        try {
            if (iconv.encodingExists('utf8')) {
                originalname = iconv.decode(Buffer.from(originalname, 'binary'), 'utf8');
            }
        } catch (e) {
            // 方法2：使用Buffer转换
            try {
                originalname = Buffer.from(originalname, 'latin1').toString('utf8');
            } catch (e2) {
                // 方法3：URL解码
                try {
                    originalname = decodeURIComponent(escape(originalname));
                } catch (e3) {
                    // 如果都失败，使用时间戳作为文件名
                    const ext = path.extname(file.originalname);
                    originalname = `document_${Date.now()}${ext}`;
                }
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
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    
    // 添加会话支持
    app.use(session({
        secret: 'your-secret-key-here', // 在生产环境中应该使用环境变量
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // 在生产环境中如果使用HTTPS应设为true
            maxAge: 24 * 60 * 60 * 1000 // 24小时
        }
    }));
    
    // 静态文件服务
    app.use(express.static(path.join(__dirname, '../')));
}

module.exports = {
    setupServer,
    upload
};