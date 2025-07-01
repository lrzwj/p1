//只服务于DiagnosisService
class FrameworkService {
    /**
     * 获取标准框架
     */
    getStandardFramework(referenceStandard, industryType = 'manufacturing') {
        const frameworks = {
            'ISO 9001:2015': {
                categories: this.getIndustrySpecificCategories(referenceStandard, industryType)
            },
            'ISO 14001:2015': {
                categories: this.getIndustrySpecificCategories(referenceStandard, industryType)
            }
        };
        
        return frameworks[referenceStandard] || frameworks['ISO 9001:2015'];
    }

    /**
     * 获取行业特定的类别要求
     */
    getIndustrySpecificCategories(referenceStandard, industryType) {
        const baseCategories = {
            'ISO 9001:2015': [
                { name: '组织环境', required: true, documents: ['组织架构', '相关方需求'] },
                { name: '领导作用', required: true, documents: ['质量方针', '质量目标'] },
                { name: '策划', required: true, documents: ['风险评估', '质量计划'] },
                { name: '支持', required: true, documents: ['资源管理', '能力管理'] },
                { name: '运行', required: true, documents: ['过程控制', '产品控制'] },
                { name: '绩效评价', required: true, documents: ['监视测量', '内审程序'] },
                { name: '改进', required: true, documents: ['不合格控制', '持续改进'] }
            ]
        };

        const industrySpecific = {
            'manufacturing': ['生产控制程序', '设备维护记录'],
            'service': ['服务交付程序', '客户满意度调查'],
            'technology': ['软件开发流程', '技术文档管理'],
            'healthcare': ['医疗质量控制', '患者安全程序'],
            'food': ['HACCP计划', '食品安全控制']
        };

        const categories = baseCategories[referenceStandard] || baseCategories['ISO 9001:2015'];
        
        if (industrySpecific[industryType]) {
            const operationCategory = categories.find(cat => cat.name === '运行');
            if (operationCategory) {
                operationCategory.documents.push(...industrySpecific[industryType]);
            }
        }

        return categories;
    }

    /**
     * 获取备用框架分析结果
     */
    getFallbackFrameworkAnalysis(referenceStandard, industryType) {
        const standardFramework = this.getStandardFramework(referenceStandard, industryType);
        return {
            enhancedCategories: standardFramework.categories.map(category => ({
                ...category,
                aiEnhanced: false,
                confidence: 0.5,
                suggestions: ['AI分析不可用，使用基础框架']
            })),
            recommendations: [
                '建议检查网络连接后重新尝试AI增强分析',
                '当前使用基础框架进行诊断',
                '如需更详细分析，请稍后重试'
            ],
            analysisMethod: 'fallback',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = FrameworkService;