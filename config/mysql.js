const mysql = require('mysql2/promise');

// MySQL连接配置
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'document_system',
    charset: 'utf8mb4'
};

// 创建连接池
const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 测试数据库连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('MySQL数据库连接成功');
        connection.release();
        return true;
    } catch (error) {
        console.error('MySQL数据库连接失败:', error);
        return false;
    }
}

// 初始化数据库表
async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // 创建用户表
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        
        await connection.execute(createUsersTable);
        console.log('用户表创建成功');
        
        // 检查是否存在管理员用户
        const [rows] = await connection.execute(
            'SELECT COUNT(*) as count FROM users WHERE username = ?',
            ['admin']
        );
        
        // 如果不存在管理员用户，创建一个
        if (rows[0].count === 0) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('admin', 10);
            
            await connection.execute(
                'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
                ['admin', hashedPassword, 'admin', 'admin@system.com']
            );
            console.log('默认管理员用户创建成功');
        }
        
        connection.release();
        return true;
    } catch (error) {
        console.error('数据库初始化失败:', error);
        return false;
    }
}

module.exports = {
    pool,
    testConnection,
    initDatabase
};