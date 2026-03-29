const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/booksController');

const authenticateToken = require('../security/auth.middleware');

//router.use(authenticateToken);

// --- Livres ---
router.get('/search',  searchBooks);
router.get('/',        getAllBooks);
router.get('/:id',     getBookById);
router.post('/',       createBook);
router.put('/:id',     updateBook);
router.delete('/:id',  deleteBook);

// --- Exemplaires ---
router.get('/:id/copies',                getCopies);
router.post('/:id/copies',               addCopy);
router.patch('/:id/copies/:copyId',      updateCopyStatus);
router.delete('/:id/copies/:copyId',     deleteCopy);

// --- Disponibilité (appelé par loans-service) ---
router.patch('/:id/availability',        updateAvailability);

module.exports = router;
