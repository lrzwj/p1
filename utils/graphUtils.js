// 内存中的知识图谱数据库
let knowledgeGraphDB = {
    nodes: [],
    edges: []
};

// 去重和合并三元组
function deduplicateAndMergeTriples(triples) {
    const uniqueTriples = [];
    const seenTriples = new Set();
    
    for (const triple of triples) {
        const key = `${triple.subject}-${triple.predicate}-${triple.object}`;
        if (!seenTriples.has(key)) {
            seenTriples.add(key);
            uniqueTriples.push(triple);
        }
    }
    
    return uniqueTriples;
}

// 生成文档分析报告
function generateDocumentAnalysisReport(fileResults, uniqueTriples) {
    const totalFiles = fileResults.length;
    const totalTriples = fileResults.reduce((sum, file) => sum + file.tripleCount, 0);
    const avgTriplesPerFile = totalFiles > 0 ? (totalTriples / totalFiles).toFixed(2) : 0;
    
    // 获取最活跃的实体
    const topEntities = getTopEntities(uniqueTriples, 5);
    
    return {
        summary: {
            totalFiles,
            totalTriples,
            uniqueTriples: uniqueTriples.length,
            avgTriplesPerFile,
            deduplicationRate: totalTriples > 0 ? ((totalTriples - uniqueTriples.length) / totalTriples * 100).toFixed(2) + '%' : '0%'
        },
        topEntities,
        fileBreakdown: fileResults.map(file => ({
            fileName: file.fileName,
            tripleCount: file.tripleCount,
            percentage: totalTriples > 0 ? ((file.tripleCount / totalTriples) * 100).toFixed(2) + '%' : '0%'
        }))
    };
}

// 获取最活跃的实体
function getTopEntities(triples, count) {
    const entityCount = {};
    
    triples.forEach(triple => {
        entityCount[triple.subject] = (entityCount[triple.subject] || 0) + 1;
        entityCount[triple.object] = (entityCount[triple.object] || 0) + 1;
    });
    
    return Object.entries(entityCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, count)
        .map(([entity, count]) => ({ entity, count }));
}

module.exports = {
    knowledgeGraphDB,
    deduplicateAndMergeTriples,
    generateDocumentAnalysisReport,
    getTopEntities
};