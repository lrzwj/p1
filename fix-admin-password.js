const { pool } = require('./config/mysql');
const bcrypt = require('bcrypt');

async function fixAdminPassword() {
    try {
        console.log('=== 修复admin用户密码 ===');
        
        // 生成新的密码哈希
        const newPassword = 'admin';
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        console.log('新密码哈希生成成功');
        
        // 更新数据库中的admin用户密码
        const [result] = await pool.execute(
            'UPDATE users SET password = ? WHERE username = ?',
            [hashedPassword, 'admin']
        );
        
        console.log('密码更新结果:', result.affectedRows, '行受影响');
        
        // 验证修复结果
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            ['admin']
        );
        
        if (rows.length > 0) {
            const user = rows[0];
            const isValid = await bcrypt.compare('admin', user.password);
            console.log('修复后密码验证结果:', isValid);
            
            if (isValid) {
                console.log('✅ admin用户密码修复成功！现在可以使用 admin/admin 登录了');
            } else {
                console.log('❌ 密码修复失败，请检查');
            }
        }
        
    } catch (error) {
        console.error('修复失败:', error);
    } finally {
        process.exit(0);
    }
}

fixAdminPassword();