const { pool } = require('../config/mysql');
const bcrypt = require('bcrypt');

class User {
    constructor(data) {
        this.id = data.id;
        this.username = data.username;
        this.password = data.password;
        this.role = data.role;
        this.email = data.email;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.last_login = data.last_login;
        this.is_active = data.is_active;
    }
    
    // 根据用户名查找用户
    static async findByUsername(username) {
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
                [username]
            );
            
            if (rows.length > 0) {
                return new User(rows[0]);
            }
            return null;
        } catch (error) {
            console.error('查找用户失败:', error);
            throw error;
        }
    }
    
    // 根据ID查找用户
    static async findById(id) {
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
                [id]
            );
            
            if (rows.length > 0) {
                return new User(rows[0]);
            }
            return null;
        } catch (error) {
            console.error('查找用户失败:', error);
            throw error;
        }
    }
    
    // 验证密码
    async validatePassword(password) {
        try {
            return await bcrypt.compare(password, this.password);
        } catch (error) {
            console.error('密码验证失败:', error);
            return false;
        }
    }
    
    // 更新最后登录时间
    async updateLastLogin() {
        try {
            await pool.execute(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [this.id]
            );
        } catch (error) {
            console.error('更新登录时间失败:', error);
        }
    }
    
    // 创建新用户
    static async create(userData) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            
            const [result] = await pool.execute(
                'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
                [userData.username, hashedPassword, userData.role || 'user', userData.email]
            );
            
            return await User.findById(result.insertId);
        } catch (error) {
            console.error('创建用户失败:', error);
            throw error;
        }
    }
    
    // 获取所有用户
    static async findAll() {
        try {
            const [rows] = await pool.execute(
                'SELECT id, username, role, email, created_at, last_login, is_active FROM users ORDER BY created_at DESC'
            );
            
            return rows.map(row => new User(row));
        } catch (error) {
            console.error('获取用户列表失败:', error);
            throw error;
        }
    }
    
    // 转换为安全的JSON对象（不包含密码）
    toSafeJSON() {
        return {
            id: this.id,
            username: this.username,
            role: this.role,
            email: this.email,
            created_at: this.created_at,
            last_login: this.last_login,
            is_active: this.is_active
        };
    }
}

module.exports = User;