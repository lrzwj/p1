// 主文件 - 导航和基础功能
document.addEventListener('DOMContentLoaded', function() {
    // 导航菜单切换
    const navLinks = document.querySelectorAll('.sidebar a');
    const panels = document.querySelectorAll('.panel');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            
            // 更新活动菜单项
            document.querySelectorAll('.sidebar li').forEach(item => {
                item.classList.remove('active');
            });
            this.parentElement.classList.add('active');
            
            // 显示对应面板
            panels.forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 步骤导航
    const nextButtons = document.querySelectorAll('.next-step');
    const prevButtons = document.querySelectorAll('.prev-step');

    nextButtons.forEach(button => {
        button.addEventListener('click', function() {
            const currentStep = this.closest('.step');
            const nextStep = currentStep.nextElementSibling;
            
            if (nextStep) {
                currentStep.classList.remove('active');
                nextStep.classList.add('active');
                
                // 更新进度指示器
                const currentStepNumber = Array.from(document.querySelectorAll('.step')).indexOf(currentStep) + 1;
                const nextStepNumber = currentStepNumber + 1;
                
                document.querySelectorAll('.step-progress-item').forEach(item => {
                    if (parseInt(item.getAttribute('data-step')) === nextStepNumber) {
                        item.classList.add('active');
                    }
                });
            }
        });
    });

    prevButtons.forEach(button => {
        button.addEventListener('click', function() {
            const currentStep = this.closest('.step');
            const prevStep = currentStep.previousElementSibling;
            
            if (prevStep) {
                currentStep.classList.remove('active');
                prevStep.classList.add('active');
                
                // 更新进度指示器
                const currentStepNumber = Array.from(document.querySelectorAll('.step')).indexOf(currentStep) + 1;
                
                document.querySelectorAll('.step-progress-item').forEach(item => {
                    if (parseInt(item.getAttribute('data-step')) === currentStepNumber) {
                        item.classList.remove('active');
                    }
                });
            }
        });
    });

    // 知识图谱选项卡切换
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 移除所有按钮的active类
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // 添加当前按钮的active类
            this.classList.add('active');
            
            // 隐藏所有选项卡内容
            tabPanes.forEach(pane => pane.classList.remove('active'));
            // 显示目标选项卡内容
            const targetPane = document.getElementById(targetTab);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });

    
});

// 页面导航函数
function navigateToPage(pageId) {
    // 更新活动菜单项
    document.querySelectorAll('.sidebar li').forEach(item => {
        item.classList.remove('active');
    });
    
    // 找到对应的菜单项并激活
    const targetLink = document.querySelector(`a[href="#${pageId}"]`);
    if (targetLink) {
        targetLink.parentElement.classList.add('active');
    }
    
    // 显示对应面板
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => {
        panel.classList.remove('active');
    });
    
    const targetPanel = document.getElementById(pageId);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }
}

// 初始化诊断管理器
let diagnosisManager;
if (typeof DiagnosisManager !== 'undefined') {
    diagnosisManager = new DiagnosisManager();
    console.log('DiagnosisManager initialized');
} else {
    console.warn('DiagnosisManager class not found');
}