const { driver } = require('../config/database');
const axios = require('axios');

class AnalysisService {
    constructor() {
        this.DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
        this.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    }

    // 分析业务描述
    async analyzeBusinessDescription(description, industry, standard) {
        try {
            // 1. 查询相关知识
            const relevantKnowledge = await this.queryRelevantKnowledge(industry, standard);

            // 2. 查询文档知识
            const documentKnowledge = await this.queryDocumentKnowledge(industry, standard, {});

            // 3. 构建增强的提示词
            const prompt = `基于以下业务描述和知识图谱信息，分析企业的组织结构、业务流程和文档需求：

业务描述：${description}
行业类型：${industry}
参照标准：${standard}

相关知识：
标准要求：${JSON.stringify(relevantKnowledge.standards, null, 2)}
行业实践：${JSON.stringify(relevantKnowledge.practices, null, 2)}
文档类型：${JSON.stringify(relevantKnowledge.documentTypes, null, 2)}

现有文档参考：
${documentKnowledge.existingDocs.map(d => `- ${d.name}: ${d.description}`).join('\n')}

请分析并以JSON格式返回：
{
  "departments": ["部门列表"],
  "products": ["产品/服务列表"],
  "processes": [
    {
      "name": "流程名称",
      "description": "流程描述",
      "owner": "责任部门"
    }
  ],
  "risks": ["主要风险点"],
  "requirements": ["文档要求列表"]
}`;

            // 第45行附近 - analyzeBusinessDescription方法中
            const response = await axios.post(this.DEEPSEEK_API_URL, {
                model: "deepseek-chat",
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.7,
                max_tokens: 2000
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
                },
                timeout: 30000
            });

            const content = response.data.choices[0].message.content;

            // 尝试解析JSON
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            } catch (parseError) {
                console.warn('AI返回内容不是有效JSON，使用默认解析');
            }

