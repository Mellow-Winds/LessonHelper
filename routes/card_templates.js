const express = require('express');

module.exports = function (db) {
  const router = express.Router();

  // GET /api/card-templates — 模板列表
  router.get('/', (req, res) => {
    const { category } = req.query;

    let sql = 'SELECT * FROM card_templates';
    const params = [];

    if (category && category !== 'all') {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY is_official DESC, usage_count DESC';

    const templates = db.all(sql, params).map(t => {
      let components_schema = [];
      try { components_schema = JSON.parse(t.components_schema); } catch (e) { /* ignore */ }
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        category: t.category,
        components_schema,
        is_official: t.is_official,
        usage_count: t.usage_count
      };
    });

    res.json(templates);
  });

  // GET /api/card-templates/:id — 模板详情
  router.get('/:id', (req, res) => {
    const template = db.get('SELECT * FROM card_templates WHERE id = ?', [req.params.id]);
    if (!template) return res.status(404).json({ error: '模板不存在' });

    let components_schema = [];
    try { components_schema = JSON.parse(template.components_schema); } catch (e) { /* ignore */ }

    res.json({
      id: template.id,
      name: template.name,
      description: template.description,
      icon: template.icon,
      category: template.category,
      components_schema,
      is_official: template.is_official,
      usage_count: template.usage_count
    });
  });

  return router;
};
