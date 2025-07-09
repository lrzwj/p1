const { pool } = require('./config/mysql');
const bcrypt = require('bcrypt');
const User = require('./models/User');

async function testLogin() {
    try {
        console.log('=== 测试数据库连接和用户数据 ===');
        
        // 1. 直接查询数据库中的admin用户
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            ['admin']
        );
        
        console.log('数据库中的admin用户数据:');
        if (rows.length > 0) {
            const user = rows[0];
            console.log({
                id: user.id,
                username: user.username,
                role: user.role,
                email: user.email,
                is_active: user.is_active,
                password_hash: user.password.substring(0, 20) + '...' // 只显示前20个字符
            });
            
            // 2. 测试密码验证
            console.log('\n=== 测试密码验证 ===');
            const isValid = await bcrypt.compare('admin', user.password);
            console.log('密码 "admin" 验证结果:', isValid);
            
            // 3. 使用User模型测试
            console.log('\n=== 使用User模型测试 ===');
            const userModel = await User.findByUsername('admin');
            if (userModel) {
                console.log('User.findByUsername 成功找到用户');
                const modelValidation = await userModel.validatePassword('admin');
                console.log('User.validatePassword 验证结果:', modelValidation);
            } else {
                console.log('User.findByUsername 未找到用户');
            }
            
        } else {
            console.log('数据库中没有找到admin用户！');
            
            // 手动创建admin用户
            console.log('\n=== 手动创建admin用户 ===');
            const hashedPassword = await bcrypt.hash('admin', 10);
            await pool.execute(
                'INSERT INTO users (username, password, role, email, is_active) VALUES (?, ?, ?, ?, ?)',
                ['admin', hashedPassword, 'admin', 'admin@system.com', true]
            );
            console.log('admin用户创建成功！');
        }
        
    } catch (error) {
        console.error('测试失败:', error);
    } finally {
        process.exit(0);
    }
}

testLogin();