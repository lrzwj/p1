from flask import Flask, request, jsonify
from flask_cors import CORS
import spacy
import re

app = Flask(__name__)
CORS(app)

# 加载SpaCy模型
try:
    nlp = spacy.load("zh_core_web_sm")
    print("已加载中文SpaCy模型")
except:
    nlp = spacy.load("en_core_web_sm")
    print("已加载英文SpaCy模型 (中文模型未找到)")

@app.route('/extract', methods=['POST'])
def extract_triples():
    data = request.json
    if not data or 'text' not in data:
        return jsonify({'success': False, 'message': '请提供文本内容'}), 400
    
    text = data['text']
    
    # 使用SpaCy进行处理
    doc = nlp(text)
    
    # 提取三元组
    triples = []
    
    # 基于依存句法分析的三元组抽取
    for sent in doc.sents:
        for token in sent:
            # 查找主语-谓语-宾语模式
            if token.dep_ == "ROOT" and token.pos_ == "VERB":
                # 谓语是动词
                predicate = token.text
                
                # 查找主语
                subjects = []
                for child in token.children:
                    if child.dep_ in ["nsubj", "nsubjpass"]:
                        # 扩展主语短语
                        subject_phrase = expand_phrase(child)
                        subjects.append(subject_phrase)
                
                # 查找宾语
                objects = []
                for child in token.children:
                    if child.dep_ in ["dobj", "pobj"]:
                        # 扩展宾语短语
                        object_phrase = expand_phrase(child)
                        objects.append(object_phrase)
                
                # 创建三元组
                for subject in subjects:
                    for obj in objects:
                        if subject and obj:
                            triples.append({
                                'subject': subject,
                                'predicate': predicate,
                                'object': obj,
                                'confidence': 0.85
                            })
    
    # 如果基于依存句法分析没有找到足够的三元组，使用基于规则的方法
    if len(triples) < 2:
        # 使用正则表达式查找可能的实体
        entities = extract_entities(text)
        
        # 使用规则匹配可能的关系
        for i, entity1 in enumerate(entities):
            for j, entity2 in enumerate(entities):
                if i != j:
                    # 查找两个实体之间可能的关系词
                    relation = find_relation_between(text, entity1, entity2)
                    if relation:
                        triples.append({
                            'subject': entity1,
                            'predicate': relation,
                            'object': entity2,
                            'confidence': 0.7  # 基于规则的方法可信度较低
                        })
    
    return jsonify({
        'success': True,
        'triples': triples
    })

# 扩展短语（包含修饰词）
def expand_phrase(token):
    phrase = token.text
    for child in token.children:
        if child.dep_ in ["compound", "amod", "nummod", "dep"]:
            phrase = child.text + phrase
    return phrase

# 使用正则表达式提取可能的实体
def extract_entities(text):
    # 简单的实体提取规则
    entity_patterns = [
        r'[\u4e00-\u9fa5]{2,6}[部门]',  # 匹配可能的部门名称
        r'[\u4e00-\u9fa5]{2,8}[流程]',  # 匹配可能的流程名称
        r'[\u4e00-\u9fa5]{2,6}[手册|文件|规程|指导书]',  # 匹配可能的文档名称
        r'ISO\s*\d+',  # 匹配ISO标准
        r'[\u4e00-\u9fa5]{2,4}[A-Z]'  # 匹配可能的产品名称
    ]
    
    entities = []
    for pattern in entity_patterns:
        matches = re.findall(pattern, text)
        entities.extend(matches)
    
    # 去重
    return list(set(entities))

# 查找两个实体之间可能的关系词
def find_relation_between(text, entity1, entity2):
    # 常见关系词
    relation_words = ['包含', '使用', '负责', '需要', '前置于', '经过', '关联']
    
    # 查找两个实体之间的文本
    try:
        start = text.index(entity1) + len(entity1)
        end = text.index(entity2)
        if start < end:
            between_text = text[start:end]
            
            # 查找关系词
            for relation in relation_words:
                if relation in between_text:
                    return relation
    except ValueError:
        pass
    
    # 如果找不到明确的关系词，返回默认关系
    return '关联'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)