            // 如果JSON解析失败，使用文本解析
            return this.parseBusinessDescriptionText(content, description);

        } catch (error) {
            console.error('AI分析失败，使用本地分析:', error);
            // 降级到本地分析
            return this.analyzeBusinessDescriptionLocally(description, industry, standard);
        }
    }

    // 分析业务描述并构建五层知识图谱（改进版）（prompt不再更改，但会自动把行业层识别出来）
    async analyzeBusinessDescriptionWithLayers(description, industry, standard) {
        try {
            const prompt = `
请基于以下业务描述，按照四层架构进行分析并构建知识图谱：

业务描述：${description}
行业：${industry}
标准：${standard}

请严格按照以下JSON格式返回四层结构化数据：
{
  "standardLayer": {
    "standards": [{"name": "标准名称", "requirements": ["要求列表"]}],
    "regulations": [{"name": "法规名称", "scope": "适用范围"}]
  },
  "enterpriseLayer": {
    "departments": ["部门列表"],
    "products": ["产品服务列表"],
    "organizationStructure": "组织架构描述",
    "enterpriseName": "企业名称（如果能识别出来）"
  },
  "processLayer": {
    "coreProcesses": [{"name": "流程名称", "description": "流程描述", "owner": "责任部门"}],
    "supportProcesses": [{"name": "支持流程", "description": "描述"}]
  },
  "documentLayer": {
    "categories": [{"name": "文档类别", "documents": [{"name": "文档名称", "type": "文档类型"}]}]
  }
}`;

            const response = await axios.post(this.DEEPSEEK_API_URL, {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 3000
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
                }
            });

            const content = response.data.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                try {
                    const layeredData = JSON.parse(jsonMatch[0]);

                    // 提取企业名称
                    const enterpriseName = layeredData.enterpriseLayer?.enterpriseName || null;

                    // 保存到知识图谱并获取企业信息
                    const enterpriseInfo = await this.saveLayeredDataToKnowledgeGraph(
                        layeredData,
                        industry,
                        standard,
                        enterpriseName  // 传递企业名称
                    );

                    // 将企业信息添加到返回数据中
                    layeredData.enterpriseInfo = enterpriseInfo;
                    return layeredData;
                } catch (parseError) {
                    console.error('JSON解析失败:', parseError);
                    console.error('原始JSON内容:', jsonMatch[0]);

                    // 尝试修复常见的JSON格式问题
                    let fixedJson = jsonMatch[0]
                        .replace(/,\s*}/g, '}')
                        .replace(/,\s*]/g, ']')
                        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*):/g, '$1"$2":')
                        .replace(/:s*([a-zA-Z_][a-zA-Z0-9_]*)(\s*[,}])/g, ': "$1"$2')
                        .replace(/"(true|false|null|\d+)"(\s*[,}\]])/g, '$1$2');

                    try {
                        const layeredData = JSON.parse(fixedJson);
                        console.log('JSON修复成功');

                        const enterpriseName = layeredData.enterpriseLayer?.enterpriseName || null;
                        const enterpriseInfo = await this.saveLayeredDataToKnowledgeGraph(
                            layeredData,
                            industry,
                            standard,
                            enterpriseName
                        );

                        layeredData.enterpriseInfo = enterpriseInfo;
                        return layeredData;
                    } catch (secondParseError) {
                        console.error('修复后仍然解析失败:', secondParseError);
                        console.error('修复后的JSON:', fixedJson);

                        // 返回默认结构
                        const defaultData = this.getDefaultLayeredStructure(description, industry, standard);
                        const enterpriseInfo = await this.saveLayeredDataToKnowledgeGraph(
                            defaultData,
                            industry,
                            standard,
                            null
                        );
                        defaultData.enterpriseInfo = enterpriseInfo;
                        return defaultData;
                    }
                }
            }

            throw new Error('无法解析AI返回的JSON数据');
        } catch (error) {
            console.error('五层分析失败:', error);
            throw error;
        }
    }

    // 生成文档框架
    async generateDocumentFramework(analysisResult, industry, standard) {
        try {
            // 1. 查询相似企业的文档框架模板
            const similarFrameworks = await this.querySimilarFrameworks(industry, analysisResult);

            // 2. 查询文档间的依赖关系
            const documentRelations = await this.queryDocumentRelations(standard);

            // 3. 构建增强的提示词
            const prompt = `基于以下分析结果和知识图谱信息，生成详细的文档体系框架：

分析结果：${JSON.stringify(analysisResult, null, 2)}
行业类型：${industry}
参照标准：${standard}

相似企业文档分类参考（按相似度排序）：
${similarFrameworks.map((f, index) =>
                `${index + 1}. 企业：${f.enterpriseName} (相似度: ${(f.similarity * 100).toFixed(1)}%)
` +
                `   部门匹配：${f.matchingDepts}/${f.totalDepts}
` +
                `   文档分类：
${f.documentCategories.map(cat =>
                    `     - ${cat.categoryName}: ${cat.categoryDescription}`
                ).join('\n')}`
            ).join('\n\n')}

文档依赖关系：
${documentRelations.map(r => `- ${r.source} → ${r.target}: ${r.relationship}`).join('\n')}

请参考以上多个相似企业的文档分类，生成适合的文档体系框架，以JSON格式返回，包含以下结构：
{
  "categories": [
    {
      "name": "分类名称",
      "description": "分类说明",
      "documents": [
        {
          "name": "文档名称",
          "description": "文档说明",
          "type": "文档类型",
          "priority": "优先级",
          "source": "来源(知识图谱/标准要求/AI生成)",
          "dependencies": ["依赖的文档列表"]
        }
      ]
    }
  ]
}

请确保框架完整、实用，需符合${standard}标准要求，并考虑使用知识图谱中已有的成熟文档模板。`;

            const response = await axios.post(this.DEEPSEEK_API_URL, {
                model: "deepseek-chat",
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.7,
                max_tokens: 3000
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.DEEPSEEK_API_KEY}`
                },
                timeout: 30000
            });

            const content = response.data.choices[0].message.content;

            // 尝试解析JSON
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            } catch (parseError) {
                console.warn('AI返回内容不是有效JSON，使用默认框架');
            }

            // 如果解析失败，返回默认框架
            return this.generateDefaultFramework(analysisResult, industry, standard);

        } catch (error) {
            console.error('AI生成框架失败，使用默认框架:', error);
            return this.generateDefaultFramework(analysisResult, industry, standard);
        }
    }

    // 本地业务描述分析
    analyzeBusinessDescriptionLocally(description, industry, standard) {
        const departments = [];
        const products = [];
        const processes = [];

        // 简单的关键词匹配
        const deptKeywords = ['部门', '部', '科', '组', '中心', '办公室'];
        const productKeywords = ['产品', '服务', '系统', '软件', '设备'];
        const processKeywords = ['流程', '过程', '程序', '管理', '控制'];

        // 提取部门
        deptKeywords.forEach(keyword => {
            const regex = new RegExp(`([\u4e00-\u9fa5]+${keyword})`, 'g');
            const matches = description.match(regex);
            if (matches) {
                departments.push(...matches);
            }
        });

        // 提取产品/服务
        productKeywords.forEach(keyword => {
            const regex = new RegExp(`([\u4e00-\u9fa5]+${keyword})`, 'g');
            const matches = description.match(regex);
            if (matches) {
                products.push(...matches);
            }
        });

        // 提取流程
        processKeywords.forEach(keyword => {
            const regex = new RegExp(`([\u4e00-\u9fa5]+${keyword})`, 'g');
            const matches = description.match(regex);
            if (matches) {
                processes.push(...matches);
            }
        });

        return {
            departments: [...new Set(departments)].slice(0, 5),
            products: [...new Set(products)].slice(0, 5),
            processes: [...new Set(processes)].slice(0, 5),
            risks: ['质量风险', '合规风险'],
            requirements: ['文档控制', '记录管理']
        };
    }

    // 生成默认框架
    generateDefaultFramework(analysisResult, industry, standard) {
        const framework = {
            categories: [
                {
                    name: '质量手册',
                    description: '企业质量管理体系的纲领性文件',
                    documents: [
                        {
                            name: '质量手册',
                            description: '描述质量管理体系的总体要求',
                            type: 'manual',
                            priority: 'high'
                        }
                    ]
                },
                {
                    name: '程序文件',
                    description: '规定各项活动的具体程序',
                    documents: [
                        {
                            name: '文件控制程序',
                            description: '控制文件的编制、审批、发布和更改',
                            type: 'procedure',
                            priority: 'high'
                        },
                        {
                            name: '记录控制程序',
                            description: '控制质量记录的标识、储存、保护等',
                            type: 'procedure',
                            priority: 'high'
                        }
                    ]
                }
            ]
        };

        // 根据分析结果添加特定文档
        if (analysisResult.departments) {
            analysisResult.departments.forEach(dept => {
                framework.categories[1].documents.push({
                    name: `${dept}作业指导书`,
                    description: `${dept}的具体操作指导`,
                    type: 'instruction',
                    priority: 'medium'
                });
            });
        }

        return framework;
    }

    // 从知识图谱查询相关知识
    async queryRelevantKnowledge(industry, standard) {
        try {
            // 查询标准相关信息
            const standardQuery = `
                MATCH (s:Standard {name: $standard})-[:REQUIRES]->(req:Requirement)
                RETURN s.name as standardName
            `;

            // 替换原来的 practiceQuery 和 docTypeQuery
            const industryEnterpriseQuery = `
                MATCH (i:Industry {name: $industry})-[:CONTAINS]->(e:Enterprise)
                OPTIONAL MATCH (e)-[:HAS_FRAMEWORK]->(f:DocumentFramework)-[:CONTAINS]->(c:DocumentCategory)
                RETURN e.name as enterpriseName,
                e.departments as departments,
                collect(DISTINCT {
                  categoryName: c.name,
                  categoryDescription: c.description
                 }) as documentCategories
                LIMIT 10
`;

            // 查询通用文档分类
            const commonDocCategoriesQuery = `
                MATCH (c:DocumentCategory)
                WHERE c.name IS NOT NULL
                RETURN c.name as name, c.description as description
                ORDER BY c.name
                LIMIT 15
`;

            // 为每个查询创建独立的session
            const session1 = driver.session();
            const standardResult = await session1.run(standardQuery, { standard });
            await session1.close();

            const session2 = driver.session();
            const industryResult = await session2.run(industryEnterpriseQuery, { industry });
            await session2.close();

            const session3 = driver.session();
            const docCategoryResult = await session3.run(commonDocCategoriesQuery);
            await session3.close();
            // 执行查询



            // 处理结果
            return {
                standards: standardResult.records.map(record => ({
                    name: record.get('name'),
                    requirements: record.get('requirements')
                })),
                industryEnterprises: industryResult.records.map(record => ({
                    enterpriseName: record.get('enterpriseName'),
                    departments: record.get('departments'),
                    documentCategories: record.get('documentCategories')
                })),
                commonDocumentCategories: docCategoryResult.records.map(record => ({
                    name: record.get('name'),
                    description: record.get('description')
                }))
            };


        } catch (error) {
            console.error('查询知识图谱失败:', error);
            return { standards: [], practices: [], documentTypes: [] };
        }
    }

    // 查询相似企业框架的函数
    async querySimilarFrameworks(industry, analysisResult) {
        try {
            const session = driver.session();

            const query = `
                // 1. 匹配同行业的所有Enterprise
                MATCH (i:Industry {name: $industry})-[:CONTAINS]->(e:Enterprise)
                
                // 2. 找到这些企业的DocumentFramework和DocumentCategory
                MATCH (e)-[:HAS_FRAMEWORK]->(f:DocumentFramework)-[:CONTAINS]->(c:DocumentCategory)
                
                // 3. 计算企业相似度（基于部门匹配度）
                WITH e, f, c,
                     size([dept IN e.departments WHERE dept IN $departments]) as matchingDepts,
                     size(e.departments) as totalDepts
                
                // 4. 过滤出有一定相似度的企业
                WHERE matchingDepts > 0 OR totalDepts > 0
                
                // 5. 按企业分组，收集其文档分类
                WITH e, 
                     matchingDepts,
                     totalDepts,
                     (toFloat(matchingDepts) / toFloat(totalDepts + 1)) as similarity,
                     collect({
                         categoryName: c.name,
                         categoryDescription: c.description
                     }) as documentCategories
                
                // 6. 返回多个相似企业的信息
                RETURN 
                    e.name as enterpriseName,
                    e.industry as enterpriseIndustry,
                    e.departments as enterpriseDepartments,
                    similarity,
                    matchingDepts,
                    totalDepts,
                    documentCategories
                
                // 7. 按相似度排序，返回前10个最相似的企业
                ORDER BY similarity DESC, totalDepts DESC
                LIMIT 10
            `;

            const result = await session.run(query, {
                industry,
                departments: analysisResult.departments || []
            });

            await session.close();

            return result.records.map(record => ({
                enterpriseName: record.get('enterpriseName'),
                enterpriseIndustry: record.get('enterpriseIndustry'),
                enterpriseDepartments: record.get('enterpriseDepartments'),
                similarity: record.get('similarity'),
                matchingDepts: record.get('matchingDepts'),
                totalDepts: record.get('totalDepts'),
                documentCategories: record.get('documentCategories')
            }));
        } catch (error) {
            console.error('查询相似框架失败:', error);
            return [];
        }
    }

    // 查询文档依赖关系的函数
    async queryDocumentRelations(standard) {
        try {
            const session = driver.session();

            const query = `
                MATCH (d1:Document)-[r:DEPENDS_ON|REFERENCES]->(d2:Document)
                WHERE d1.standard = $standard OR d2.standard = $standard
                RETURN d1.name as source, d2.name as target, type(r) as relationship
            `;

            const result = await session.run(query, { standard });
            await session.close();

            return result.records.map(record => ({
                source: record.get('source'),
                target: record.get('target'),
                relationship: record.get('relationship')
            }));
        } catch (error) {
            console.error('查询文档关系失败:', error);
            return [];
        }
    }

    // 查询文档知识的函数
    async queryDocumentKnowledge(industry, standard, analysisResult) {
        const session = driver.session();
        try {
            // 查询现有文档
            const existingDocsQuery = `
                MATCH (d:Document)
                WHERE toLower(d.name) CONTAINS toLower($industry)
                   OR toLower(d.name) CONTAINS toLower($standard)
                   OR toLower(d.name) CONTAINS '质量'
                   OR toLower(d.name) CONTAINS '管理'
                RETURN d
                LIMIT 20
            `;

            const existingResult = await session.run(existingDocsQuery, { industry, standard });

            // 查询标准要求的文档
            const requiredDocsQuery = `
                MATCH (s:Standard)-[r]-(d:Document)
                WHERE toLower(s.name) CONTAINS toLower($standard)
                RETURN d, r.type as requirement
                LIMIT 15
            `;

            const requiredResult = await session.run(requiredDocsQuery, { standard });

            // 查询行业通用文档
            const industryDocsQuery = `
                MATCH (d:Document)
                WHERE toLower(d.name) CONTAINS '程序'
                   OR toLower(d.name) CONTAINS '手册'
                   OR toLower(d.name) CONTAINS '指导'
                   OR toLower(d.name) CONTAINS '规范'
                RETURN d
                LIMIT 15
            `;

            const industryResult = await session.run(industryDocsQuery);

            return {
                existingDocs: existingResult.records.map(record => ({
                    name: record.get('d').properties.name,
                    description: record.get('d').properties.description || '',
                    type: record.get('d').labels[0] || 'Document'
                })),
                requiredDocs: requiredResult.records.map(record => ({
                    name: record.get('d').properties.name,
                    requirement: record.get('requirement') || '标准要求',
                    description: record.get('d').properties.description || ''
                })),
                industryDocs: industryResult.records.map(record => ({
                    name: record.get('d').properties.name,
                    purpose: record.get('d').properties.description || '行业通用文档',
                    description: record.get('d').properties.description || ''
                }))
            };
        } catch (error) {
            console.error('查询文档知识失败:', error);
            // 返回默认文档知识
            return {
                existingDocs: [{ name: '质量手册', description: '质量管理体系文件', type: 'Document' }],
                requiredDocs: [{ name: '程序文件', requirement: '标准要求', description: '' }],
                industryDocs: [{ name: '作业指导书', purpose: '操作指导', description: '' }]
            };
        } finally {
            await session.close();
        }
    }

    // 从框架中提取三元组
    extractTriplesFromFramework(framework, analysisResult) {
        const triples = [];

        if (framework.categories) {
            framework.categories.forEach(category => {
                // 添加分类三元组
                triples.push({
                    subject: category.name,
                    predicate: '属于',
                    object: '文档体系',
                    confidence: 0.9
                });

                if (category.documents) {
                    category.documents.forEach(doc => {
                        // 添加文档三元组
                        triples.push({
                            subject: doc.name,
                            predicate: '属于',
                            object: category.name,
                            confidence: 0.9
                        });

                        triples.push({
                            subject: doc.name,
                            predicate: '类型',
                            object: doc.type,
                            confidence: 0.9
                        });

                        if (doc.priority) {
                            triples.push({
                                subject: doc.name,
                                predicate: '优先级',
                                object: doc.priority,
                                confidence: 0.8
                            });
                        }

                        // 添加来源信息
                        if (doc.source) {
                            triples.push({
                                subject: doc.name,
                                predicate: '来源',
                                object: doc.source,
                                confidence: 0.9
                            });
                        }
                    });
                }
            });
        }

        // 添加分析结果相关的三元组
        if (analysisResult.departments) {
            analysisResult.departments.forEach(dept => {
                triples.push({
                    subject: dept,
                    predicate: '负责',
                    object: '文档管理',
                    confidence: 0.8
                });
            });
        }

        // 添加推荐文档的三元组
        if (analysisResult.recommendedDocs) {
            analysisResult.recommendedDocs.forEach(doc => {
                triples.push({
                    subject: doc,
                    predicate: '推荐用于',
                    object: '文档体系建设',
                    confidence: 0.8
                });
            });
        }

        return triples;
    }

    // 文本解析业务描述（辅助方法）
    parseBusinessDescriptionText(content, description) {
        // 简化的文本解析逻辑
        return this.analyzeBusinessDescriptionLocally(description, '', '');
    }

    // 将生成的框架保存到知识图谱
    async saveFrameworkToKnowledgeGraph(frameworkData, enterpriseInfo = null) {
        try {
            const session = driver.session();

            let actualEnterpriseId;
            let actualEnterpriseName = frameworkData.enterpriseName || null;

            // 如果提供了企业信息，使用现有企业节点
            if (enterpriseInfo && enterpriseInfo.enterpriseId) {
                actualEnterpriseId = enterpriseInfo.enterpriseId;
                actualEnterpriseName = enterpriseInfo.enterpriseName;
                console.log(`使用现有企业节点进行框架保存: ${actualEnterpriseName} (ID: ${actualEnterpriseId})`);
            } else {
                // 没有提供企业信息，需要查找或创建企业节点
                if (actualEnterpriseName) {
                    // 有企业名称，先查找是否已存在
                    const existingEnterpriseResult = await session.run(`
                        MATCH (e:Enterprise {name: $enterpriseName})
                        RETURN e.id as id
                    `, {
                        enterpriseName: actualEnterpriseName
                    });

                    if (existingEnterpriseResult.records.length > 0) {
                        // 使用现有企业
                        actualEnterpriseId = existingEnterpriseResult.records[0].get('id');
                        console.log(`找到现有企业节点: ${actualEnterpriseName} (ID: ${actualEnterpriseId})`);
                    } else {
                        // 创建新企业
                        actualEnterpriseId = `enterprise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        await session.run(`
                            CREATE (e:Enterprise {
                                id: $enterpriseId,
                                name: $enterpriseName,
                                industry: $industry,
                                departments: $departments,
                                createdAt: datetime(),
                                lastUpdated: datetime()
                            })
                            RETURN e
                        `, {
                            enterpriseId: actualEnterpriseId,
                            enterpriseName: actualEnterpriseName,
                            industry: frameworkData.industry,
                            departments: frameworkData.departments
                        });
                        console.log(`创建新企业节点: ${actualEnterpriseName} (ID: ${actualEnterpriseId})`);
                    }
                } else {
                    // 没有企业名称，创建匿名企业
                    actualEnterpriseId = `enterprise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    await session.run(`
                        CREATE (e:Enterprise {
                            id: $enterpriseId,
                            name: null,
                            industry: $industry,
                            departments: $departments,
                            createdAt: datetime(),
                            lastUpdated: datetime()
                        })
                        RETURN e
                    `, {
                        enterpriseId: actualEnterpriseId,
                        industry: frameworkData.industry,
                        departments: frameworkData.departments
                    });
                    console.log(`创建匿名企业节点 (ID: ${actualEnterpriseId})`);
                }
            }

            // 创建文档框架节点
            const frameworkId = `framework_${Date.now()}`;
            const createFrameworkQuery = `
                // 匹配企业节点
                MATCH (e:Enterprise {id: $enterpriseId})
                
                // 创建文档框架节点
                CREATE (f:DocumentFramework {
                    id: $frameworkId,
                    createdAt: datetime(),
                    industry: $industry
                })
                
                // 建立企业与文档框架的关系
                CREATE (e)-[:HAS_FRAMEWORK]->(f)
                
                SET e.lastUpdated = datetime()
                RETURN e, f
            `;

            await session.run(createFrameworkQuery, {
                enterpriseId: actualEnterpriseId,
                industry: frameworkData.industry,
                frameworkId: frameworkId
            });

            // 为每个文档类别创建节点
            const categories = frameworkData.framework.categories;
            for (const category of categories) {
                const createCategoryQuery = `
                    MATCH (f:DocumentFramework {id: $frameworkId})
                    CREATE (c:DocumentCategory {
                        name: $categoryName,
                        description: $description
                    })
                    CREATE (f)-[:CONTAINS]->(c)
                    RETURN c
                `;

                await session.run(createCategoryQuery, {
                    frameworkId: frameworkId,
                    categoryName: category.name,
                    description: category.description
                });

                // 为每个文档创建节点
                for (const doc of category.documents) {
                    const createDocQuery = `
                        MATCH (c:DocumentCategory {name: $categoryName})
                        CREATE (d:Document {
                            name: $docName,
                            description: $docDescription,
                            type: 'framework_generated'
                        })
                        CREATE (c)-[:INCLUDES]->(d)
                        RETURN d
                    `;

                    await session.run(createDocQuery, {
                        categoryName: category.name,
                        docName: doc.name,
                        docDescription: doc.description
                    });
                }
            }

            await session.close();
            console.log('框架已保存到知识图谱');
            return actualEnterpriseId;
        } catch (error) {
            console.error('保存框架到知识图谱失败:', error);
            throw error;
        }
    }

    // 数据验证和清理
    validateAndCleanLayeredData(data) {
        // 确保基本结构存在
        const validated = {
            standardLayer: data.standardLayer || { applicableStandards: [], regulations: [], industryRequirements: [] },
            enterpriseLayer: data.enterpriseLayer || { enterprise: {}, organizationalStructure: [], businessUnits: [] },
            processLayer: data.processLayer || { coreProcesses: [], products: [], stakeholders: [], resources: [] },
            documentLayer: data.documentLayer || { documentFramework: {}, documentCategories: [], requiredDocuments: [] },
            crossLayerRelationships: data.crossLayerRelationships || [],
            analysisInsights: data.analysisInsights || {}
        };

        // 清理空值和无效数据
        Object.keys(validated).forEach(layer => {
            if (typeof validated[layer] === 'object' && validated[layer] !== null) {
                Object.keys(validated[layer]).forEach(key => {
                    if (Array.isArray(validated[layer][key])) {
                        validated[layer][key] = validated[layer][key].filter(item =>
                            item && typeof item === 'object' && Object.keys(item).length > 0
                        );
                    }
                });
            }
        });

        return validated;
    }

    // 修复常见JSON格式问题
    fixCommonJsonIssues(content) {
        let fixed = content;

        // 移除可能的markdown代码块标记
        fixed = fixed.replace(/```json\s*/, '').replace(/```\s*$/, '');

        // 修复常见的JSON格式问题
        fixed = fixed.replace(/,\s*}/g, '}'); // 移除对象末尾多余的逗号
        fixed = fixed.replace(/,\s*]/g, ']'); // 移除数组末尾多余的逗号

        // 确保字符串值被正确引用
        fixed = fixed.replace(/:\s*([^"\[\{][^,\}\]]*)/g, (match, value) => {
            const trimmed = value.trim();
            if (trimmed !== 'true' && trimmed !== 'false' && trimmed !== 'null' && !trimmed.match(/^\d+$/)) {
                return `: "${trimmed}"`;
            }
            return match;
        });

        return fixed;
    }

    // 保存五层数据到知识图谱
    async saveLayeredDataToKnowledgeGraph(layeredData, industry, standard, enterpriseName = null) {
        const session = driver.session();

        try {
            // 添加数据验证
            if (!layeredData) {
                console.error('layeredData 为空');
                return null;
            }

            // 确保数据结构完整
            const validatedData = {
                standardLayer: layeredData.standardLayer || { standards: [] },
                enterpriseLayer: layeredData.enterpriseLayer || { departments: [], products: [], organizationStructure: '' },
                processLayer: layeredData.processLayer || { coreProcesses: [], supportProcesses: [] },
                documentLayer: layeredData.documentLayer || { categories: [] }
            };

            console.log('验证后的数据结构:', JSON.stringify(validatedData, null, 2));

            // 1. 创建标准层节点
            for (const std of validatedData.standardLayer.standards) {
                await session.run(`
                    MERGE (s:Standard {name: $name})
                    SET s.industry = $industry, s.requirements = $requirements
                    RETURN s
                `, {
                    name: std.name,
                    industry: industry,
                    requirements: std.requirements
                });
            }

            // 2. 创建行业节点
            await session.run(`
                MERGE (i:Industry {name: $industry})
                SET i.type = $industry,
                    i.lastUpdated = datetime()
                RETURN i
            `, {
                industry: industry
            });

            // 3. 创建或查找企业层节点（基于企业名称去重）
            let enterpriseId;

            if (enterpriseName) {
                // 如果有企业名称，先查找是否已存在
                const existingEnterpriseResult = await session.run(`
                    MATCH (e:Enterprise {name: $enterpriseName})
                    RETURN e.id as id
                `, {
                    enterpriseName: enterpriseName
                });

                if (existingEnterpriseResult.records.length > 0) {
                    // 企业已存在，使用现有企业ID并更新信息
                    enterpriseId = existingEnterpriseResult.records[0].get('id');
                    await session.run(`
                        MATCH (e:Enterprise {name: $enterpriseName})
                        SET e.industry = $industry,
                            e.departments = $departments, 
                            e.products = $products,
                            e.organizationStructure = $orgStructure,
                            e.lastUpdated = datetime()
                        RETURN e
                    `, {
                        enterpriseName: enterpriseName,
                        industry: industry,
                        departments: validatedData.enterpriseLayer.departments,
                        products: validatedData.enterpriseLayer.products,
                        orgStructure: validatedData.enterpriseLayer.organizationStructure
                    });
                    console.log(`使用现有企业节点: ${enterpriseName} (ID: ${enterpriseId})`);
                } else {
                    // 企业不存在，创建新节点
                    enterpriseId = `enterprise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    await session.run(`
                        CREATE (e:Enterprise {
                            id: $enterpriseId,
                            name: $enterpriseName,
                            industry: $industry,
                            departments: $departments, 
                            products: $products,
                            organizationStructure: $orgStructure,
                            createdAt: datetime(),
                            lastUpdated: datetime()
                        })
                        RETURN e
                    `, {
                        enterpriseId: enterpriseId,
                        enterpriseName: enterpriseName,
                        industry: industry,
                        departments: validatedData.enterpriseLayer.departments,
                        products: validatedData.enterpriseLayer.products,
                        orgStructure: validatedData.enterpriseLayer.organizationStructure
                    });
                    console.log(`创建新企业节点: ${enterpriseName} (ID: ${enterpriseId})`);
                }
            } else {
                // 没有企业名称，创建新节点（名称为null）
                enterpriseId = `enterprise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await session.run(`
                    CREATE (e:Enterprise {
                        id: $enterpriseId,
                        name: null,
                        industry: $industry,
                        departments: $departments, 
                        products: $products,
                        organizationStructure: $orgStructure,
                        createdAt: datetime(),
                        lastUpdated: datetime()
                    })
                    RETURN e
                `, {
                    enterpriseId: enterpriseId,
                    industry: industry,
                    departments: validatedData.enterpriseLayer.departments,
                    products: validatedData.enterpriseLayer.products,
                    orgStructure: validatedData.enterpriseLayer.organizationStructure
                });
                console.log(`创建匿名企业节点 (ID: ${enterpriseId})`);
            }

            // 4. 建立标准->行业->企业的关系链
            for (const std of validatedData.standardLayer.standards) {
                // 建立标准与行业的关系
                await session.run(`
                    MATCH (s:Standard {name: $standardName})
                    MATCH (i:Industry {name: $industry})
                    MERGE (s)-[:APPLIES_TO]->(i)
                    RETURN s, i
                `, {
                    standardName: std.name,
                    industry: industry
                });

                // 建立行业与企业的关系
                await session.run(`
                    MATCH (i:Industry {name: $industry})
                    MATCH (e:Enterprise {id: $enterpriseId})
                    MERGE (i)-[:CONTAINS]->(e)
                    RETURN i, e
                `, {
                    industry: industry,
                    enterpriseId: enterpriseId
                });
            }

            // 5. 创建流程层节点
            console.log('保存流程层数据:', JSON.stringify(validatedData.processLayer, null, 2));

            // 保存核心流程
            if (validatedData.processLayer && validatedData.processLayer.coreProcesses && validatedData.processLayer.coreProcesses.length > 0) {
                console.log('核心流程数量:', validatedData.processLayer.coreProcesses.length);
                for (const process of validatedData.processLayer.coreProcesses) {
                    console.log('创建核心流程:', process.name);
                    await session.run(`
                        MATCH (e:Enterprise {id: $enterpriseId})
                        CREATE (p:Process {
                            name: $name,
                            description: $description,
                            owner: $owner,
                            type: 'core'
                        })
                        CREATE (e)-[:HAS_PROCESS]->(p)
                        RETURN p
                    `, {
                        enterpriseId: enterpriseId,
                        name: process.name,
                        description: process.description || '',
                        owner: process.owner || ''
                    });
                }
            } else {
                console.log('警告：没有核心流程数据');
            }

            // 保存支持流程
            if (validatedData.processLayer && validatedData.processLayer.supportProcesses && validatedData.processLayer.supportProcesses.length > 0) {
                console.log('支持流程数量:', validatedData.processLayer.supportProcesses.length);
                for (const process of validatedData.processLayer.supportProcesses) {
                    console.log('创建支持流程:', process.name);
                    await session.run(`
                        MATCH (e:Enterprise {id: $enterpriseId})
                        CREATE (p:Process {
                            name: $name,
                            description: $description,
                            type: 'support'
                        })
                        CREATE (e)-[:HAS_PROCESS]->(p)
                        RETURN p
                    `, {
                        enterpriseId: enterpriseId,
                        name: process.name,
                        description: process.description || ''
                    });
                }
            } else {
                console.log('警告：没有支持流程数据');
            }

            // 6. 不再在智能分析阶段创建文档层节点
            // 智能分析只创建：企业层、标准层、流程层
            if (validatedData.documentLayer && validatedData.documentLayer.categories && validatedData.documentLayer.categories.length > 0) {
                // 保存文档需求信息到分析结果中，但不创建图谱节点
                console.log('文档层分析完成，将在框架生成阶段创建具体节点');
            } else {
                console.warn('没有有效的文档层数据');
            }

            console.log('五层知识图谱构建完成');

            // 返回企业ID和企业名称，供后续框架生成使用
            return {
                enterpriseId: enterpriseId,
                enterpriseName: enterpriseName
            };

        } catch (error) {
            console.error('保存五层数据失败:', error);
            throw error;
        } finally {
            await session.close();
        }
    }

    // 模糊查询知识图谱
    async queryKnowledgeGraphFuzzy(industry, standard, businessDesc) {
        const session = driver.session();
        try {
            // 阶段1：标准和行业匹配
            const standardIndustryQuery = `
                MATCH (s:Standard)-[:APPLIES_TO]->(i:Industry)
                WHERE (s.name CONTAINS $standard OR 
                       apoc.text.sorensenDiceSimilarity(s.name, $standard) > 0.6) AND
                      (i.name CONTAINS $industry OR 
                       apoc.text.sorensenDiceSimilarity(i.name, $industry) > 0.5)
                RETURN s.name as standard, i.name as industry, s.requirements as requirements
                LIMIT 5
            `;
            
            // 阶段2：改进的企业和业务匹配 - 利用organizationStructure和products
            const enterpriseQuery = `
                MATCH (i:Industry {name: $industry})-[:CONTAINS]->(e:Enterprise)
                WHERE e.organizationStructure IS NOT NULL AND e.products IS NOT NULL
                WITH e,
                     // 在organizationStructure中查找匹配
                     apoc.text.sorensenDiceSimilarity(toLower(e.organizationStructure), toLower($businessDesc)) as orgStructureScore,
                     // 在products中查找匹配
                     apoc.text.sorensenDiceSimilarity(toLower(e.products), toLower($businessDesc)) as productsScore,
                     // 在departments中查找匹配（保留原有逻辑）
                     [dept IN e.departments WHERE toLower(dept) CONTAINS toLower($businessKeyword)] as matchingDepts,
                     // 在products数组中查找匹配（保留原有逻辑）
                     [prod IN e.products WHERE toLower(prod) CONTAINS toLower($businessKeyword)] as matchingProducts
                // 计算综合匹配分数
                WITH e, orgStructureScore, productsScore, matchingDepts, matchingProducts,
                     (orgStructureScore * 0.4 + productsScore * 0.4 + 
                      (size(matchingDepts) + size(matchingProducts)) * 0.2) as totalScore
                WHERE totalScore > 0.3 OR size(matchingDepts) > 0 OR size(matchingProducts) > 0
                RETURN e.name as enterpriseName,
                       e.organizationStructure as organizationStructure,
                       e.products as products,
                       e.departments as departments,
                       matchingDepts,
                       matchingProducts,
                       orgStructureScore,
                       productsScore,
                       totalScore as matchScore
                ORDER BY matchScore DESC
                LIMIT 10
            `;
            
            // 阶段3：文档框架匹配
            const frameworkQuery = `
                MATCH (e:Enterprise)-[:HAS_FRAMEWORK]->(f:DocumentFramework)-[:CONTAINS]->(c:DocumentCategory)
                WHERE e.name IN $enterpriseNames
                OPTIONAL MATCH (c)-[:INCLUDES]->(d:Document)
                RETURN f.name as frameworkName,
                       c.name as categoryName,
                       c.description as categoryDescription,
                       collect(d.name) as documents
            `;
            
            // 执行查询并组合结果
            const standardResult = await session.run(standardIndustryQuery, {
                standard, industry
            });
            
            // 提取业务关键词
            const businessKeywords = this.extractBusinessKeywords(businessDesc);
            
            const enterpriseResults = [];
            // 使用改进的匹配逻辑
            for (const keyword of businessKeywords) {
                const result = await session.run(enterpriseQuery, {
                    industry, 
                    businessKeyword: keyword,
                    businessDesc: businessDesc
                });
                enterpriseResults.push(...result.records);
            }
            
            // 如果没有关键词匹配，直接使用业务描述进行匹配
            if (businessKeywords.length === 0) {
                const result = await session.run(enterpriseQuery, {
                    industry,
                    businessKeyword: '',
                    businessDesc: businessDesc
                });
                enterpriseResults.push(...result.records);
            }
            
            // 去重并获取top企业
            const uniqueEnterprises = new Map();
            enterpriseResults.forEach(record => {
                const name = record.get('enterpriseName');
                const score = record.get('matchScore');
                if (!uniqueEnterprises.has(name) || uniqueEnterprises.get(name).score < score) {
                    uniqueEnterprises.set(name, {
                        record: record,
                        score: score
                    });
                }
            });
            
            const topEnterprises = Array.from(uniqueEnterprises.keys()).slice(0, 5);
            
            const frameworkResult = await session.run(frameworkQuery, {
                enterpriseNames: topEnterprises
            });
            
            return {
                matchedStandards: standardResult.records.map(r => ({
                    name: r.get('standard'),
                    industry: r.get('industry'),
                    requirements: r.get('requirements')
                })),
                matchedEnterprises: Array.from(uniqueEnterprises.values())
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10)
                    .map(item => {
                        const r = item.record;
                        return {
                            name: r.get('enterpriseName'),
                            organizationStructure: r.get('organizationStructure'),
                            products: r.get('products'),
                            departments: r.get('departments'),
                            matchingDepts: r.get('matchingDepts'),
                            matchingProducts: r.get('matchingProducts'),
                            orgStructureScore: r.get('orgStructureScore'),
                            productsScore: r.get('productsScore'),
                            score: r.get('matchScore')
                        };
                    }),
                documentFrameworks: frameworkResult.records.map(r => ({
                    frameworkName: r.get('frameworkName'),
                    categoryName: r.get('categoryName'),
                    categoryDescription: r.get('categoryDescription'),
                    documents: r.get('documents')
                }))
            };
            
        } finally {
            await session.close();
        }
    }

    // 改进的业务关键词提取
    extractBusinessKeywords(businessDesc) {
        const keywords = [];
        
        // 部门相关关键词
        const deptPatterns = /(\w*部门?|\w*部|\w*科|\w*组|\w*中心|\w*处|\w*室)/g;
        const deptMatches = businessDesc.match(deptPatterns);
        if (deptMatches) keywords.push(...deptMatches);
        
        // 产品/服务关键词 - 扩展匹配模式
        const productPatterns = /(\w*产品|\w*服务|\w*系统|\w*设备|\w*软件|\w*解决方案|\w*平台|\w*工具)/g;
        const productMatches = businessDesc.match(productPatterns);
        if (productMatches) keywords.push(...productMatches);
        
        // 行业特定词汇 - 扩展词汇库
        const industryPatterns = /(制造|生产|研发|销售|管理|质量|安全|环保|技术|工程|咨询|培训|维护|运营)/g;
        const industryMatches = businessDesc.match(industryPatterns);
        if (industryMatches) keywords.push(...industryMatches);
        
        // 组织结构相关词汇
        const orgPatterns = /(总部|分公司|子公司|事业部|业务单元|项目组|团队)/g;
        const orgMatches = businessDesc.match(orgPatterns);
        if (orgMatches) keywords.push(...orgMatches);
        
        return [...new Set(keywords)].filter(k => k.length > 1);
    }

    // 保存标准层
    async saveStandardLayer(session, standardLayer) {
        // 保存适用标准
        for (const standard of standardLayer.applicableStandards || []) {
            const query = `
                MERGE (s:Standard {name: $name})
                SET s.type = $type, s.description = $description, s.applicability = $applicability
                RETURN s
            `;
            await session.run(query, standard);
        }

        // 保存法规
        for (const regulation of standardLayer.regulations || []) {
            const query = `
                MERGE (r:Regulation {name: $name})
                SET r.type = $type, r.scope = $scope
                RETURN r
            `;
            await session.run(query, regulation);
        }

        // 保存行业要求
        for (const requirement of standardLayer.industryRequirements || []) {
            const query = `
                MERGE (ir:IndustryRequirement {name: $name})
                SET ir.description = $description, ir.source = $source
                RETURN ir
            `;
            await session.run(query, requirement);
        }
    }

    // 保存企业层
    async saveEnterpriseLayer(session, enterpriseLayer) {
        // 保存企业信息
        if (enterpriseLayer.enterprise) {
            const enterprise = enterpriseLayer.enterprise;
            const query = `
                MERGE (e:Enterprise {name: $name})
                SET e.type = $type, e.industry = $industry, e.businessModel = $businessModel,
                    e.coreCompetencies = $coreCompetencies, e.marketPosition = $marketPosition
                RETURN e
            `;
            await session.run(query, enterprise);
        }

        // 保存组织结构
        for (const org of enterpriseLayer.organizationalStructure || []) {
            const query = `
                MERGE (o:OrganizationalUnit {name: $name})
                SET o.type = $type, o.function = $function, o.keyActivities = $keyActivities
                RETURN o
            `;
            await session.run(query, org);
        }

        // 保存业务单元
        for (const unit of enterpriseLayer.businessUnits || []) {
            const query = `
                MERGE (bu:BusinessUnit {name: $name})
                SET bu.focus = $focus, bu.scope = $scope
                RETURN bu
            `;
            await session.run(query, unit);
        }
    }

    // 保存流程层
    async saveProcessLayer(session, processLayer) {
        // 保存核心流程
        for (const process of processLayer.coreProcesses || []) {
            const query = `
                MERGE (p:Process {name: $name})
                SET p.type = $type, p.category = $category, p.description = $description,
                    p.inputs = $inputs, p.outputs = $outputs, p.keySteps = $keySteps
                RETURN p
            `;
            await session.run(query, process);
        }

        // 保存产品/服务
        for (const product of processLayer.products || []) {
            const query = `
                MERGE (pr:Product {name: $name})
                SET pr.type = $type, pr.category = $category, pr.targetMarket = $targetMarket,
                    pr.features = $features
                RETURN pr
            `;
            await session.run(query, product);
        }

        // 保存利益相关者
        for (const stakeholder of processLayer.stakeholders || []) {
            const query = `
                MERGE (sh:Stakeholder {name: $name})
                SET sh.type = $type, sh.relationship = $relationship, sh.importance = $importance
                RETURN sh
            `;
            await session.run(query, stakeholder);
        }

        // 保存资源
        for (const resource of processLayer.resources || []) {
            const query = `
                MERGE (r:Resource {name: $name})
                SET r.type = $type, r.role = $role
                RETURN r
            `;
            await session.run(query, resource);
        }
    }

    // 保存文档层
    async saveDocumentLayer(session, documentLayer) {
        // 保存文档框架
        if (documentLayer.documentFramework) {
            const framework = documentLayer.documentFramework;
            const query = `
                MERGE (df:DocumentFramework {name: $name})
                SET df.purpose = $purpose, df.scope = $scope
                RETURN df
            `;
            await session.run(query, framework);
        }

        // 保存文档类别
        for (const category of documentLayer.documentCategories || []) {
            const query = `
                MERGE (dc:DocumentCategory {name: $name})
                SET dc.type = $type, dc.purpose = $purpose, dc.scope = $scope
                RETURN dc
            `;
            await session.run(query, category);
        }

        // 保存必需文档
        for (const doc of documentLayer.requiredDocuments || []) {
            const query = `
                MERGE (d:Document {name: $name})
                SET d.type = $type, d.category = $category, d.purpose = $purpose,
                    d.priority = $priority, d.triggers = $triggers, d.relatedProcesses = $relatedProcesses,
                    d.complianceRequirements = $complianceRequirements
                RETURN d
            `;
            await session.run(query, doc);
        }
    }

    // 保存跨层关系
    async saveCrossLayerRelationships(session, relationships) {
        for (const rel of relationships) {
            const query = `
                MATCH (source), (target)
                WHERE source.name = $source AND target.name = $target
                MERGE (source)-[r:RELATES_TO {type: $relationship}]->(target)
                SET r.sourceLayer = $sourceLayer, r.targetLayer = $targetLayer, r.strength = $strength
                RETURN r
            `;
            await session.run(query, rel);
        }
    }

    // 获取默认五层结构
    getDefaultLayeredStructure(description, industry, standard) {
        return {
            standardLayer: {
                standards: [{
                    name: standard || 'ISO 9001',
                    requirements: ['质量管理体系要求', '文档控制要求']
                }],
                regulations: [{
                    name: '质量管理法规',
                    scope: '质量管理体系'
                }]
            },
            enterpriseLayer: {
                departments: ['质量部', '生产部', '技术部'],
                products: ['主要产品', '核心服务'],
                organizationStructure: '传统层级结构'
            },
            processLayer: {
                coreProcesses: [{
                    name: '质量管理流程',
                    description: '质量管理的核心流程',
                    owner: '质量部'
                }],
                supportProcesses: [{
                    name: '文档控制流程',
                    description: '文档的控制和管理'
                }]
            },
            documentLayer: {
                categories: [{
                    name: '质量手册',
                    documents: [{
                        name: '质量手册',
                        type: 'manual'
                    }]
                }]
            }
        };
    }
}

module.exports = AnalysisService;

