const { getPool } = require('../db');

// ================================================
// Utilitaire : générer un code-barre automatique
// Format : COPY-<bookId>-<timestamp><random>
// ================================================
const generateBarcode = (bookId) => {
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `COPY-${bookId}-${Date.now()}${rand}`;
};

// ================================================
// GET /api/books — lister tous les livres
// ================================================
const getAllBooks = async (req, res) => {
  try {
    const [rows] = await getPool().query(`
      SELECT
        b.*,
        COUNT(bc.id)                                        AS total_copies,
        SUM(bc.status = 'available')                        AS available_copies,
        SUM(bc.status = 'loaned')                           AS loaned_copies,
        SUM(bc.status = 'damaged')                          AS damaged_copies,
        SUM(bc.status = 'lost')                             AS lost_copies
      FROM books b
      LEFT JOIN book_copies bc ON bc.book_id = b.id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// GET /api/books/search?q= — recherche
// ================================================
const searchBooks = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'Paramètre de recherche manquant.' });
  try {
    const [rows] = await getPool().query(
      `SELECT
        b.*,
        COUNT(bc.id)                 AS total_copies,
        SUM(bc.status = 'available') AS available_copies
       FROM books b
       LEFT JOIN book_copies bc ON bc.book_id = b.id
       WHERE b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?
       GROUP BY b.id`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// GET /api/books/:id — obtenir un livre par ID
// ================================================
const getBookById = async (req, res) => {
  try {
    const [rows] = await getPool().query(
      `SELECT
        b.*,
        COUNT(bc.id)                 AS total_copies,
        SUM(bc.status = 'available') AS available_copies,
        SUM(bc.status = 'loaned')    AS loaned_copies,
        SUM(bc.status = 'damaged')   AS damaged_copies,
        SUM(bc.status = 'lost')      AS lost_copies
       FROM books b
       LEFT JOIN book_copies bc ON bc.book_id = b.id
       WHERE b.id = ?
       GROUP BY b.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Livre non trouvé.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// POST /api/books — ajouter un livre
// Crée automatiquement les exemplaires (book_copies)
// ================================================
const createBook = async (req, res) => {
  const { title, author, isbn, description, category, quantity } = req.body;
  if (!title || !author || !isbn) {
    return res.status(400).json({ success: false, message: 'Titre, auteur et ISBN sont requis.' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const qty = parseInt(quantity) || 1;

    // Insérer le livre (available = qty, sera recalculé via copies)
    const [result] = await conn.query(
      'INSERT INTO books (title, author, isbn, description, category) VALUES (?, ?, ?, ?, ?)',
      [title, author, isbn, description || null, category || null]
    );
    const bookId = result.insertId;

    // Créer les exemplaires
    for (let i = 0; i < qty; i++) {
      const barcode = generateBarcode(bookId);
      await conn.query(
        'INSERT INTO book_copies (book_id, barcode, status) VALUES (?, ?, ?)',
        [bookId, barcode, 'available']
      );
    }

// 3. Synchronisation immédiate des compteurs
    await syncBookCountersInternal(conn, bookId);

    await conn.commit();

    res.status(201).json({ success: true, message: 'Livre ajouté avec succès.', data: book[0] });

  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Un livre avec cet ISBN existe déjà.' });
    }
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

// Utilitaire de synchronisation interne (réutilisable)
const syncBookCountersInternal = async (connection, bookId) => {
  await connection.query(
    `UPDATE books SET 
     quantity = (SELECT COUNT(*) FROM book_copies WHERE book_id = ?),
     available = (SELECT COUNT(*) FROM book_copies WHERE book_id = ? AND status = 'available')
     WHERE id = ?`,
    [bookId, bookId, bookId]
  );
};

// ================================================
// PUT /api/books/:id — modifier un livre
// Synchronise quantity/available avec les copies réelles
// ================================================
const updateBook = async (req, res) => {
  const { title, author, isbn, description, category } = req.body;
  // Note : quantity n'est plus modifiable directement ici,
  // il faut ajouter/supprimer des exemplaires via les routes copies.
  try {
    const [existing] = await getPool().query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Livre non trouvé.' });

    const book = existing[0];

    await getPool().query(
      `UPDATE books SET title=?, author=?, isbn=?, description=?, category=? WHERE id=?`,
      [
        title       || book.title,
        author      || book.author,
        isbn        || book.isbn,
        description !== undefined ? description : book.description,
        category    !== undefined ? category    : book.category,
        req.params.id,
      ]
    );

    // Resynchroniser quantity et available depuis les copies réelles
    await syncBookCounters(req.params.id);

    const [updated] = await getPool().query(
      `SELECT b.*, COUNT(bc.id) AS total_copies, SUM(bc.status='available') AS available_copies
       FROM books b LEFT JOIN book_copies bc ON bc.book_id = b.id
       WHERE b.id = ? GROUP BY b.id`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Livre mis à jour.', data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// DELETE /api/books/:id — supprimer un livre
// (les copies sont supprimées en cascade via FK)
// ================================================
const deleteBook = async (req, res) => {
  try {
    const [existing] = await getPool().query('SELECT id FROM books WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Livre non trouvé.' });

    // Vérifier qu'aucun exemplaire n'est actuellement emprunté
    const [activeLoans] = await getPool().query(
      `SELECT l.id FROM loans l
       JOIN book_copies bc ON bc.id = l.copy_id
       WHERE bc.book_id = ? AND l.status IN ('active','overdue')`,
      [req.params.id]
    );
    if (activeLoans.length) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer : ${activeLoans.length} exemplaire(s) actuellement emprunté(s).`
      });
    }

    await getPool().query('DELETE FROM books WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Livre et ses exemplaires supprimés avec succès.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// GET /api/books/:id/copies — lister les exemplaires
// ================================================
const getCopies = async (req, res) => {
  try {
    const [bookRows] = await getPool().query('SELECT id, title FROM books WHERE id = ?', [req.params.id]);
    if (!bookRows.length) return res.status(404).json({ success: false, message: 'Livre non trouvé.' });

    const [copies] = await getPool().query(
      `SELECT
         bc.*,
         l.id         AS current_loan_id,
         l.loan_date  AS current_loan_date,
         l.due_date   AS current_due_date,
         u.name       AS current_borrower
       FROM book_copies bc
       LEFT JOIN loans l  ON l.copy_id = bc.id AND l.status IN ('active','overdue')
       LEFT JOIN users u  ON u.id = l.user_id
       WHERE bc.book_id = ?
       ORDER BY bc.added_at ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: copies, count: copies.length, book: bookRows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// POST /api/books/:id/copies — ajouter un exemplaire
// Body : { barcode? } — généré automatiquement si absent
// ================================================
const addCopy = async (req, res) => {
  const bookId = req.params.id;
  try {
    const [bookRows] = await getPool().query('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!bookRows.length) return res.status(404).json({ success: false, message: 'Livre non trouvé.' });

    const barcode = req.body.barcode || generateBarcode(bookId);

    const [result] = await getPool().query(
      'INSERT INTO book_copies (book_id, barcode, status) VALUES (?, ?, ?)',
      [bookId, barcode, 'available']
    );

    // Resynchroniser les compteurs du livre
    await syncBookCounters(bookId);

    const [copy] = await getPool().query('SELECT * FROM book_copies WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Exemplaire ajouté.', data: copy[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Ce code-barre est déjà utilisé.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// PATCH /api/books/:id/copies/:copyId — modifier le statut d'un exemplaire
// Body : { status } — 'available' | 'damaged' | 'lost'
// (le statut 'loaned' est géré automatiquement par loans-service)
// ================================================
const updateCopyStatus = async (req, res) => {
  const { status } = req.body;
  const ALLOWED = ['available', 'damaged', 'lost'];

  if (!status || !ALLOWED.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Statut invalide. Valeurs acceptées : ${ALLOWED.join(', ')}.`
    });
  }

  try {
    const [copyRows] = await getPool().query(
      'SELECT * FROM book_copies WHERE id = ? AND book_id = ?',
      [req.params.copyId, req.params.id]
    );
    if (!copyRows.length) return res.status(404).json({ success: false, message: 'Exemplaire non trouvé.' });

    const copy = copyRows[0];

    // Interdire le changement si l'exemplaire est actuellement emprunté
    if (copy.status === 'loaned') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de modifier le statut d\'un exemplaire actuellement emprunté.'
      });
    }

    await getPool().query('UPDATE book_copies SET status = ? WHERE id = ?', [status, req.params.copyId]);

    // Resynchroniser les compteurs du livre
    await syncBookCounters(req.params.id);

    const [updated] = await getPool().query('SELECT * FROM book_copies WHERE id = ?', [req.params.copyId]);
    res.json({ success: true, message: 'Statut de l\'exemplaire mis à jour.', data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// DELETE /api/books/:id/copies/:copyId — supprimer un exemplaire
// ================================================
const deleteCopy = async (req, res) => {
  try {
    const [copyRows] = await getPool().query(
      'SELECT * FROM book_copies WHERE id = ? AND book_id = ?',
      [req.params.copyId, req.params.id]
    );
    if (!copyRows.length) return res.status(404).json({ success: false, message: 'Exemplaire non trouvé.' });

    if (copyRows[0].status === 'loaned') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un exemplaire actuellement emprunté.'
      });
    }

    await getPool().query('DELETE FROM book_copies WHERE id = ?', [req.params.copyId]);

    // Resynchroniser les compteurs du livre
    await syncBookCounters(req.params.id);

    res.json({ success: true, message: 'Exemplaire supprimé.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// PATCH /api/books/:id/availability — utilisé par loans-service
// Body : { action: 'borrow'|'return', copy_id }
// ================================================
const updateAvailability = async (req, res) => {
  const { action, copy_id } = req.body;

  if (!copy_id) {
    return res.status(400).json({ success: false, message: 'copy_id requis.' });
  }

  try {
    const [copyRows] = await getPool().query(
      'SELECT * FROM book_copies WHERE id = ? AND book_id = ?',
      [copy_id, req.params.id]
    );
    if (!copyRows.length) return res.status(404).json({ success: false, message: 'Exemplaire non trouvé.' });

    if (action === 'borrow') {
      if (copyRows[0].status !== 'available') {
        return res.status(400).json({ success: false, message: 'Exemplaire non disponible.' });
      }
      await getPool().query('UPDATE book_copies SET status = ? WHERE id = ?', ['loaned', copy_id]);
    } else if (action === 'return') {
      await getPool().query('UPDATE book_copies SET status = ? WHERE id = ?', ['available', copy_id]);
    } else {
      return res.status(400).json({ success: false, message: 'Action invalide. Utiliser "borrow" ou "return".' });
    }

    await syncBookCounters(req.params.id);

    const [updated] = await getPool().query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================================
// Utilitaire interne : resynchroniser quantity et available
// sur la table books depuis les copies réelles
// ================================================
const syncBookCounters = async (bookId) => {
  await getPool().query(
    `UPDATE books
     SET
       quantity  = (SELECT COUNT(*)                      FROM book_copies WHERE book_id = ?),
       available = (SELECT COUNT(*) FROM book_copies WHERE book_id = ? AND status = 'available')
     WHERE id = ?`,
    [bookId, bookId, bookId]
  );
};

module.exports = {
  getAllBooks,
  searchBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getCopies,
  addCopy,
  updateCopyStatus,
  deleteCopy,
  updateAvailability,
};
