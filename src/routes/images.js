// routes/images.js
import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { q } from '../db/pool.js';

const router = Router();

// Authorization helper: owner or member with can_view/can_share
async function assertCanViewImage(userId, imageId) {
  const sql = `
    SELECT 1
    FROM images i
    LEFT JOIN image_members m
      ON m.image_id = i.id AND m.user_id = $1
    WHERE i.id = $2
      AND (m.can_view = TRUE OR m.user_id IS NOT NULL)
  `;
  const { rows } = await q(sql, [userId, imageId]);
  if (!rows.length) throw Object.assign(new Error('forbidden'), { status: 403 });
}

router.get('/api/images/:id/subjects', requireAuth, async (req, res) => {
  try {
    const imageId = Number(req.params.id);
    await assertCanViewImage(req.user.sub, imageId);

    const { rows } = await q(`
      WITH u AS (
        SELECT 'user' AS kind, im.user_id::text AS subject_id, u.user_name AS label,
               im.can_view, im.can_share, im.allow_public
        FROM image_members im
        JOIN users u ON u.id = im.user_id
        WHERE im.image_id = $1
      ),
      p AS (
        SELECT 'person' AS kind, ip.person_id::text AS subject_id, p.name AS label,
               TRUE AS can_view, TRUE AS can_share, TRUE AS allow_public
        FROM image_people ip
        JOIN people p ON p.id = ip.person_id
        WHERE ip.image_id = $1
      )
      SELECT * FROM u
      UNION ALL
      SELECT * FROM p
      ORDER BY kind, label;
    `, [imageId]);

    res.json({ items: rows });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
});

router.post('/api/images/:id/subjects', requireAuth, async (req, res) => {
  const imageId = Number(req.params.id);
  const { kind, subject_id, name, perms } = req.body || {};
  // perms optional: { can_view, can_share, allow_public }

  try {
    // require share permission to add tags
    const canSql = `
      SELECT 1
      FROM image_members m
      WHERE m.image_id = $1 AND m.user_id = $2 AND m.can_share = TRUE
      LIMIT 1`;
    const { rows: can } = await q(canSql, [imageId, req.user.sub]);
    if (!can.length) return res.status(403).json({ error: 'No permission' });

    if (kind === 'user') {
      await q(
        `INSERT INTO image_members (image_id, user_id, can_view, can_share, allow_public)
         VALUES ($1,$2,COALESCE($3,true),COALESCE($4,true),COALESCE($5,true))
         ON CONFLICT (image_id, user_id) DO NOTHING`,
        [imageId, subject_id, perms?.can_view, perms?.can_share, perms?.allow_public]
      );
    } else if (kind === 'person') {
      let personId = subject_id;
      if (!personId) {
        const ins = await q(
          `INSERT INTO people (name, user_id) VALUES ($1, $2) RETURNING id`,
          [name, req.user.sub]
        );
        personId = ins.rows[0].id;
      }
      await q(
        `INSERT INTO image_people (image_id, person_id)
         VALUES ($1,$2)
         ON CONFLICT (image_id, person_id) DO NOTHING`,
        [imageId, personId]
      );
    } else {
      return res.status(400).json({ error: 'Invalid kind' });
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/images/:id/subjects/:kind/:subjectId
router.delete('/api/images/:id/subjects/:kind/:sid', requireAuth, async (req, res) => {
  const imageId = Number(req.params.id);
  const { kind, sid } = req.params;

  // must have can_share to remove
  const { rows: can } = await q(
    `SELECT 1 FROM image_members m
     WHERE m.image_id=$1 AND m.user_id=$2 AND m.can_share=TRUE LIMIT 1`,
    [imageId, req.user.sub]
  );
  if (!can.length) return res.status(403).json({ error: 'No permission' });

  if (kind === 'user') {
    await q(`DELETE FROM image_members WHERE image_id=$1 AND user_id=$2`, [imageId, sid]);
  } else if (kind === 'person') {
    await q(`DELETE FROM image_people   WHERE image_id=$1 AND person_id=$2`, [imageId, sid]);
  } else {
    return res.status(400).json({ error: 'Invalid kind' });
  }
  res.status(204).end();
});


export default router;
