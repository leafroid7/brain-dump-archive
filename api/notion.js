const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const MEMO_DB_ID = process.env.NOTION_DATABASE_ID;
const FOLDER_DB_ID = process.env.NOTION_FOLDER_DB_ID;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {

    if (action === 'getFolders') {
      const response = await notion.dataSources.query({
        data_source_id: FOLDER_DB_ID,
        sorts: [{ property: '이름', direction: 'ascending' }]
      });
      const folders = response.results.map(page => {
        const icon = page.icon?.type === 'emoji' ? page.icon.emoji : null;
        return {
          id: page.id,
          name: page.properties['이름']?.title?.[0]?.plain_text || '(이름 없음)',
          para: page.properties['P.A.R.A']?.select?.name || null,
          ipor: page.properties['𝗜.𝗣.𝗢.𝗥']?.select?.name || null,
          icon
        };
      });
      return res.json({ folders });
    }

    if (action === 'getMemos') {
      const filter = req.query.folder_id ? {
        property: 'BRAIN DUMP',
        relation: { contains: req.query.folder_id }
      } : undefined;

      const response = await notion.dataSources.query({
        data_source_id: MEMO_DB_ID,
        filter,
        sorts: [{ property: '생성 일시', direction: 'descending' }]
      });

      const memos = response.results.map(page => ({
        id: page.id,
        idea: page.properties['IDEA']?.title?.[0]?.plain_text || '',
        content: page.properties['Content']?.rich_text?.[0]?.plain_text || '',
        status: page.properties['활용도']?.status?.name || null,
        url: page.properties['URL']?.url || null,
        created: page.properties['생성 일시']?.created_time || null,
        folders: page.properties['BRAIN DUMP']?.relation?.map(r => r.id) || []
      }));

      return res.json({ memos });
    }

    if (action === 'addMemo') {
      const { idea, content, status, url, folder_ids } = req.body;

      const properties = {
        'IDEA': { title: [{ text: { content: idea || '' } }] },
        'Content': { rich_text: [{ text: { content: content || '' } }] },
        'URL': url ? { url } : { url: null },
        'BRAIN DUMP': { relation: (folder_ids || []).map(id => ({ id })) }
      };
      if (status) properties['활용도'] = { status: { name: status } };

      const page = await notion.pages.create({
        parent: { type: 'data_source_id', data_source_id: MEMO_DB_ID },
        properties
      });
      return res.json({ success: true, id: page.id });
    }

    if (action === 'updateMemo') {
      const { page_id, idea, content, status, url, folder_ids } = req.body;

      const properties = {};
      if (idea !== undefined) properties['IDEA'] = { title: [{ text: { content: idea } }] };
      if (content !== undefined) properties['Content'] = { rich_text: [{ text: { content: content } }] };
      if (url !== undefined) properties['URL'] = url ? { url } : { url: null };
      if (status !== undefined) properties['활용도'] = { status: { name: status } };
      if (folder_ids !== undefined) properties['BRAIN DUMP'] = { relation: folder_ids.map(id => ({ id })) };

      await notion.pages.update({ page_id, properties });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (error) {
    console.error('Notion API error:', error);
    return res.status(500).json({ error: error.message });
  }
};
