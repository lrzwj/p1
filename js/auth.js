// 认证相关功能
class AuthManager {
    constructor() {
        this.user = null;
        this.checkLoginStatus();
    }
    
    // 检查登录状态
    async checkLoginStatus() {
        try {
            const response = await fetch('/api/auth/check');
            const data = await response.json();
            
            if (data.success) {
                this.user = data.user;
                this.updateUI();
                this.updatePermissions();
            } else {
                // 未登录，跳转到登录页面
                if (window.location.pathname !== '/login.html') {
                    window.location.href = '/login.html';
                }
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            // 跳转到登录页面
            if (window.location.pathname !== '/login.html') {
                window.location.href = '/login.html';
            }
        }
    }
    
    // 检查用户是否为管理员
    isAdmin() {
        return this.user && this.user.role === 'admin';
    }
    
    // 检查用户是否有权限访问某个功能
    hasPermission(feature) {
        if (!this.user) return false;
        
        switch (feature) {
            case 'knowledge-graph':
                return this.isAdmin();
            default:
                return true; // 其他功能默认都可以访问
        }
    }
    
    // 更新权限相关的UI显示
    updatePermissions() {
        // 知识图谱菜单项权限控制
        const knowledgeMenuItem = document.querySelector('a[href="#knowledge"]');
        if (knowledgeMenuItem) {
            const menuItem = knowledgeMenuItem.parentElement;
            if (this.hasPermission('knowledge-graph')) {
                menuItem.style.display = 'block';
            } else {
                menuItem.style.display = 'none';
                // 如果当前正在查看知识图谱页面，跳转到首页
                if (document.getElementById('knowledge').classList.contains('active')) {
                    navigateToPage('dashboard');
                }
            }
        }
        
        // 首页知识图谱相关内容权限控制
        const knowledgeStatusCard = document.querySelector('.status-card');
        if (knowledgeStatusCard && !this.hasPermission('knowledge-graph')) {
            knowledgeStatusCard.style.display = 'none';
        }
    }
    
    // 登出
    async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.user = null;
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('登出失败:', error);
        }
    }
    
    // 更新UI显示用户信息
    updateUI() {
        if (this.user) {
            // 在页面上显示用户信息和登出按钮
            this.addUserInfo();
        }
    }
    
    // 添加用户信息到页面
    addUserInfo() {
        // 检查是否已经添加过用户信息
        if (document.getElementById('userInfo')) {
            return;
        }
        
        const roleText = this.isAdmin() ? '管理员' : '普通用户';
        const userInfoHtml = `
            <div id="userInfo" style="position: fixed; top: 20px; right: 20px; background: white; padding: 10px 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000;">
                <span style="margin-right: 10px; color: #333;">欢迎，${this.user.username} (${roleText})</span>
                <button onclick="authManager.logout()" style="background: #dc2626; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    <i class='bx bx-log-out'></i> 登出
                </button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', userInfoHtml);
    }
}

// 创建全局认证管理器实例
const authManager = new AuthManager();