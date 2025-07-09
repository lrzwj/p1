const express = require('express');
const User = require('../models/User');
const router = express.Router();

// 登录接口
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }
        
        // 查找用户
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
        
        // 验证密码
        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
        
        // 更新最后登录时间
        await user.updateLastLogin();
        
        // 设置会话
        req.session.user = user.toSafeJSON();
        
        res.json({
            success: true,
            message: '登录成功',
            user: user.toSafeJSON()
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
});

// 注册接口（可选）
router.post('/register', async (req, res) => {
    try {
        const { username, password, email, role } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }
        
        // 检查用户是否已存在
        const existingUser = await User.findByUsername(username);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: '用户名已存在'
            });
        }
        
        // 创建新用户
        const newUser = await User.create({
            username,
            password,
            email,
            role: role || 'user'
        });
        
        res.json({
            success: true,
            message: '注册成功',
            user: newUser.toSafeJSON()
        });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
});

// 登出接口
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: '登出失败'
            });
        }
        res.json({
            success: true,
            message: '登出成功'
        });
    });
});

// 检查登录状态
router.get('/check', (req, res) => {
    if (req.session.user) {
        res.json({
            success: true,
            user: req.session.user
        });
    } else {
        res.status(401).json({
            success: false,
            message: '未登录'
        });
    }
});

// 获取用户列表（仅管理员）
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await User.findAll();
        res.json({
            success: true,
            users: users.map(user => user.toSafeJSON())
        });
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 认证中间件
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({
            success: false,
            message: '需要登录'
        });
    }
}

// 管理员权限中间件
function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: '需要管理员权限'
        });
    }
}

module.exports = {
    router,
    requireAuth,
    requireAdmin
};