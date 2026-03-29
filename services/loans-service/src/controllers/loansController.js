const { getPool } = require('../db');

// ================================================
// Requête de base avec JOIN — inclut le code-barre de l'exemplaire
// ================================================
const LOAN_SELECT = `
  SELECT
    l.id, l.book_id, l.copy_id, l.user_id,
    l.loan_date, l.due_date, l.return_date, l.status,
    l.created_at, l.updated_at,
    b.title   AS book_title,
    b.author  AS book_author,
    u.name    AS user_name,
    bc.barcode AS copy_barcode
  FROM loans l
  JOIN books      b  ON b.id  = l.book_id
  JOIN users      u  ON u.id  = l.user_id
  LEFT JOIN book_copies bc ON bc.id = l.copy_id
`;

// ================================================
// Utilitaire : synchroniser les statuts overdue
// ================================================
const syncOverdue = async () => {
  await getPool().query(
    `UPDATE loans SET status = 'overdue'
     WHERE due_date < CURDATE() AND status = 'active'`
  );
};

// ================================================
// GET /api/loans
// ================================================
const getAllLoans = async (req, res) => {
  try {
    await syncOverdue();
    const [rows] = await getPool().query(`${LOAN_SELECT} ORDER BY l.created_at DESC`);
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// GET /api/loans/history
// ================================================
const getLoanHistory = async (req, res) => {
  try {
    const [rows] = await getPool().query(`${LOAN_SELECT} ORDER BY l.loan_date DESC`);
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// GET /api/loans/overdue
// ================================================
const getOverdueLoans = async (req, res) => {
  try {
    await syncOverdue();
    const [rows] = await getPool().query(`
      ${LOAN_SELECT}
      WHERE l.status = 'overdue'
      ORDER BY l.due_date ASC
    `);
    const data = rows.map(r => ({
      ...r,
      days_overdue: Math.floor((new Date() - new Date(r.due_date)) / 86400000),
    }));
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// GET /api/loans/user/:userId
// ================================================
const getLoansByUser = async (req, res) => {
  try {
    await syncOverdue();
    const [rows] = await getPool().query(
      `${LOAN_SELECT} WHERE l.user_id = ? ORDER BY l.created_at DESC`,
      [req.params.userId]
    );
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// GET /api/loans/:id
// ================================================
const getLoanById = async (req, res) => {
  try {
    const [rows] = await getPool().query(`${LOAN_SELECT} WHERE l.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Emprunt non trouvé.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// POST /api/loans — emprunter un livre
// Body : { book_id, user_id, due_date?, copy_id? }
//
// Si copy_id est fourni → utiliser cet exemplaire précis
// Sinon → sélectionner automatiquement le premier exemplaire disponible
// ================================================
const createLoan = async (req, res) => {
  const { book_id, user_id, due_date, copy_id } = req.body;

  if (!book_id || !user_id) {
    return res.status(400).json({ success: false, message: 'book_id et user_id sont requis.' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Vérifier que l'utilisateur existe
    const [userRows] = await conn.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    }

    // Vérifier que le livre existe
    const [bookRows] = await conn.query('SELECT id, title FROM books WHERE id = ?', [book_id]);
    if (!bookRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Livre introuvable.' });
    }

    // Vérifier que l'utilisateur n'a pas déjà un emprunt actif sur ce livre
    const [existingLoan] = await conn.query(
      `SELECT id FROM loans WHERE book_id = ? AND user_id = ? AND status IN ('active','overdue')`,
      [book_id, user_id]
    );
    if (existingLoan.length) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Cet utilisateur a déjà emprunté ce livre.' });
    }

    // Sélectionner l'exemplaire à emprunter
    let selectedCopyId;

    if (copy_id) {
      // Exemplaire spécifié manuellement
      const [specifiedCopy] = await conn.query(
        'SELECT id, status FROM book_copies WHERE id = ? AND book_id = ?',
        [copy_id, book_id]
      );
      if (!specifiedCopy.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: 'Exemplaire introuvable pour ce livre.' });
      }
      if (specifiedCopy[0].status !== 'available') {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Cet exemplaire n'est pas disponible (statut : ${specifiedCopy[0].status}).`
        });
      }
      selectedCopyId = copy_id;
    } else {
      // Sélection automatique du premier exemplaire disponible
      const [availableCopy] = await conn.query(
        `SELECT id FROM book_copies
         WHERE book_id = ? AND status = 'available'
         ORDER BY id ASC
         LIMIT 1`,
        [book_id]
      );
      if (!availableCopy.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Aucun exemplaire disponible pour ce livre.' });
      }
      selectedCopyId = availableCopy[0].id;
    }

    // Calculer les dates
    const loanDate = new Date().toISOString().split('T')[0];
    const dueDate  = due_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    })();

    // Créer l'emprunt avec le copy_id
    const [result] = await conn.query(
      'INSERT INTO loans (book_id, copy_id, user_id, loan_date, due_date, status) VALUES (?, ?, ?, ?, ?, ?)',
      [book_id, selectedCopyId, user_id, loanDate, dueDate, 'active']
    );

    // Passer l'exemplaire en statut 'loaned'
    await conn.query('UPDATE book_copies SET status = ? WHERE id = ?', ['loaned', selectedCopyId]);

    // Resynchroniser les compteurs du livre
    await conn.query(
      `UPDATE books
       SET
         quantity  = (SELECT COUNT(*)                                    FROM book_copies WHERE book_id = ?),
         available = (SELECT COUNT(*) FROM book_copies WHERE book_id = ? AND status = 'available')
       WHERE id = ?`,
      [book_id, book_id, book_id]
    );

    await conn.commit();

    const [loan] = await pool.query(`${LOAN_SELECT} WHERE l.id = ?`, [result.insertId]);
    res.status(201).json({ success: true, message: 'Emprunt enregistré avec succès.', data: loan[0] });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

// ================================================
// PUT /api/loans/:id/return — retourner un livre
// ================================================
const returnLoan = async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM loans WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Emprunt non trouvé.' });
    }

    const loan = rows[0];

    if (loan.status === 'returned') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Ce livre a déjà été retourné.' });
    }

    const returnDate = new Date().toISOString().split('T')[0];

    // Mettre à jour l'emprunt
    await conn.query(
      `UPDATE loans SET status = 'returned', return_date = ? WHERE id = ?`,
      [returnDate, req.params.id]
    );

    // Remettre l'exemplaire en 'available'
    if (loan.copy_id) {
      await conn.query(
        'UPDATE book_copies SET status = ? WHERE id = ?',
        ['available', loan.copy_id]
      );
    }

    // Resynchroniser les compteurs du livre
    await conn.query(
      `UPDATE books
       SET
         quantity  = (SELECT COUNT(*)                                    FROM book_copies WHERE book_id = ?),
         available = (SELECT COUNT(*) FROM book_copies WHERE book_id = ? AND status = 'available')
       WHERE id = ?`,
      [loan.book_id, loan.book_id, loan.book_id]
    );

    await conn.commit();

    const [updated] = await pool.query(`${LOAN_SELECT} WHERE l.id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Livre retourné avec succès.', data: updated[0] });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

module.exports = {
  getAllLoans,
  getLoanHistory,
  getOverdueLoans,
  getLoansByUser,
  getLoanById,
  createLoan,
  returnLoan,
};
